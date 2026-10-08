import { cookies } from "next/headers";
import { badRequest, handle, HttpError } from "@/lib/auth-guard";
import { setSessionCookie, signSession } from "@/lib/session";
import { signMfaChallenge } from "@/lib/session-token";
import { login } from "@/lib/auth-login";
import { logLoginEvent } from "@/lib/security-log";
import { HOME_BY_ROLE, MFA_COOKIE, mfaCookieOptions } from "@/lib/login-flow";

/// Đăng nhập chung cho admin và nhân viên bằng email hoặc tên đăng nhập. Trùng
/// tài khoản admin thì vào khu quản trị, còn lại là nhân viên (lib/auth-login.ts).
/// Tài khoản bật xác thực 2 lớp thì chỉ nhận một vé tạm 5 phút (cookie
/// httpOnly), phải nhập mã ở /api/auth/login/2fa mới có phiên.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    // Nhận thêm "email" / "username" của hai form cũ để tab đang mở vẫn gửi được.
    const identifier = String(
      body?.identifier ?? body?.email ?? body?.username ?? ""
    ).trim();
    const password = String(body?.password || "");

    if (!identifier || !password) {
      badRequest("Vui lòng nhập tài khoản và mật khẩu");
    }

    let result;
    try {
      result = await login(identifier, password);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        await logLoginEvent(req, "login_failed", { type: "unknown", identifier });
      }
      throw error;
    }
    const { session, twoFactor } = result;

    if (twoFactor) {
      const cookieStore = await cookies();
      cookieStore.set(MFA_COOKIE, await signMfaChallenge(session), mfaCookieOptions());
      return { success: true, twoFactorRequired: true };
    }

    await setSessionCookie(await signSession(session));
    await logLoginEvent(req, "login", {
      type: session.role,
      id: session.userId,
      identifier: session.email,
    });

    return {
      success: true,
      role: session.role,
      redirect: HOME_BY_ROLE[session.role],
      user: { name: session.name },
    };
  }, "Login error");
}
