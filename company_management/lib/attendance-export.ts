/// Dựng file Excel của bảng chấm công tháng, để admin gửi kế toán.
/// Chỉ có mã ca theo từng ngày, không có giờ vào/ra chi tiết.
import writeXlsxFile from "write-excel-file/node";
import type { DayStatus } from "@/lib/attendance-rules";
import { formatMonthLabel, weekdayLabel } from "@/lib/datetime";

/// Bảng màu lấy theo giao diện web để admin nhìn quen mắt.
const BRAND = "#0284C7";
const BRAND_DARK = "#0369A1";
const GRID = "#CBD5E1";
const ZEBRA = "#F8FAFC";
const WEEKEND = "#E2E8F0";
const HOLIDAY = "#E0F2FE";

/// Màu ô ngày theo trạng thái: xanh = đủ công, vàng = cần để ý, đỏ = vắng,
/// xám = nghỉ/ốm.
const STATUS_STYLE: Partial<
  Record<DayStatus, { backgroundColor: string; textColor: string }>
> = {
  passed: { backgroundColor: "#D1FAE5", textColor: "#065F46" },
  late: { backgroundColor: "#FEF3C7", textColor: "#92400E" },
  insufficient: { backgroundColor: "#FEF3C7", textColor: "#92400E" },
  missed_out: { backgroundColor: "#FEF3C7", textColor: "#92400E" },
  unscheduled: { backgroundColor: "#FEF3C7", textColor: "#92400E" },
  open: { backgroundColor: "#E0F2FE", textColor: "#0369A1" },
  holiday: { backgroundColor: HOLIDAY, textColor: "#0369A1" },
  leave: { backgroundColor: "#F1F5F9", textColor: "#475569" },
  sick: { backgroundColor: "#F1F5F9", textColor: "#475569" },
  absent: { backgroundColor: "#FEE2E2", textColor: "#B91C1C" },
};

/// Khối cột tổng tô xám đậm để tách hẳn khỏi lưới ngày.
const TOTAL_HEAD = "#334155";
const SESSION_HEAD = "#475569";

const CELL_BORDER = { borderColor: GRID, borderStyle: "thin" as const };

