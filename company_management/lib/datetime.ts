export const ATTENDANCE_TIME_ZONE = "Asia/Ho_Chi_Minh";

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: ATTENDANCE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: ATTENDANCE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/// Ngày theo lịch Việt Nam, dạng YYYY-MM-DD. Dùng cho mọi khoá ngày công —
/// không bao giờ dùng giờ máy chủ, vì server thường chạy UTC.
export function dateKeyVN(date: Date = new Date()): string {
  return DATE_KEY_FORMATTER.format(date);
}

/// Tháng theo lịch Việt Nam, dạng YYYY-MM.
export function monthKeyVN(date: Date = new Date()): string {
  return dateKeyVN(date).slice(0, 7);
}

/// Số phút tính từ 00:00 giờ Việt Nam.
export function minutesOfDayVN(date: Date): number {
  const [hour, minute] = TIME_FORMATTER.format(date).split(":").map(Number);
  return hour * 60 + minute;
}

/// "08:30" -> 510
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/// 510 -> "08:30"
export function formatMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.round(minutes));
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/// Asia/Ho_Chi_Minh cố định ở UTC+7 quanh năm (không có DST), nên quy đổi
/// "ngày VN + giờ VN" sang mốc thời gian tuyệt đối chỉ là trừ đi 7 giờ.
const VN_UTC_OFFSET_HOURS = 7;

export function vnDateTimeToUtc(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour - VN_UTC_OFFSET_HOURS, minute)
  );
}

export function formatTimeVN(date: Date): string {
  return TIME_FORMATTER.format(date);
}

export function dayNumber(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

/// 0 = Chủ nhật ... 6 = Thứ bảy. Khoá ngày đã là ngày lịch VN nên đọc theo UTC
/// để tránh bị dịch thêm một lần nữa theo timezone máy chủ.
export function weekdayOfDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isWeekend(dateKey: string): boolean {
  const weekday = weekdayOfDateKey(dateKey);
  return weekday === 0 || weekday === 6;
}

/// Cộng/trừ ngày cho khoá YYYY-MM-DD.
export function addDays(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + delta));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

/// Liệt kê mọi ngày từ startDate tới endDate (gồm cả hai đầu).
/// Khoá ngày dạng YYYY-MM-DD so sánh chuỗi là đúng thứ tự thời gian.
export function listDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}


export function isValidMonth(month: string | null | undefined): month is string {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return false;
  const monthNumber = Number(month.slice(5, 7));
  return monthNumber >= 1 && monthNumber <= 12;
}

export function isValidDateKey(date: string | null | undefined): date is string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(date.slice(0, 7));
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function getMonthRange(month: string) {
  const total = daysInMonth(month);
  return {
    daysInMonth: total,
    startDate: `${month}-01`,
    endDate: `${month}-${String(total).padStart(2, "0")}`,
  };
}

export function listMonthDates(month: string): string[] {
  return Array.from(
    { length: daysInMonth(month) },
    (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`
  );
}

/// Cộng/trừ tháng cho khoá YYYY-MM.
export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function weekdayLabel(dateKey: string): string {
  return WEEKDAY_LABELS[weekdayOfDateKey(dateKey)];
}

export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `Tháng ${monthNumber}/${year}`;
}
