/// Dựng file Excel của bảng chấm công tháng, để admin gửi kế toán.
/// Ký hiệu theo mẫu kế toán đang dùng: full-time ghi x (một công) / x/2 (nửa
/// công), part-time và thực tập ghi mã ca đã làm (S / C / CN). Không có giờ
/// vào/ra chi tiết.
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
    employmentType: string;
    employmentLabel: string;
  };
  days: Record<string, AccountingDay>;
  /// Tổng số công trong tháng (có thể lẻ nửa ngày).
  workdays: number;
  /// Phút OT đã duyệt theo ký hiệu T / T1 / T2.
  overtimeMinutes: Record<string, number>;
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

/// Ký hiệu một ô ngày cho kế toán. Ngày có công: full-time ghi x / x/2,
/// người tự đăng ký ca ghi mã ca. Các trạng thái khác giữ ký hiệu của lưới
/// (N nghỉ, O ốm, V vắng, L lễ, ? quên checkout...).
export type AccountingDay = {
  label: string;
  status: string;
  codes: string[];
  workdayValue: number;
  /// Phiếu OT đã duyệt của ngày (ký hiệu T / T1 / T2).
  overtime?: { code: string; minutes: number } | null;
};

export function accountingCellLabel(day: AccountingDay, employmentType: string): string {
  const otCode = day.overtime?.code;
  let base: string;
  if (day.status === "holiday") {
    base = "L";
  } else if (day.workdayValue <= 0) {
    // Ngày chỉ có OT (vd full-time làm thứ 7): chỉ ghi ký hiệu OT.
    if (otCode) return otCode;
    base = day.label;
  } else {
    const mark = day.workdayValue >= 1 ? "x" : "x/2";
    base = employmentType === "full_time" ? mark : day.codes.join("+") || mark;
  }
  return otCode ? `${base}+${otCode}` : base;
}

/// Ba cột giờ OT ở cuối bảng, theo thứ tự hệ số tăng dần.
const OVERTIME_COLUMN_CODES = ["T", "T1", "T2"];

/// Ngày công lẻ nửa ngày thì hiện 1 chữ số thập phân, chẵn thì số nguyên.
const WORKDAY_FORMAT = "0.##";