const HEAD_CELL = {
  ...CELL_BORDER,
  backgroundColor: BRAND,
  textColor: "#FFFFFF",
  fontWeight: "bold" as const,
  fontSize: 10,
  align: "center" as const,
  alignVertical: "center" as const,
  wrap: true,
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

/// Nhãn của các cột tổng, kèm cờ in đậm cho hai cột kế toán nhìn nhiều nhất.
const SUMMARY_COLUMNS: { label: string; width: number; strong?: boolean }[] = [
  { label: "Ngày công", width: 10, strong: true },
  { label: "Đi muộn", width: 9 },
  { label: "Vắng", width: 8 },
  { label: "Nghỉ (N)", width: 9 },
  { label: "Ốm (O)", width: 8 },
  { label: "Tổng giờ", width: 10, strong: true },
];

export async function buildAttendanceWorkbook(input: {
  month: string;
  /// Mọi ngày trong tháng, dạng YYYY-MM-DD.
  dates: string[];
  /// Mã ca đang dùng, mỗi mã một cột đếm ở cuối bảng.
  sessionCodes: string[];
  rows: AttendanceExportRow[];
  companyName: string;
  /// Ngày lễ trong tháng (khoá ngày -> tên), để tô cột riêng.
  holidays: Record<string, string>;
  /// Ngày nghỉ hằng tuần (0 = CN ... 6 = T7).
  weeklyOffDays: number[];
  /// Ngày xuất file, dạng YYYY-MM-DD theo giờ VN.
  exportedOn: string;
}): Promise<Buffer> {
  const {
    month,
    dates,
    sessionCodes,
    rows,
    companyName,
    holidays,
    weeklyOffDays,
    exportedOn,
  } = input;

  const offDays = new Set(weeklyOffDays);
  const isOffDay = (date: string) =>
    offDays.has(new Date(`${date}T00:00:00Z`).getUTCDay());

  const identityColumns = [
    { label: "STT", width: 6 },
    { label: "Mã NV", width: 11 },
    { label: "Họ và tên", width: 26 },
    { label: "Loại hợp đồng", width: 16 },
    { label: "Email", width: 26 },
  ];
  const totalColumns =
    identityColumns.length +
    dates.length +
    SUMMARY_COLUMNS.length +
    sessionCodes.length;

  /// Ô tiêu đề trên cùng. Chỉ trải qua khối bên trái (hồ sơ + mươi ngày đầu):
  /// gộp hết 48 cột thì tiêu đề rơi vào giữa lưới ngày, mở file lên không thấy.
  const bannerSpan = Math.min(totalColumns, identityColumns.length + 10);
  const bannerRow = (
    value: string,
    style: Record<string, unknown>,
    height: number
  ) => [
    { value, type: String, columnSpan: bannerSpan, height, ...style },
    ...Array.from({ length: totalColumns - 1 }, () => null),
  ];

  const title = [
    bannerRow(
      companyName,
      { fontWeight: "bold", fontSize: 12, textColor: "#0F172A", alignVertical: "center" },
      20
    ),
    bannerRow(
      `BẢNG CHẤM CÔNG ${formatMonthLabel(month).toUpperCase()}`,
      {
        fontWeight: "bold",
        fontSize: 16,
        textColor: BRAND_DARK,
        align: "center",
        alignVertical: "center",
      },
      30
    ),
    bannerRow(
      `Xuất ngày ${exportedOn.slice(8, 10)}/${exportedOn.slice(5, 7)}/${exportedOn.slice(0, 4)}`,
      { fontStyle: "italic", fontSize: 9, textColor: "#64748B", align: "right" },
      16
    ),
    Array.from({ length: totalColumns }, () => null),
  ];

  // Hai dòng tiêu đề: dòng trên là số ngày, dòng dưới là thứ. Các cột không
  // phải ngày thì gộp dọc hai dòng.
  const headerTop = [
    ...identityColumns.map((column) => ({
      value: column.label,
      type: String,
      rowSpan: 2,
      height: 22,
      ...HEAD_CELL,
    })),
    ...dates.map((date) => ({
      value: Number(date.slice(8, 10)),
      type: Number,
      ...HEAD_CELL,
      backgroundColor: holidays[date]
        ? BRAND_DARK
        : isOffDay(date)
          ? BRAND_DARK
          : BRAND,
    })),
    ...SUMMARY_COLUMNS.map((column) => ({
      value: column.label,
      type: String,
      rowSpan: 2,
      ...HEAD_CELL,
      backgroundColor: TOTAL_HEAD,
    })),
    ...sessionCodes.map((code) => ({
      value: code,
      type: String,
      rowSpan: 2,
      ...HEAD_CELL,
      backgroundColor: SESSION_HEAD,
    })),
  ];

  const headerBottom = [
    ...identityColumns.map(() => null),
    ...dates.map((date) => ({
      value: weekdayLabel(date),
      type: String,
      ...CELL_BORDER,
      fontSize: 9,
      align: "center" as const,
      backgroundColor: holidays[date] ? HOLIDAY : isOffDay(date) ? WEEKEND : "#E0F2FE",
      textColor: "#0C4A6E",
    })),
    ...SUMMARY_COLUMNS.map(() => null),
    ...sessionCodes.map(() => null),
  ];

  const body = rows.map((row, index) => {
    const stripe = index % 2 === 1 ? ZEBRA : undefined;
    const text = (value: string, extra: Record<string, unknown> = {}) => ({
      value,
      type: String,
      ...CELL_BORDER,
      backgroundColor: stripe,
      alignVertical: "center" as const,
      fontSize: 10,
      ...extra,
    });

    return [
      text(String(index + 1), { align: "center" }),
      text(row.user.employeeCode ?? "", { align: "center" }),
      text(row.user.name, { fontWeight: "bold" }),
      text(row.user.employmentLabel),
      text(row.user.email, { textColor: "#64748B", fontSize: 9 }),
      ...dates.map((date) => {
        const day = row.days[date];
        const status = day ? STATUS_STYLE[day.status as DayStatus] : undefined;
        return {
          value: day?.label ?? "",
          type: String,
          ...CELL_BORDER,
          height: 18,
          align: "center" as const,
          alignVertical: "center" as const,
          fontSize: 10,
          fontWeight: day?.label ? ("bold" as const) : undefined,
          backgroundColor:
            status?.backgroundColor ??
            (holidays[date] ? HOLIDAY : isOffDay(date) ? WEEKEND : stripe),
          textColor: status?.textColor,
        };
      }),
      ...SUMMARY_COLUMNS.map((column, position) => ({
        value: [
          row.passedDays,
          row.lateDays,
          row.absentDays,
          row.leaveDays,
          row.sickDays,
          row.totalHours,
        ][position],
        type: Number,
        format: column.label === "Tổng giờ" ? "0.0" : "0",
        ...CELL_BORDER,
        align: "center" as const,
        alignVertical: "center" as const,
        fontWeight: column.strong ? ("bold" as const) : undefined,
        backgroundColor: stripe ?? "#FFFFFF",
      })),
      ...sessionCodes.map((code) => ({
        value: row.sessions[code] ?? 0,
        type: Number,
        format: "0",
        ...CELL_BORDER,
        align: "center" as const,
        alignVertical: "center" as const,
        backgroundColor: stripe,
      })),
    ];
  });

  // Dòng tổng cuối bảng: cộng dọc các cột số, để kế toán không phải tự tính.
  const sum = (pick: (row: AttendanceExportRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const footerStyle = {
    ...CELL_BORDER,
    backgroundColor: "#F1F5F9",
    fontWeight: "bold" as const,
    align: "center" as const,
    alignVertical: "center" as const,
  };
  const footer = [
    {
      value: "TỔNG CỘNG",
      type: String,
      columnSpan: identityColumns.length,
      height: 20,
      ...footerStyle,
    },
    ...Array.from({ length: identityColumns.length - 1 }, () => null),
    ...dates.map(() => ({ value: "", type: String, ...footerStyle })),
    ...[
      sum((row) => row.passedDays),
      sum((row) => row.lateDays),
      sum((row) => row.absentDays),
      sum((row) => row.leaveDays),
      sum((row) => row.sickDays),
      Math.round(sum((row) => row.totalHours) * 10) / 10,
    ].map((value, position) => ({
      value,
      type: Number,
      format: position === 5 ? "0.0" : "0",
      ...footerStyle,
      backgroundColor: "#E2E8F0",
    })),
    ...sessionCodes.map((code) => ({
      value: sum((row) => row.sessions[code] ?? 0),
      type: Number,
      format: "0",
      ...footerStyle,
      backgroundColor: "#E2E8F0",
    })),
  ];

  return await writeXlsxFile(
    [...title, headerTop, headerBottom, ...body, ...(rows.length > 0 ? [footer] : [])],
    {
      sheet: `Chấm công ${month.slice(5)}-${month.slice(0, 4)}`,
      // Giữ khối tiêu đề và ba cột định danh khi cuộn qua 31 ngày.
      stickyRowsCount: title.length + 2,
      stickyColumnsCount: 3,
      showGridLines: false,
      orientation: "landscape",
      columns: [
        ...identityColumns.map((column) => ({ width: column.width })),
        ...dates.map(() => ({ width: 5.5 })),
        ...SUMMARY_COLUMNS.map((column) => ({ width: column.width })),
        ...sessionCodes.map(() => ({ width: 6 })),
      ],
    }
  ).toBuffer();
}
