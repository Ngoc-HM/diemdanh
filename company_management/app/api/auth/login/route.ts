import { badRequest, handle } from "@/lib/auth-guard";
import { setSessionCookie, signSession } from "@/lib/session";
import { login } from "@/lib/auth-login";

/// Trang đích sau khi đăng nhập, theo vai trò của tài khoản.
const HOME_BY_ROLE = {
  admin: "/admin/attendance",
  employee: "/dashboard",
} as const;

/// Đăng nhập chung cho admin và nhân viên bằng email hoặc tên đăng nhập. Trùng
/// tài khoản admin thì vào khu quản trị, còn lại là nhân viên (lib/auth-login.ts).
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

    const session = await login(identifier, password);

    await setSessionCookie(await signSession(session));

    return {
      success: true,
      role: session.role,
      redirect: HOME_BY_ROLE[session.role],
      user: { name: session.name },
    };
  }, "Login error");
}
