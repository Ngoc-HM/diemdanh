import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  SESSION_REFRESH_AFTER_SECONDS,
  signSession,
  verifySession,
  type VerifiedSession,
} from "@/lib/session-token";
import { clientIp } from "@/lib/request-meta";
import { findMatchingCidr } from "@/lib/ip-match";
import {
  BLOCKED_IP_HEADER,
  BLOCKED_MESSAGE,
  getBlockedRanges,
  lockEmployee,
} from "@/lib/ip-policy";

/// Hai route đăng nhập vẫn được đi tiếp (kèm header) khi IP bị chặn: chỉ ở đó
/// mới biết người đang dùng IP này là tài khoản nào để khoá.
const LOGIN_ROUTES = new Set(["/api/auth/login", "/api/auth/login/2fa"]);

/// Các đường dẫn giao diện cần chặn điện thoại / kiểm tra phiên như trước.
const PAGE_PATHS = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/desktop-only",
  "/canh-bao",
]);

const BLOCKED_PAGE = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Truy cập bị chặn</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif"><main style="max-width:480px;padding:32px;text-align:center"><h1 style="font-size:28px;margin:0 0 12px;color:#fff">Truy cập bị chặn</h1><p style="font-size:16px;line-height:1.6;margin:0">${BLOCKED_MESSAGE} Lần truy cập này đã được ghi lại. Nếu bạn cho rằng có nhầm lẫn, hãy liên hệ quản trị viên.</p></main></body></html>`;

/// IP nằm trong blacklist: chặn mọi trang và API. Nếu request mang phiên của
/// một nhân viên thì khoá luôn tài khoản đó (admin thì chỉ chặn, không khoá,
/// tránh admin tự khoá mất quyền quản trị).
async function blockRequest(req: NextRequest, ip: string, cidr: string) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const lockAccount = session?.role === "employee";
  if (lockAccount) {
    await lockEmployee(req, session.userId, `truy cập từ IP bị chặn ${ip} (${cidr})`);
  }

  const response = req.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 403 })
    : new NextResponse(BLOCKED_PAGE, {
        status: 403,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
  // Phiên nhân viên vừa bị khoá thì xoá cookie luôn; admin chỉ bị chặn ở IP này.
  if (lockAccount) response.cookies.delete(SESSION_COOKIE);
  return response;
}

/// Hệ thống chỉ dùng trên máy tính. Điện thoại và máy tính bảng bị đưa sang
/// trang thông báo. iPad đời mới tự nhận là máy Mac nên không chặn được.
const MOBILE_UA =
  /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|BlackBerry|webOS/i;
const DESKTOP_ONLY_PATH = "/desktop-only";
/// Đã đăng nhập nhưng mò sang khu vực không thuộc quyền thì đưa sang trang
/// cảnh báo, không đưa về trang đăng nhập như trước: mò lung tung phải thấy
/// cảnh báo, còn người chưa đăng nhập thì vẫn về trang đăng nhập bình thường.
const ACCESS_DENIED_PATH = "/canh-bao";

function accessDenied(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = ACCESS_DENIED_PATH;
  url.search = `?path=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

/// Chặn ngay ở cửa vào thay vì để client tự redirect sau khi đã render.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const ip = clientIp(req);
  const blockedBy = ip ? findMatchingCidr(ip, await getBlockedRanges()) : null;
  if (blockedBy && !(LOGIN_ROUTES.has(pathname) && req.method === "POST")) {
    return await blockRequest(req, ip!, blockedBy);
  }
  if (blockedBy || req.headers.has(BLOCKED_IP_HEADER)) {
    const headers = new Headers(req.headers);
    headers.delete(BLOCKED_IP_HEADER);
    if (blockedBy) headers.set(BLOCKED_IP_HEADER, `${ip} (${blockedBy})`);
    return NextResponse.next({ request: { headers } });
  }

  const isPagePath =
    PAGE_PATHS.has(pathname) ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");
  if (!isPagePath) return NextResponse.next();

  if (
    pathname !== DESKTOP_ONLY_PATH &&
    MOBILE_UA.test(req.headers.get("user-agent") ?? "")
  ) {
    return redirectTo(req, DESKTOP_ONLY_PATH);
  }

  // Tiền tố "/admin" không đủ: "/admin-dashboard" chẳng hạn không phải khu quản trị.
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isEmployeeArea =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (!isAdminArea && !isEmployeeArea) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    return redirectTo(req, "/login");
  }
  if (isAdminArea && session.role !== "admin") {
    return accessDenied(req);
  }
  if (isEmployeeArea && session.role !== "employee") {
    return accessDenied(req);
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
    sv: session.sv,
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

/// Chạy runtime Node (không phải edge) để tra blacklist trong database. Bắt
/// mọi đường dẫn — trang, API, ảnh upload — trừ file tĩnh của Next.
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
