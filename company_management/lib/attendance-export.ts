/// Dựng file Excel của bảng chấm công tháng, để admin gửi kế toán.
/// Chỉ có mã ca theo từng ngày, không có giờ vào/ra chi tiết.
import writeXlsxFile from "write-excel-file/node";
import type { DayStatus } from "@/lib/attendance-rules";

/// Màu nền ô ngày, lấy theo bảng màu của lưới trên giao diện để nhìn quen mắt:
/// xanh = đủ công, vàng = cần để ý, đỏ = vắng, xám = nghỉ/ốm.
const STATUS_STYLE: Partial<
  Record<DayStatus, { backgroundColor: string; color: string }>
> = {
  passed: { backgroundColor: "#D1FAE5", color: "#065F46" },
  late: { backgroundColor: "#FEF3C7", color: "#92400E" },
  insufficient: { backgroundColor: "#FEF3C7", color: "#92400E" },
  missed_out: { backgroundColor: "#FEF3C7", color: "#92400E" },
  unscheduled: { backgroundColor: "#FEF3C7", color: "#92400E" },
  open: { backgroundColor: "#E0F2FE", color: "#0369A1" },
  holiday: { backgroundColor: "#E0F2FE", color: "#0369A1" },
  leave: { backgroundColor: "#F1F5F9", color: "#475569" },
  sick: { backgroundColor: "#F1F5F9", color: "#475569" },
  absent: { backgroundColor: "#FEE2E2", color: "#B91C1C" },
};

const HEADER_STYLE = {
  fontWeight: "bold" as const,
  backgroundColor: "#F1F5F9",
  color: "#0F172A",
  align: "center" as const,
  borderColor: "#CBD5E1",
};

/// Một dòng trong bảng: hồ sơ nhân viên + ô của từng ngày + các cột tổng.
export type AttendanceExportRow = {
  user: {
    employeeCode: string | null;
    name: string;
    email: string;
    employmentLabel: string;
  };
  days: Record<string, { label: string; status: string }>;
  passedDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  sickDays: number;
  totalHours: number;
  sessions: Record<string, number>;
};

export function attendanceFileName(month: string): string {
  return `cham-cong-${month}.xlsx`;
}

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function buildAttendanceWorkbook(input: {
  month: string;
  /// Mọi ngày trong tháng, dạng YYYY-MM-DD.
  dates: string[];
  /// Mã ca đang dùng, mỗi mã một cột đếm ở cuối bảng.
  sessionCodes: string[];
  rows: AttendanceExportRow[];
}): Promise<Buffer> {
  const { month, dates, sessionCodes, rows } = input;

  const header = [
    "Mã NV",
    "Nhân viên",
    "Email",
    "Loại hợp đồng",
    ...dates.map((date) => date.slice(8, 10)),
    "Ngày công",
    "Đi muộn",
    "Vắng",
    "Nghỉ (N)",
    "Ốm (O)",
    "Tổng giờ",
    ...sessionCodes,
  ].map((label) => ({ value: label, type: String, ...HEADER_STYLE }));

  const body = rows.map((row) => [
    { value: row.user.employeeCode ?? "", type: String },
    { value: row.user.name, type: String, fontWeight: "bold" as const },
    { value: row.user.email, type: String },
    { value: row.user.employmentLabel, type: String },
    ...dates.map((date) => {
      const day = row.days[date];
      return {
        value: day?.label ?? "",
        type: String,
        align: "center" as const,
        ...(day ? (STATUS_STYLE[day.status as DayStatus] ?? {}) : {}),
      };
    }),
    ...[
      row.passedDays,
      row.lateDays,
      row.absentDays,
      row.leaveDays,
      row.sickDays,
      row.totalHours,
      ...sessionCodes.map((code) => row.sessions[code] ?? 0),
    ].map((value) => ({ value, type: Number, align: "center" as const })),
  ]);

  return await writeXlsxFile([header, ...body], {
    sheet: `Chấm công ${month}`,
    // Giữ tiêu đề và hai cột định danh khi cuộn ngang qua 31 ngày.
    stickyRowsCount: 1,
    stickyColumnsCount: 2,
    columns: [
      { width: 10 },
      { width: 26 },
      { width: 28 },
      { width: 16 },
      ...dates.map(() => ({ width: 5 })),
      { width: 10 },
      { width: 9 },
      { width: 8 },
      { width: 9 },
      { width: 8 },
      { width: 10 },
      ...sessionCodes.map(() => ({ width: 6 })),
    ],
  }).toBuffer();
}
