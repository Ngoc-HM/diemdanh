import { LunchBreak, PunchInput, SessionRule } from "@/lib/attendance-rules";
import { parseTimeToMinutes } from "@/lib/datetime";

/// Loại ngày quyết định ký hiệu và hệ số OT.
export type OvertimeDayType = "weekday" | "weekly_off" | "holiday";

/// Ký hiệu trên bảng chấm công: T ngày thường, T1 ngày nghỉ tuần, T2 ngày lễ.
export const OVERTIME_CODES: Record<OvertimeDayType, string> = {
  weekday: "T",
  weekly_off: "T1",
  holiday: "T2",
};

export const OVERTIME_DAY_LABELS: Record<OvertimeDayType, string> = {
  weekday: "Ngày thường",
  weekly_off: "Ngày nghỉ hằng tuần",
  holiday: "Ngày lễ",
};

export type OvertimeConfig = {
  /// Hệ số theo %: 150 = x1,5.
  weekdayRate: number;
  weeklyOffRate: number;
  holidayRate: number;
  /// Số giờ chuẩn một ngày, để quy lương ngày ra lương giờ.
  hoursPerDay: number;
};

/// Mặc định theo Bộ luật Lao động: 150% / 200% / 300%, 8 giờ một ngày.
export const DEFAULT_OVERTIME_CONFIG: OvertimeConfig = {
  weekdayRate: 150,
  weeklyOffRate: 200,
  holidayRate: 300,
  hoursPerDay: 8,
};

export const OVERTIME_CONTENT_MIN = 3;
export const OVERTIME_CONTENT_MAX = 500;
export const OVERTIME_PLACE_MAX = 200;

export function parseOvertimeConfig(raw: string | null | undefined): OvertimeConfig {
  if (!raw) return { ...DEFAULT_OVERTIME_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<OvertimeConfig>;
    const config = { ...DEFAULT_OVERTIME_CONFIG, ...parsed };
    return validateOvertimeConfig(config) ? { ...DEFAULT_OVERTIME_CONFIG } : config;
  } catch {
    return { ...DEFAULT_OVERTIME_CONFIG };
  }
}

/// Trả về câu lỗi, hoặc null nếu hợp lệ.
export function validateOvertimeConfig(config: OvertimeConfig): string | null {
  const rates = [config.weekdayRate, config.weeklyOffRate, config.holidayRate];
  if (rates.some((rate) => !Number.isFinite(rate) || rate < 100 || rate > 1000)) {
    return "Hệ số OT phải trong khoảng 100% – 1000%";
  }
  if (
    !Number.isFinite(config.hoursPerDay) ||
    config.hoursPerDay < 1 ||
    config.hoursPerDay > 24
  ) {
    return "Số giờ chuẩn một ngày phải trong khoảng 1 – 24";
  }
  return null;
}

export function overtimeRate(config: OvertimeConfig, dayType: OvertimeDayType): number {
  if (dayType === "holiday") return config.holidayRate;
  if (dayType === "weekly_off") return config.weeklyOffRate;
  return config.weekdayRate;
}

/// Ngày lễ ưu tiên hơn ngày nghỉ tuần (lễ rơi vào CN vẫn là T2).
export function overtimeDayType(
  weekday: number,
  weeklyOffDays: readonly number[],
  isHoliday: boolean
): OvertimeDayType {
  if (isHoliday) return "holiday";
  if (weeklyOffDays.includes(weekday)) return "weekly_off";
  return "weekday";
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/// Kiểm tra giờ dự kiến trên phiếu. Trả câu lỗi hoặc null.
export function validatePlannedTimes(start: string, end: string): string | null {
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    return "Giờ phải theo dạng HH:MM";
  }
  if (parseTimeToMinutes(end) <= parseTimeToMinutes(start)) {
    return "Giờ kết thúc phải sau giờ bắt đầu (không kéo qua nửa đêm)";
  }
  return null;
}

export function plannedMinutes(start: string, end: string): number {
  return Math.max(0, parseTimeToMinutes(end) - parseTimeToMinutes(start));
}

export type OvertimeMinutes = {
  minutes: number;
  /// Luôn "ticket": số giờ lấy đúng khoảng "Từ giờ – Đến giờ" ghi trên phiếu.
  source: "ticket";
};

/// Số phút OT của một phiếu, chưa tính phần admin chốt tay: đúng khoảng
/// "Từ giờ – Đến giờ" ghi trên phiếu. Phiếu OT độc lập với chấm công — không
/// đọc giờ vào / ra. Một ngày có nhiều phiếu (vd thứ 7 phiếu sáng + phiếu
/// chiều) thì mỗi phiếu tính khoảng của nó; API chặn khoảng giờ trùng nhau.
/// Các tham số ngày / lịch / chấm công giữ lại cho nơi gọi, không dùng tới.
export function computeOvertimeMinutes(input: {
  dayType: OvertimeDayType;
  scheduled: SessionRule[];
  punches: PunchInput[];
  lunchBreak?: LunchBreak | null;
  plannedStart: string;
  plannedEnd: string;
}): OvertimeMinutes {
  return { minutes: plannedMinutes(input.plannedStart, input.plannedEnd), source: "ticket" };
}

/// Hiển thị số phút OT dạng giờ: 210 -> "3,5".
export function formatOvertimeHours(minutes: number): string {
  return (Math.round((minutes / 60) * 100) / 100).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  });
}
