import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Khu vực quản trị nay nằm ở /admin. Giữ lại luật này để link cũ và tab
    // đang mở ở /admin-dashboard không bị 404.
    return [
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
