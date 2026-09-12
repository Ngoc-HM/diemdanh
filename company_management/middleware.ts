import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  SESSION_REFRESH_AFTER_SECONDS,
  signSession,
  verifySession,
  type VerifiedSession,
} from "@/lib/session-token";

/// Hệ thống chỉ dùng trên máy tính. Điện thoại và máy tính bảng bị đưa sang
/// trang thông báo. iPad đời mới tự nhận là máy Mac nên không chặn được.
const MOBILE_UA =
  /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|BlackBerry|webOS/i;
const DESKTOP_ONLY_PATH = "/desktop-only";

function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

/// Chặn ngay ở tầng edge thay vì để client tự redirect sau khi đã render.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname !== DESKTOP_ONLY_PATH &&
    MOBILE_UA.test(req.headers.get("user-agent") ?? "")
  ) {
    return redirectTo(req, DESKTOP_ONLY_PATH);
  }

  // /admin-login-app không thuộc khu vực quản trị dù cùng tiền tố.
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isEmployeeArea =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (!isAdminArea && !isEmployeeArea) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    return redirectTo(req, isAdminArea ? "/admin-login-app" : "/login");
  }
  if (isAdminArea && session.role !== "admin") {
    return redirectTo(req, "/admin-login-app");
  }
  if (isEmployeeArea && session.role !== "employee") {
    return redirectTo(req, "/admin/attendance");
  }

  return await withRefreshedSession(session);
}

/// Gia hạn phiên khi người dùng còn vào web: phiên cấp 7 ngày, nhưng cứ quá
/// một ngày là ký lại từ đầu, nên dùng đều thì không phải đăng nhập lại. Nghỉ
/// hẳn 7 ngày mới bị đá ra.
async function withRefreshedSession(session: VerifiedSession) {
  const response = NextResponse.next();
  const ageSeconds = Date.now() / 1000 - (session.iat ?? 0);
  if (!session.iat || ageSeconds < SESSION_REFRESH_AFTER_SECONDS) {
    return response;
  }

  const token = await signSession({
    userId: session.userId,
    role: session.role,
    name: session.name,
    email: session.email,
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/admin-login-app",
    "/forgot-password",
    "/reset-password",
    "/desktop-only",
    "/admin/:path*",
    "/dashboard/:path*",
  ],
};
