import { queryOne } from "@/lib/db";
import {
  badRequest,
  handle,
  HttpError,
  requireAdmin,
  requireEmployee,
  requireUser,
} from "@/lib/auth-guard";
import { reissueSession } from "@/lib/session";
import { throttleKeyFor, verifyAccountPassword } from "@/lib/auth-login";
import {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-throttle";
import { logLoginEvent } from "@/lib/security-log";
import {
  Account,
  beginTwoFactorSetup,
  bumpSessionVersion,
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
  twoFactorStatus,
  verifySecondFactor,
} from "@/lib/two-factor";

/// Tài khoản đang đăng nhập (admin hoặc nhân viên), đã qua kiểm tra phiên.
async function currentAccount() {
  const { role } = await requireUser();
  const session = role === "admin" ? await requireAdmin() : await requireEmployee();
  const account: Account = { type: session.role, id: session.userId };
  return { session, account };
}

/// Tên hiện trong app xác thực: tên công ty, để phân biệt với tài khoản khác.
async function issuerName(): Promise<string> {
  const row = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
  );
  return (row?.value || "Chấm công").replace(/:/g, " ").slice(0, 60);
}

export async function GET() {
  return handle(async () => {
    const { account } = await currentAccount();
    return await twoFactorStatus(account);
  }, "2FA status error");
}

/// Bật / tắt xác thực 2 lớp cho chính mình:
/// - setup {password}: tạo mã QR (chưa bật)
/// - confirm {code}: nhập mã từ app để bật, nhận 10 mã dự phòng
/// - disable {password, code}: tắt
/// - regenerate {code}: tạo bộ mã dự phòng mới
/// Sai mật khẩu / sai mã đếm chung với bộ đếm đăng nhập sai, nên phiên bị lộ
/// cũng không dò được mật khẩu qua đây.
export async function POST(req: Request) {
  return handle(async () => {
    const { session, account } = await currentAccount();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const password = String(body?.password ?? "");
    const code = String(body?.code ?? "").trim();
    const throttleKey = throttleKeyFor(session);
    const identity = { ...account, identifier: session.email };

    async function requirePassword() {
      await assertLoginAllowed(throttleKey);
      if (!password) badRequest("Vui lòng nhập mật khẩu hiện tại");
      if (!(await verifyAccountPassword(account, password))) {
        await recordLoginFailure(throttleKey);
        throw new HttpError(400, "Mật khẩu hiện tại không đúng");
      }
    }

    async function requireCode() {
      await assertLoginAllowed(throttleKey);
      if (!code) badRequest("Vui lòng nhập mã xác thực");
      if (!(await verifySecondFactor(account, code))) {
        await recordLoginFailure(throttleKey);
        await logLoginEvent(req, "2fa_failed", identity);
        throw new HttpError(400, "Mã xác thực không đúng");
      }
    }

    switch (action) {
      case "setup": {
        await requirePassword();
        await clearLoginFailures(throttleKey);
        const setup = await beginTwoFactorSetup(account, session.email, await issuerName());
        return { secret: setup.secret, qrSvg: setup.qrSvg };
      }
      case "confirm": {
        if (!code) badRequest("Vui lòng nhập mã 6 số trong app");
        const backupCodes = await confirmTwoFactorSetup(account, code);
        // Bật xong thì các phiên khác phải đăng nhập lại bằng mã.
        await reissueSession(session, await bumpSessionVersion(account));
        await logLoginEvent(req, "2fa_enabled", identity);
        return { backupCodes, status: await twoFactorStatus(account) };
      }
      case "disable": {
        await requirePassword();
        await requireCode();
        await clearLoginFailures(throttleKey);
        await disableTwoFactor(account);
        await reissueSession(session, await bumpSessionVersion(account));
        await logLoginEvent(req, "2fa_disabled", identity);
        return { status: await twoFactorStatus(account) };
      }
      case "regenerate": {
        await requireCode();
        await clearLoginFailures(throttleKey);
        const backupCodes = await regenerateBackupCodes(account);
        return { backupCodes, status: await twoFactorStatus(account) };
      }
      default:
        badRequest("Thao tác không hợp lệ");
    }
  }, "2FA update error");
}
