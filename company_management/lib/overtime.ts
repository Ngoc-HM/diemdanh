import {
  LunchBreak,
  pairPunches,
  PunchInput,
  SessionRule,
} from "@/lib/attendance-rules";
import { parseTimeToMinutes, minutesOfDayVN } from "@/lib/datetime";

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
  /// "punches" = tính từ chấm công; "planned" = không đủ giờ vào/ra nên lấy
  /// giờ dự kiến trên phiếu.
  source: "punches" | "planned";
};

/// Số phút OT của một phiếu, chưa tính phần admin chốt tay.
///  - Ngày lễ: cả thời gian làm trong ngày (công ngày lễ đã trả riêng).
///  - Ngày có ca chính (số công > 0): phần làm sau giờ hết ca chính muộn nhất.
///  - Ngày không có ca chính (ngày nghỉ, hoặc không đăng ký): cả thời gian làm.
/// Đều đã trừ giờ nghỉ trưa. Không có đủ giờ vào và giờ ra thì lấy giờ dự kiến.
export function computeOvertimeMinutes(input: {
  dayType: OvertimeDayType;
  scheduled: SessionRule[];
  punches: PunchInput[];
  lunchBreak?: LunchBreak | null;
  plannedStart: string;
  plannedEnd: string;
}): OvertimeMinutes {
  const { dayType, scheduled, punches, lunchBreak = null } = input;
  const paired = pairPunches(punches, lunchBreak);
  if (!paired.firstIn || !paired.lastOut || paired.openSince) {
    return {
      minutes: plannedMinutes(input.plannedStart, input.plannedEnd),
      source: "planned",
    };
  }

  const regular = scheduled.filter((rule) => (rule.workdayValue ?? 1) > 0);
  if (dayType === "holiday" || regular.length === 0) {
    return { minutes: Math.round(paired.workedMinutes), source: "punches" };
  }

  const regularEnd = Math.max(...regular.map((rule) => parseTimeToMinutes(rule.workEnd)));
  const from = Math.max(regularEnd, minutesOfDayVN(paired.firstIn));
  const to = minutesOfDayVN(paired.lastOut);
  if (to <= from) return { minutes: 0, source: "punches" };
  const lunch = lunchBreak
    ? Math.max(0, Math.min(to, lunchBreak.end) - Math.max(from, lunchBreak.start))
    : 0;
  return { minutes: Math.max(0, to - from - lunch), source: "punches" };
}

/// Hiển thị số phút OT dạng giờ: 210 -> "3,5".
export function formatOvertimeHours(minutes: number): string {
  return (Math.round((minutes / 60) * 100) / 100).toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
  });
}
