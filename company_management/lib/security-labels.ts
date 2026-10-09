/// Nhãn tiếng Việt cho nhật ký bảo mật. Tách riêng (không import db) để trang
/// admin phía client dùng được.

export type LoginEventType =
  | "login"
  | "login_failed"
  | "2fa_failed"
  | "2fa_enabled"
  | "2fa_disabled"
  | "2fa_reset_by_admin"
  | "password_changed"
  | "password_reset"
  | "account_locked"
  | "account_unlocked"
  | "blocked_ip";

export const LOGIN_EVENT_LABELS: Record<LoginEventType, string> = {
  login: "Đăng nhập",
  login_failed: "Sai mật khẩu",
  "2fa_failed": "Sai mã 2 lớp",
  "2fa_enabled": "Bật xác thực 2 lớp",
  "2fa_disabled": "Tắt xác thực 2 lớp",
  "2fa_reset_by_admin": "Admin tắt 2 lớp",
  password_changed: "Đổi mật khẩu",
  password_reset: "Đặt lại mật khẩu",
  account_locked: "Khoá tài khoản",
  account_unlocked: "Mở khoá tài khoản",
  blocked_ip: "Đăng nhập từ IP bị chặn",
};

export type PunchFlag = "low_accuracy" | "no_accuracy" | "shared_ip";

export const PUNCH_FLAG_LABELS: Record<PunchFlag, string> = {
  low_accuracy: "GPS kém chính xác",
  no_accuracy: "Không rõ độ chính xác",
  shared_ip: "IP dùng chung",
};

export const PUNCH_REASON_LABELS: Record<string, string> = {
  outside_radius: "Ngoài bán kính",
  no_location: "Không có vị trí",
  no_work_location: "Chưa khai báo vị trí",
  outside_network: "Ngoài mạng văn phòng",
  already_checked_in: "Đã check-in rồi",
  not_checked_in: "Chưa check-in",
};

/// Rút gọn user-agent thành "Chrome · Windows" cho bảng nhật ký.
export function summarizeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "—";
  const browser = /CocCoc/i.test(ua)
    ? "Cốc Cốc"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : /curl|python|node|axios|wget|postman/i.test(ua)
                ? "Công cụ / script"
                : "Khác";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}