/// Nhãn của các cột tổng, kèm cờ in đậm cho các cột kế toán nhìn nhiều nhất.
const SUMMARY_COLUMNS: {
  label: string;
  width: number;
  strong?: boolean;
  format: string;
}[] = [
  { label: "Ngày công", width: 10, strong: true, format: WORKDAY_FORMAT },
  { label: "Ngày công tháng", width: 10, strong: true, format: "0" },
  { label: "Đi muộn", width: 9, format: "0" },
  { label: "Vắng", width: 8, format: "0" },
  { label: "Nghỉ (N)", width: 9, format: "0" },
  { label: "Ốm (O)", width: 8, format: "0" },
  { label: "Tổng giờ", width: 10, strong: true, format: "0.0" },
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
  /// Ngày công tháng (công chuẩn), giống nhau cho mọi người.
  standardWorkdays: number;
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
    standardWorkdays,
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
    OVERTIME_COLUMN_CODES.length +
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
    ...OVERTIME_COLUMN_CODES.map((code) => ({
      value: `OT ${code} (giờ)`,
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
    ...OVERTIME_COLUMN_CODES.map(() => null),
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
        const label = day ? accountingCellLabel(day, row.user.employmentType) : "";
        return {
          value: label,
          type: String,
          ...CELL_BORDER,
          height: 18,
          align: "center" as const,
          alignVertical: "center" as const,
          fontSize: 10,
          fontWeight: label ? ("bold" as const) : undefined,
          backgroundColor:
            status?.backgroundColor ??
            (holidays[date] ? HOLIDAY : isOffDay(date) ? WEEKEND : stripe),
          textColor: status?.textColor,
        };
      }),
      ...SUMMARY_COLUMNS.map((column, position) => ({
        value: [
          row.workdays,
          standardWorkdays,
          row.lateDays,
          row.absentDays,
          row.leaveDays,
          row.sickDays,
          row.totalHours,
        ][position],
        type: Number,
        format: column.format,
        ...CELL_BORDER,
        align: "center" as const,
        alignVertical: "center" as const,
        fontWeight: column.strong ? ("bold" as const) : undefined,
        backgroundColor: stripe ?? "#FFFFFF",
      })),
      ...OVERTIME_COLUMN_CODES.map((code) => ({
        value: Math.round(((row.overtimeMinutes[code] ?? 0) / 60) * 100) / 100,
        type: Number,
        format: "0.##",
        ...CELL_BORDER,
        align: "center" as const,
        alignVertical: "center" as const,
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
      sum((row) => row.workdays),
      null,
      sum((row) => row.lateDays),
      sum((row) => row.absentDays),
      sum((row) => row.leaveDays),
      sum((row) => row.sickDays),
      Math.round(sum((row) => row.totalHours) * 10) / 10,
    ].map((value, position) =>
      value === null
        ? { value: "", type: String, ...footerStyle, backgroundColor: "#E2E8F0" }
        : {
            value,
            type: Number,
            format: SUMMARY_COLUMNS[position].format,
            ...footerStyle,
            backgroundColor: "#E2E8F0",
          }
    ),
    ...OVERTIME_COLUMN_CODES.map((code) => ({
      value: Math.round((sum((row) => row.overtimeMinutes[code] ?? 0) / 60) * 100) / 100,
      type: Number,
      format: "0.##",
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
        ...OVERTIME_COLUMN_CODES.map(() => ({ width: 9 })),
        ...sessionCodes.map(() => ({ width: 6 })),
      ],
    }
  ).toBuffer();
}

/// Một dòng ngày trong file chi tiết của một nhân viên.
export type EmployeeExportDay = {
  date: string;
  holidayName: string | null;
  scheduledCodes: string[];
  firstIn: string | null;
  lastOut: string | null;
  workedHours: number;
  workdayValue: number;
  overtime: { code: string; minutes: number; place: string | null } | null;
  statusLabel: string;
  note: string | null;
};

export function employeeAttendanceFileName(
  month: string,
  employeeCode: string | null,
  userId: string
): string {
  return `cham-cong-${month}-${employeeCode || userId.slice(0, 8)}.xlsx`;
}

/// File chấm công chi tiết của một nhân viên trong tháng: mỗi ngày một dòng,
/// có giờ vào / ra để đối chiếu khi kế toán hoặc nhân viên thắc mắc.
export async function buildEmployeeAttendanceWorkbook(input: {
  month: string;
  companyName: string;
  user: {
    name: string;
    employeeCode: string | null;
    employmentLabel: string;
    department: string | null;
  };
  days: EmployeeExportDay[];
  workdays: number;
  standardWorkdays: number;
  weeklyOffDays: number[];
  exportedOn: string;
}): Promise<Buffer> {
  const { month, companyName, user, days, workdays, standardWorkdays, exportedOn } =
    input;
  const offDays = new Set(input.weeklyOffDays);

  const columns = [
    { label: "Ngày", width: 11 },
    { label: "Thứ", width: 6 },
    { label: "Ca", width: 10 },
    { label: "Giờ vào", width: 9 },
    { label: "Giờ ra", width: 9 },
    { label: "Giờ làm", width: 9 },
    { label: "Công", width: 7 },
    { label: "OT", width: 11 },
    { label: "Trạng thái", width: 16 },
    { label: "Ghi chú", width: 34 },
  ];
  const span = columns.length;
  const line = (value: string, style: Record<string, unknown> = {}) => [
    { value, type: String, columnSpan: span, ...style },
    ...Array.from({ length: span - 1 }, () => null),
  ];

  const header = [
    line(companyName, { fontWeight: "bold", fontSize: 12 }),
    line(`BẢNG CHẤM CÔNG CHI TIẾT ${formatMonthLabel(month).toUpperCase()}`, {
      fontWeight: "bold",
      fontSize: 15,
      textColor: BRAND_DARK,
      align: "center",
      height: 26,
    }),
    line(
      [
        `Họ tên: ${user.name}`,
        user.employeeCode ? `Mã NV: ${user.employeeCode}` : null,
        user.employmentLabel,
        user.department,
      ]
        .filter(Boolean)
        .join("   ·   "),
      { fontSize: 10 }
    ),
    line(
      `Xuất ngày ${exportedOn.slice(8, 10)}/${exportedOn.slice(5, 7)}/${exportedOn.slice(0, 4)}`,
      { fontStyle: "italic", fontSize: 9, textColor: "#64748B", align: "right" }
    ),
    columns.map((column) => ({ value: column.label, type: String, ...HEAD_CELL, height: 22 })),
  ];

  const body = days.map((day) => {
    const isOff = offDays.has(new Date(`${day.date}T00:00:00Z`).getUTCDay());
    const background = day.holidayName ? HOLIDAY : isOff ? WEEKEND : undefined;
    const cell = (
      value: string | number,
      extra: Record<string, unknown> = {}
    ) => ({
      value,
      type: typeof value === "number" ? Number : String,
      ...CELL_BORDER,
      fontSize: 10,
      alignVertical: "center" as const,
      backgroundColor: background,
      ...extra,
    });
    return [
      cell(`${day.date.slice(8, 10)}/${day.date.slice(5, 7)}/${day.date.slice(0, 4)}`, {
        align: "center",
      }),
      cell(weekdayLabel(day.date), { align: "center" }),
      cell(day.scheduledCodes.join("+"), { align: "center" }),
      cell(day.firstIn ?? "", { align: "center" }),
      cell(day.lastOut ?? "", { align: "center" }),
      day.workedHours > 0
        ? cell(day.workedHours, { format: "0.0", align: "center" })
        : cell(""),
      day.workdayValue > 0
        ? cell(day.workdayValue, { format: WORKDAY_FORMAT, align: "center", fontWeight: "bold" })
        : cell(""),
      cell(
        day.overtime
          ? `${day.overtime.code} · ${Math.round((day.overtime.minutes / 60) * 100) / 100}h`
          : "",
        { align: "center" }
      ),
      cell(day.holidayName ? `Lễ: ${day.holidayName}` : day.statusLabel),
      cell(
        [day.note, day.overtime?.place ? `OT: ${day.overtime.place}` : null]
          .filter(Boolean)
          .join(" · "),
        { wrap: true }
      ),
    ];
  });

  const totalHours =
    Math.round(days.reduce((sum, day) => sum + day.workedHours, 0) * 10) / 10;
  const overtimeHours =
    Math.round(
      (days.reduce((sum, day) => sum + (day.overtime?.minutes ?? 0), 0) / 60) * 100
    ) / 100;
  const footStyle = {
    ...CELL_BORDER,
    backgroundColor: "#E2E8F0",
    fontWeight: "bold" as const,
    alignVertical: "center" as const,
  };
  const footer = [
    { value: "TỔNG", type: String, columnSpan: 5, ...footStyle, align: "center" as const },
    null,
    null,
    null,
    null,
    { value: totalHours, type: Number, format: "0.0", ...footStyle, align: "center" as const },
    { value: workdays, type: Number, format: WORKDAY_FORMAT, ...footStyle, align: "center" as const },
    { value: `${overtimeHours}h`, type: String, ...footStyle, align: "center" as const },
    {
      value: `Ngày công tháng: ${standardWorkdays}`,
      type: String,
      columnSpan: 2,
      ...footStyle,
    },
    null,
  ];

  return await writeXlsxFile([...header, ...body, footer], {
    sheet: `Chấm công ${month.slice(5)}-${month.slice(0, 4)}`,
    stickyRowsCount: header.length,
    showGridLines: false,
    columns: columns.map((column) => ({ width: column.width })),
  }).toBuffer();
}
