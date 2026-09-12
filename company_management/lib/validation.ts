/// Chuẩn hoá + kiểm tra dữ liệu dùng chung giữa các route.
/// Để ở đây thay vì trong file route vì Next.js chỉ cho phép route file
/// export đúng các HTTP handler.

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/// Giờ nghỉ trưa mặc định (Settings `lunch_break`, dạng "HH:MM-HH:MM").
export const DEFAULT_LUNCH_BREAK = "12:00-13:30";

/// Bộ ca mặc định. `minHours` tính theo giờ làm thực (đã trừ nghỉ trưa) và nới
/// 30 phút so với độ dài ca, để ra sớm một chút vẫn đủ công.
export const DEFAULT_WORK_SESSIONS = [
  { code: "S", name: "Ca sáng", workStart: "08:30", workEnd: "12:00", minHours: 3, sortOrder: 1, isDefaultFull: false },
  { code: "C", name: "Ca chiều", workStart: "13:30", workEnd: "17:30", minHours: 3.5, sortOrder: 2, isDefaultFull: false },
  { code: "CN", name: "Cả ngày", workStart: "08:30", workEnd: "17:30", minHours: 7, sortOrder: 3, isDefaultFull: true },
  { code: "T", name: "Tăng ca", workStart: "18:00", workEnd: "21:00", minHours: 2.5, sortOrder: 4, isDefaultFull: false },
];

export type NormalizedSession = {
  code: string;
  name: string;
  workStart: string;
  workEnd: string;
  minHours: number;
  sortOrder: number;
  isActive: boolean;
  isDefaultFull: boolean;
};

export function normalizeSession(body: Record<string, unknown>): NormalizedSession {
  return {
    code: String(body.code || "").trim().toUpperCase(),
    name: String(body.name || "").trim(),
    workStart: String(body.workStart || ""),
    workEnd: String(body.workEnd || ""),
    minHours: Number(body.minHours),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 99,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    isDefaultFull: Boolean(body.isDefaultFull),
  };
}

export function validateSession(session: NormalizedSession): string | null {
  if (!session.code || !session.name) return "Vui lòng nhập mã và tên ca";
  if (session.code.length > 8) return "Mã ca tối đa 8 ký tự";

  const times = [session.workStart, session.workEnd];
  if (times.some((time) => !TIME_PATTERN.test(time))) {
    return "Khung giờ phải theo dạng HH:MM";
  }
  if (session.workStart >= session.workEnd) {
    return "Giờ tan ca phải sau giờ vào ca";
  }
  if (
    !Number.isFinite(session.minHours) ||
    session.minHours <= 0 ||
    session.minHours > 24
  ) {
    return "Số giờ tối thiểu phải trong khoảng 0–24";
  }
  return null;
}

export type NormalizedLocation = {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
};

export function normalizeLocation(
  body: Record<string, unknown>
): NormalizedLocation {
  return {
    name: String(body.name || "").trim(),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    radius: Math.round(Number(body.radius)),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}

export function validateLocation(location: NormalizedLocation): string | null {
  if (!location.name) return "Vui lòng nhập tên vị trí";
  if (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90) {
    return "Vĩ độ phải nằm trong khoảng -90 đến 90";
  }
  if (!Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180) {
    return "Kinh độ phải nằm trong khoảng -180 đến 180";
  }
  if (
    !Number.isFinite(location.radius) ||
    location.radius < 10 ||
    location.radius > 5000
  ) {
    return "Bán kính phải từ 10m đến 5000m";
  }
  return null;
}
