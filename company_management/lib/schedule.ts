import {
  addMonths,
  dateKeyVN,
  daysInMonth,
  isWeekend,
  listMonthDates,
  monthKeyVN,
} from "@/lib/datetime";

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "intern"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  intern: "Thực tập",
};

/// Ngày trong tháng T mà cửa sổ đăng ký lịch tháng T+1 mở ra.
export const REGISTRATION_OPEN_DAY = 20;

export function isEmploymentType(value: unknown): value is EmploymentType {
  return EMPLOYMENT_TYPES.includes(value as EmploymentType);
}

/// full-time có lịch cố định T2–T6 do hệ thống sinh; part-time và intern tự đăng ký.
export function isSelfScheduled(employmentType: string): boolean {
  return employmentType === "part_time" || employmentType === "intern";
}

/// Tháng đang mở cho đăng ký, hoặc null nếu chưa tới ngày 20.
/// Ví dụ: 20/08 -> "2026-09"; 19/08 -> null.
export function openRegistrationMonth(now: Date = new Date()): string | null {
  const today = dateKeyVN(now);
  const day = Number(today.slice(8, 10));
  if (day < REGISTRATION_OPEN_DAY) return null;
  return addMonths(today.slice(0, 7), 1);
}

export function isRegistrationOpen(month: string, now: Date = new Date()): boolean {
  return openRegistrationMonth(now) === month;
}

/// Mô tả cửa sổ đăng ký của một tháng mục tiêu, để hiển thị cho nhân viên.
export function registrationWindow(targetMonth: string) {
  const previousMonth = addMonths(targetMonth, -1);
  const lastDay = daysInMonth(previousMonth);
  return {
    opensOn: `${previousMonth}-${String(REGISTRATION_OPEN_DAY).padStart(2, "0")}`,
    closesOn: `${previousMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}

/// Lịch mặc định của nhân viên full-time: mọi ngày T2–T6 trong tháng.
export function fullTimeWorkingDates(month: string): string[] {
  return listMonthDates(month).filter((date) => !isWeekend(date));
}

export type ScheduleWindowState = {
  /// Tháng đang mở đăng ký (null nếu ngoài cửa sổ)
  openMonth: string | null;
  /// Tháng đang được xem mặc định
  defaultMonth: string;
};

export function scheduleWindowState(now: Date = new Date()): ScheduleWindowState {
  const openMonth = openRegistrationMonth(now);
  return {
    openMonth,
    defaultMonth: openMonth ?? monthKeyVN(now),
  };
}
