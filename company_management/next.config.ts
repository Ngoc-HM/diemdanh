import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Không quảng cáo framework đang dùng cho người dò lỗ hổng.
  poweredByHeader: false,

  /// Header bảo mật cho mọi đường dẫn. CSP đầy đủ (script-src) chưa bật vì
  /// Next cần nonce cho script nội tuyến; ba chỉ thị dưới đây thì an toàn.
  async headers() {
    const securityHeaders = [
      // Chặn nhúng trang vào iframe của site khác (clickjacking).
      { key: "X-Frame-Options", value: "DENY" },
      // File nhân viên tự upload phải được phục vụ đúng kiểu đã khai, không
      // để trình duyệt tự đoán ra HTML rồi chạy.
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
      },
    ];

    // HSTS chỉ bật ở production: bật ở dev thì trình duyệt ép https localhost.
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000",
      });
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },

  async redirects() {
    // Khu vực quản trị nay nằm ở /admin. Giữ lại luật này để link cũ và tab
    // đang mở ở /admin-dashboard không bị 404.
    return [
      // Admin và nhân viên nay đăng nhập chung ở /login (vai trò nào vào khu
      // vực đó). Giữ đường dẫn cũ cho bookmark của admin.
      {
        source: "/admin-login-app",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/admin-dashboard",
        destination: "/admin/attendance/monthly",
        permanent: false,
      },
      {
        source: "/admin-dashboard/:path*",
        destination: "/admin/attendance/monthly",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
