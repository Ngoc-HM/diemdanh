import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { badRequest, handle, HttpError } from "@/lib/auth-guard";
import { setSessionCookie, signSession } from "@/lib/session";
import { verifyMfaChallenge } from "@/lib/session-token";
import { throttleKeyFor } from "@/lib/auth-login";
import {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-throttle";
import { logLoginEvent } from "@/lib/security-log";
import { verifySecondFactor } from "@/lib/two-factor";
import { HOME_BY_ROLE, MFA_COOKIE } from "@/lib/login-flow";

const EXPIRED = "Phiên xác thực đã hết hạn, vui lòng đăng nhập lại";

/// Bước 2 của đăng nhập: mã 6 số từ app xác thực, hoặc một mã dự phòng.
export async function POST(req: Request) {
  return handle(async () => {
    const cookieStore = await cookies();
    const token = cookieStore.get(MFA_COOKIE)?.value;
    const pending = token ? await verifyMfaChallenge(token) : null;
    if (!pending) throw new HttpError(401, EXPIRED);

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    if (!code) badRequest("Vui lòng nhập mã xác thực");

    // Đổi mật khẩu hay tắt 2 lớp trong lúc chờ thì vé cũ không còn giá trị.
    const table = pending.role === "admin" ? '"Admin"' : '"User"';
    const account = await queryOne<{ sessionVersion: number; twoFactor: boolean; active: boolean }>(
      `SELECT "sessionVersion", "totpSecret" IS NOT NULL AS "twoFactor",
              ${pending.role === "admin" ? "true" : '"isActive"'} AS "active"
         FROM ${table} WHERE "id" = $1`,
      [pending.userId]
    );
    if (!account || !account.twoFactor || account.sessionVersion !== (pending.sv ?? 0)) {
      cookieStore.delete({ name: MFA_COOKIE, path: "/api/auth/login" });
      throw new HttpError(401, EXPIRED);
    }
    if (!account.active) {
      throw new HttpError(403, "Tài khoản đã ngừng hoạt động. Liên hệ quản trị viên.");
    }

    const throttleKey = throttleKeyFor(pending);
    await assertLoginAllowed(throttleKey);

    const target = { type: pending.role, id: pending.userId } as const;
    const method = await verifySecondFactor(target, code);
    if (!method) {
      await recordLoginFailure(throttleKey);
      await logLoginEvent(req, "2fa_failed", { ...target, identifier: pending.email });
      throw new HttpError(401, "Mã xác thực không đúng");
    }

    await clearLoginFailures(throttleKey);
    cookieStore.delete({ name: MFA_COOKIE, path: "/api/auth/login" });
    await setSessionCookie(await signSession(pending));
    await logLoginEvent(req, "login", {
      ...target,
      identifier: method === "backup" ? `${pending.email} (mã dự phòng)` : pending.email,
    });

    return {
      success: true,
      role: pending.role,
      redirect: HOME_BY_ROLE[pending.role],
      user: { name: pending.name },
    };
  }, "Login 2FA error");
}
