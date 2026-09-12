import {
  addMonths,
  dateKeyVN,
  daysInMonth,
  listMonthDates,
  monthKeyVN,
  weekdayOfDateKey,
} from "@/lib/datetime";


export const EMPLOYMENT_TYPES = ["full_time", "part_time", "intern"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  intern: "Thực tập",
};

/// Cửa sổ đăng ký lịch tháng T+1 nằm trong tháng T: mở từ ngày `openDay`,
/// đóng sau hết ngày `closeDay`. Admin đặt ở trang Lịch làm việc, lưu trong
/// Settings `schedule_registration_window` dạng "20-31".
export type RegistrationWindowConfig = { openDay: number; closeDay: number };

/// Mặc định như trước khi cấu hình được: mở ngày 20, đóng khi hết tháng.
/// 31 nghĩa là "ngày cuối tháng" — tháng ngắn hơn thì tự kẹp lại.
export const DEFAULT_REGISTRATION_WINDOW: RegistrationWindowConfig = {
  openDay: 20,
  closeDay: 31,
};

export const MAX_REGISTRATION_DAY = 31;

/// Đọc chuỗi lưu trong Settings, dạng "20-31". Rỗng hoặc sai dạng thì dùng
/// mặc định, để một dòng Settings hỏng không khoá luôn việc đăng ký.
export function parseRegistrationWindow(
  value: string | null | undefined
): RegistrationWindowConfig {
  const parts = String(value ?? "").trim().split("-");
  if (parts.length !== 2) return { ...DEFAULT_REGISTRATION_WINDOW };
  const openDay = Number(parts[0]);
  const closeDay = Number(parts[1]);
  if (validateRegistrationWindow({ openDay, closeDay })) {
    return { ...DEFAULT_REGISTRATION_WINDOW };
  }
  return { openDay, closeDay };
}

export function formatRegistrationWindow(config: RegistrationWindowConfig): string {
  return `${config.openDay}-${config.closeDay}`;
}

/// Thông báo lỗi tiếng Việt, hoặc null nếu hợp lệ. Dùng chung cho API và giao
/// diện admin để hai bên không lệch luật.
export function validateRegistrationWindow(
  config: RegistrationWindowConfig
): string | null {
  const { openDay, closeDay } = config;
  for (const day of [openDay, closeDay]) {
    if (!Number.isInteger(day) || day < 1 || day > MAX_REGISTRATION_DAY) {
      return `Ngày phải là số nguyên từ 1 đến ${MAX_REGISTRATION_DAY}`;
    }
  }
  if (closeDay < openDay) return "Ngày đóng phải từ ngày mở trở đi";
  return null;
}

/// Ngày mở/đóng thực tế của một tháng cụ thể: tháng ngắn hơn cấu hình thì kẹp
/// về ngày cuối tháng, nên đặt 31 luôn có nghĩa là "hết tháng".
function windowDaysIn(month: string, config: RegistrationWindowConfig) {
  const lastDay = daysInMonth(month);
  return {
    openDay: Math.min(config.openDay, lastDay),
    closeDay: Math.min(config.closeDay, lastDay),
  };
}

export function isEmploymentType(value: unknown): value is EmploymentType {
  return EMPLOYMENT_TYPES.includes(value as EmploymentType);
}

/// full-time có lịch cố định do hệ thống sinh (trừ ngày nghỉ hằng tuần);
/// part-time và intern tự đăng ký.
export function isSelfScheduled(employmentType: string): boolean {
  return employmentType === "part_time" || employmentType === "intern";
}

/// Tháng đang mở cho đăng ký, hoặc null nếu hôm nay nằm ngoài cửa sổ.
/// Ví dụ với cấu hình 20-31: 20/08 -> "2026-09"; 19/08 -> null.
export function openRegistrationMonth(
  config: RegistrationWindowConfig = DEFAULT_REGISTRATION_WINDOW,
  now: Date = new Date()
): string | null {
  const today = dateKeyVN(now);
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const { openDay, closeDay } = windowDaysIn(month, config);
  if (day < openDay || day > closeDay) return null;
  return addMonths(month, 1);
}

export function isRegistrationOpen(
  month: string,
  config: RegistrationWindowConfig = DEFAULT_REGISTRATION_WINDOW,
  now: Date = new Date()
): boolean {
  return openRegistrationMonth(config, now) === month;
}

/// Mô tả cửa sổ đăng ký của một tháng mục tiêu, để hiển thị cho nhân viên.
export function registrationWindow(
  targetMonth: string,
  config: RegistrationWindowConfig = DEFAULT_REGISTRATION_WINDOW
) {
  const previousMonth = addMonths(targetMonth, -1);
  const { openDay, closeDay } = windowDaysIn(previousMonth, config);
  return {
    opensOn: `${previousMonth}-${String(openDay).padStart(2, "0")}`,
    closesOn: `${previousMonth}-${String(closeDay).padStart(2, "0")}`,
  };
}

/// Ngày nghỉ hằng tuần mặc định: Chủ nhật (0) và Thứ 7 (6).
/// Admin đổi được trong trang Ngày lễ; giá trị lưu ở Settings.weekly_off_days.
export const DEFAULT_WEEKLY_OFF_DAYS: readonly number[] = [0, 6];

/// Lịch mặc định của nhân viên full-time: mọi ngày trong tháng
/// KHÔNG rơi vào ngày nghỉ hằng tuần do admin cấu hình.
export function fullTimeWorkingDates(
  month: string,
  weeklyOffDays: readonly number[] = DEFAULT_WEEKLY_OFF_DAYS
): string[] {
  const off = new Set(weeklyOffDays);
  return listMonthDates(month).filter((date) => !off.has(weekdayOfDateKey(date)));
}


export type ScheduleWindowState = {
  /// Tháng đang mở đăng ký (null nếu ngoài cửa sổ)
  openMonth: string | null;
  /// Tháng đang được xem mặc định
  defaultMonth: string;
};

export function scheduleWindowState(
  config: RegistrationWindowConfig = DEFAULT_REGISTRATION_WINDOW,
  now: Date = new Date()
): ScheduleWindowState {
  const openMonth = openRegistrationMonth(config, now);
  return {
    openMonth,
    defaultMonth: openMonth ?? monthKeyVN(now),
  };
}

/// Ca trọn ngày loại trừ ca sáng và ca chiều; ca sáng và ca chiều loại trừ
/// nhau; các ca khác (tăng ca) cộng thêm được. Dùng chung cho lưới đăng ký
/// của nhân viên và form xếp lịch của admin để hai bên không lệch quy tắc.
export const FULL_DAY_CODE = "CN";
export const HALF_DAY_CODES: readonly string[] = ["S", "C"];

export function toggleSessionSelection(
  selected: readonly string[],
  sessionId: string,
  codeById: ReadonlyMap<string, string>
): string[] {
  if (selected.includes(sessionId)) {
    return selected.filter((id) => id !== sessionId);
  }

  const code = codeById.get(sessionId) ?? "";
  if (code === FULL_DAY_CODE) {
    return [
      ...selected.filter(
        (id) => !HALF_DAY_CODES.includes(codeById.get(id) ?? "")
      ),
      sessionId,
    ];
  }
  if (HALF_DAY_CODES.includes(code)) {
    return [
      ...selected.filter((id) => {
        const other = codeById.get(id) ?? "";
        return other !== FULL_DAY_CODE && !HALF_DAY_CODES.includes(other);
      }),
      sessionId,
    ];
  }
  return [...selected, sessionId];
}
