import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

/// Chặn ngay ở tầng edge thay vì để client tự redirect sau khi đã render.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isAdminArea = pathname.startsWith("/admin");
  const loginPath = isAdminArea ? "/admin-login-app" : "/login";

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = loginPath;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAdminArea && session.role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin-login-app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isAdminArea && session.role !== "employee") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/attendance";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
