/// Phần thuần logic của bảng công chốt (không đụng database) để test được;
/// đọc DB ở lib/final-timesheet.ts.

export type FinalStatus = "work" | "leave" | "sick" | "absent" | "holiday" | "off";

export type FinalDay = {
  status: FinalStatus;
  /// Mã ca ghi trên ô khi status = work; rỗng thì ghi CN (1 công) / S (nửa công).
  codes: string[];
  workday: number;
};

export const FINAL_STATUSES: FinalStatus[] = ["work", "leave", "sick", "absent", "holiday", "off"];

/// Trạng thái ô của lưới tháng tương ứng với lựa chọn của admin.
export const FINAL_TO_DAY_STATUS: Record<FinalStatus, string> = {
  work: "passed",
  leave: "leave",
  sick: "sick",
  absent: "absent",
  holiday: "holiday",
  off: "off",
};

/// Ký hiệu ô: mã ca S / C / CN.
export function finalDayLabel(day: FinalDay): string {
  switch (day.status) {
    case "work":
      return day.codes.join("+") || (day.workday >= 1 ? "CN" : "S");
    case "leave":
      return "N";
    case "sick":
      return "O";
    case "absent":
      return "V";
    case "holiday":
      return "L";
    default:
      return "";
  }
}

/// Kiểm tra dữ liệu admin gửi lên. Trả câu lỗi hoặc null.
export function validateFinalDay(day: FinalDay): string | null {
  if (!FINAL_STATUSES.includes(day.status)) return "Lựa chọn không hợp lệ";
  if (!Array.isArray(day.codes) || day.codes.some((code) => typeof code !== "string" || code.length > 10)) {
    return "Mã ca không hợp lệ";
  }
  if (!Number.isFinite(day.workday) || day.workday < 0 || day.workday > 3 || Math.round(day.workday * 2) !== day.workday * 2) {
    return "Số công phải là bội của 0,5 (0 – 3)";
  }
  if (day.status === "work" && day.workday <= 0) return "Ngày có công phải lớn hơn 0";
  return null;
}

