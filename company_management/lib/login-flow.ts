/// Hằng số dùng chung giữa hai bước đăng nhập (mật khẩu → mã 2 lớp).

/// Trang đích sau khi đăng nhập, theo vai trò của tài khoản.
export const HOME_BY_ROLE = {
  admin: "/admin/attendance",
  employee: "/dashboard",
} as const;

/// Vé tạm giữa bước mật khẩu và bước mã 2 lớp. Chỉ gửi kèm các request tới
/// /api/auth/login, sống đúng bằng hạn của JWT bên trong (5 phút).
export const MFA_COOKIE = "mfa_challenge";

export function mfaCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/auth/login",
    maxAge: 5 * 60,
  };
}
