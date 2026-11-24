/// File Excel bảng lương — theo mẫu "Bảng chi tiết lương" và "Bảng chấm công
/// làm thêm giờ" kế toán đang dùng. Admin tự tải, không gửi email.
import writeXlsxFile from "write-excel-file/node";
import {
  attendanceSheet,
  accountingCellLabel,
  employeeOvertimeSheet,
  fixDecimalFormats,
  type DayPunchTimes,
} from "@/lib/attendance-export";
import { DAY_STATUS_LABELS, LATE_COUNTED_STATUSES, sumLateMinutes, type DayStatus } from "@/lib/attendance-rules";
import { isOffDate } from "@/lib/schedule";
import { weekdayLabel } from "@/lib/datetime";
import { PayrollRow, PayrollSheet } from "@/lib/payroll-service";
import { PAY_BASIS_LABELS, TAX_MODE_LABELS } from "@/lib/payroll";

const BRAND = "#0284C7";
const BRAND_DARK = "#0369A1";
const GRID = "#CBD5E1";
const BORDER = { borderColor: GRID, borderStyle: "thin" as const };
const MONEY = "#,##0";
const DAYS = "0.##"; // fixDecimalFormats đổi theo từng giá trị
const HEAD = {
  ...BORDER,
  backgroundColor: BRAND,
  textColor: "#FFFFFF",
  fontWeight: "bold" as const,
  fontSize: 10,
  align: "center" as const,
  alignVertical: "center" as const,
  wrap: true,
};

type Cell = Record<string, unknown> | null;

const dmy = (dateKey: string) =>
  `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}/${dateKey.slice(0, 4)}`;

const monthTitle = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;

/// Tỉ lệ kiểu Việt: 1,5 thay vì 1.5.
const pct = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/// Dòng ghi chú trạng thái: đã chốt hay đang tạm tính.
function statusNote(sheet: PayrollSheet): string {
  if (sheet.closed) {
    const at = new Date(sheet.closed.closedAt).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    return `Đã chốt lương lúc ${at}.`;
  }
  return sheet.projected
    ? `Tạm tính ngày ${dmy(sheet.computedOn)}: từ ngày này đến hết tháng tính là đi làm đủ theo lịch.`
    : `Tạm tính ngày ${dmy(sheet.computedOn)} — chưa chốt lương.`;
}

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/// "Tháng 11 năm 2026"
const monthWords = (month: string) => `Tháng ${Number(month.slice(5, 7))} năm ${month.slice(0, 4)}`;

/// Bỏ ký tự không hợp lệ trong tên file trên Windows / macOS.
const safeName = (value: string) => value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

export function companyPayrollFileName(month: string) {
  return `Bảng lương công ty - ${monthWords(month)}.xlsx`;
}

/// "FT001 - Lê Tiến Thức - Tháng 11 năm 2026.xlsx"
export function payslipFileName(month: string, row: PayrollRow) {
  const parts = [row.user.employeeCode, row.user.name].filter(Boolean).map((part) => safeName(part!));
  return `${parts.join(" - ") || "Nhân viên"} - ${monthWords(month)}.xlsx`;
}

export function employeePayslipsZipName(month: string) {
  return `Bảng lương từng người - ${monthWords(month)}.zip`;
}

/// Content-Disposition cho tên file tiếng Việt: kèm bản ASCII cho trình duyệt cũ.
export function attachmentHeader(fileName: string) {
  const ascii = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// ------------------------------------------------------------ bảng toàn công ty

function salarySheet(sheet: PayrollSheet, companyName: string) {
  const allowanceNames = sheet.allowanceNames;
  const { insurance } = sheet.config;
  const columns: { label: string; width: number; value: (row: PayrollRow) => string | number; format?: string }[] = [
    { label: "Họ và tên", width: 24, value: (row) => row.user.name },
    { label: "Chức vụ", width: 14, value: (row) => row.user.position ?? "" },
    {
      label: "Giới tính",
      width: 8,
      value: (row) => (row.profile.gender === "male" ? "Nam" : row.profile.gender === "female" ? "Nữ" : ""),
    },
    { label: "Loại HĐ", width: 10, value: (row) => row.contractLabel },
    { label: "Hình thức", width: 8, value: (row) => PAY_BASIS_LABELS[row.payroll.payBasis] },
    {
      label: "Lương cơ bản",
      width: 13,
      value: (row) => row.payroll.baseSalary,
      format: MONEY,
    },
    {
      label: "Lương thử việc",
      width: 13,
      value: (row) =>
        row.profile.contractType === "probation" && row.payroll.probationWorkdays !== 0
          ? row.payroll.appliedSalary
          : "",
      format: MONEY,
    },
    { label: "Ngày công", width: 8, value: (row) => row.payroll.workdays, format: DAYS },
    { label: "Phép năm", width: 7, value: (row) => row.payroll.paidLeaveDays, format: DAYS },
    { label: "Ngày công tháng", width: 8, value: (row) => row.payroll.standardWorkdays, format: "0" },
    { label: "Phút đi muộn", width: 8, value: (row) => row.attendance.lateMinutes ?? sumLateMinutes(Object.values(row.attendance.days)), format: "0" },
    { label: "Thành tiền", width: 13, value: (row) => row.payroll.earned, format: MONEY },
    ...allowanceNames.map((name) => ({
      label: name,
      width: 12,
      value: (row: PayrollRow) =>
        row.payroll.allowances.find((item) => item.name === name)?.amount ?? "",
      format: MONEY,
    })),
    { label: "Lương OT", width: 12, value: (row) => row.payroll.overtimeTotal || "", format: MONEY },
    ...(sheet.rows.some((row) => row.payroll.payBasis === "net")
      ? [
          {
            label: "Bù thuế & BH (NET)",
            width: 13,
            value: (row: PayrollRow) => row.payroll.netGrossUp || "",
            format: MONEY,
          },
        ]
      : []),
    { label: "Tổng TT", width: 13, value: (row) => row.payroll.gross, format: MONEY },
    { label: `BHXH ${pct(insurance.bhxh)}%`, width: 11, value: (row) => row.payroll.insurance.bhxh || "", format: MONEY },
    { label: `BHYT ${pct(insurance.bhyt)}%`, width: 11, value: (row) => row.payroll.insurance.bhyt || "", format: MONEY },
    { label: `BHTN ${pct(insurance.bhtn)}%`, width: 11, value: (row) => row.payroll.insurance.bhtn || "", format: MONEY },
    {
      label: "Giảm trừ gia cảnh",
      width: 13,
      value: (row) => row.payroll.personalDeduction + row.payroll.dependentDeduction,
      format: MONEY,
    },
    { label: "Thu nhập tính thuế", width: 13, value: (row) => row.payroll.taxableIncome, format: MONEY },
    { label: "Thuế TNCN", width: 11, value: (row) => row.payroll.tax, format: MONEY },
    { label: "Tổng lương thực nhận", width: 14, value: (row) => row.payroll.net, format: MONEY },
    { label: "STK", width: 18, value: (row) => row.profile.bankAccount ?? "" },
    { label: "Ngân hàng", width: 14, value: (row) => row.profile.bankName ?? "" },
  ];
  const width = columns.length + 1;
  const line = (value: string, style: Record<string, unknown> = {}): Cell[] => [
    { value, type: String, columnSpan: width, ...style },
    ...Array.from({ length: width - 1 }, () => null),
  ];

  const header: Cell[][] = [
    line("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { fontWeight: "bold", align: "center" }),
    line("Độc lập - Tự do - Hạnh phúc", { fontWeight: "bold", align: "center" }),
    line("BẢNG CHI TIẾT LƯƠNG THU NHẬP CÁ NHÂN", {
      fontWeight: "bold",
      fontSize: 15,
      textColor: BRAND_DARK,
      align: "center",
      height: 26,
    }),
    line(`Tên cơ quan chi trả thu nhập: ${companyName}`),
    line(`THÁNG ${monthTitle(sheet.month)}`, { fontWeight: "bold", align: "center" }),
    line(statusNote(sheet), { fontStyle: "italic", fontSize: 9, textColor: "#64748B" }),
    [
      { value: "STT", type: String, ...HEAD, height: 34 },
      ...columns.map((column) => ({ value: column.label, type: String, ...HEAD })),
    ],
  ];

  const body: Cell[][] = sheet.rows.map((row, index) => [
    { value: index + 1, type: Number, ...BORDER, align: "center" as const },
    ...columns.map((column) => {
      const value = column.value(row);
      return typeof value === "number"
        ? { value, type: Number, format: column.format, ...BORDER }
        : { value, type: String, ...BORDER };
    }),
  ]);

  const sumOf = (pick: (row: PayrollRow) => number) =>
    sheet.rows.reduce((total, row) => total + pick(row), 0);
  const totalsByLabel: Record<string, number> = {
    "Thành tiền": sumOf((row) => row.payroll.earned),
    "Lương OT": sumOf((row) => row.payroll.overtimeTotal),
    "Bù thuế & BH (NET)": sumOf((row) => row.payroll.netGrossUp),
    "Tổng TT": sumOf((row) => row.payroll.gross),
    [`BHXH ${pct(insurance.bhxh)}%`]: sumOf((row) => row.payroll.insurance.bhxh),
    [`BHYT ${pct(insurance.bhyt)}%`]: sumOf((row) => row.payroll.insurance.bhyt),
    [`BHTN ${pct(insurance.bhtn)}%`]: sumOf((row) => row.payroll.insurance.bhtn),
    "Thuế TNCN": sumOf((row) => row.payroll.tax),
    "Tổng lương thực nhận": sumOf((row) => row.payroll.net),
    ...Object.fromEntries(
      allowanceNames.map((name) => [
        name,
        sumOf((row) => row.payroll.allowances.find((item) => item.name === name)?.amount ?? 0),
      ])
    ),
  };
  const foot = { ...BORDER, backgroundColor: "#E2E8F0", fontWeight: "bold" as const };
  const footer: Cell[] = [
    { value: "TỔNG CỘNG", type: String, columnSpan: 2, ...foot, align: "center" as const },
    null,
    ...columns.slice(1).map((column) =>
      column.label in totalsByLabel
        ? { value: totalsByLabel[column.label], type: Number, format: MONEY, ...foot }
        : { value: "", type: String, ...foot }
    ),
  ];

  const half = Math.floor(width / 2);
  const sign = (left: string, right: string, style: Record<string, unknown> = {}): Cell[] => [
    { value: left, type: String, columnSpan: half, align: "center" as const, ...style },
    ...Array.from({ length: half - 1 }, () => null),
    { value: right, type: String, columnSpan: width - half, align: "center" as const, ...style },
    ...Array.from({ length: width - half - 1 }, () => null),
  ];
  const signature: Cell[][] = [
    line(""),
    sign("", `Ngày ….. tháng ….. năm ${sheet.month.slice(0, 4)}`, { fontStyle: "italic" }),
    sign("NGƯỜI LẬP BIỂU", "GIÁM ĐỐC", { fontWeight: "bold" }),
    sign("(Ký, ghi rõ họ tên)", "(Ký, đóng dấu và ghi rõ họ tên)", { fontStyle: "italic", fontSize: 9 }),
  ];

  return {
    data: [...header, ...body, ...(sheet.rows.length > 0 ? [footer] : []), ...signature],
    sheet: `Lương ${sheet.month.slice(5)}-${sheet.month.slice(0, 4)}`,
    stickyRowsCount: header.length,
    stickyColumnsCount: 2,
    showGridLines: false,
    orientation: "landscape" as const,
    columns: [{ width: 5 }, ...columns.map((column) => ({ width: column.width }))],
  };
}

export async function buildCompanyPayrollWorkbook(
  sheet: PayrollSheet,
  companyName: string
): Promise<Buffer> {
  const attendanceInput = {
    month: sheet.month,
    dates: sheet.dates,
    sessionCodes: sheet.sessionCodes,
    rows: sheet.rows.map((row) => row.attendance),
    companyName,
    holidays: sheet.holidays,
    weeklyOffDays: sheet.weeklyOffDays,
    daySwaps: sheet.daySwaps,
    standardWorkdays: sheet.standardWorkdays,
    exportedOn: sheet.computedOn,
  };
  return await writeXlsxFile(fixDecimalFormats([
    salarySheet(sheet, companyName),
    attendanceSheet(attendanceInput),
    employeeOvertimeSheet(attendanceInput),
  ]) as Parameters<typeof writeXlsxFile>[0]).toBuffer();
}

// ------------------------------------------------------------ phiếu lương

function payslipSheet(sheet: PayrollSheet, row: PayrollRow, companyName: string) {
  const p = row.payroll;
  const label = { ...BORDER, fontSize: 10 };
  const money = (value: number) => ({ value, type: Number, format: MONEY, ...BORDER, fontSize: 10 });
  const text = (value: string) => ({ value, type: String, ...BORDER, fontSize: 10 });
  const section = (value: string): Cell[] => [
    { value, type: String, columnSpan: 2, fontWeight: "bold", backgroundColor: "#E0F2FE", ...BORDER },
    null,
  ];
  const item = (name: string, value: Cell): Cell[] => [{ value: name, type: String, ...label }, value];

  const data: Cell[][] = [
    [{ value: companyName, type: String, columnSpan: 2, fontWeight: "bold" }, null],
    [
      {
        value: `PHIẾU LƯƠNG THÁNG ${monthTitle(sheet.month)}`,
        type: String,
        columnSpan: 2,
        fontWeight: "bold",
        fontSize: 15,
        textColor: BRAND_DARK,
        align: "center",
        height: 26,
      },
      null,
    ],
    [{ value: statusNote(sheet), type: String, columnSpan: 2, fontStyle: "italic", fontSize: 9, textColor: "#64748B", wrap: true, height: 28 }, null],
    section("Nhân viên"),
    item("Họ và tên", text(row.user.name)),
    item("Mã NV", text(row.user.employeeCode ?? "")),
    item("Chức vụ", text(row.user.position ?? "")),
    item("Loại hợp đồng", text(row.contractLabel)),
    item("Hình thức lương", text(PAY_BASIS_LABELS[p.payBasis])),
    item("Số tài khoản", text([row.profile.bankAccount, row.profile.bankName].filter(Boolean).join(" · "))),
    section("Ngày công"),
    item("Ngày công tháng (chuẩn)", { value: p.standardWorkdays, type: Number, ...BORDER }),
    item("Ngày công đi làm", { value: p.workdays, type: Number, format: DAYS, ...BORDER }),
    ...(row.leave.mode === "monthly"
      ? [
          item("Nghỉ có lương (bù trong tháng)", { value: p.paidLeaveDays, type: Number, format: DAYS, ...BORDER }),
          ...(row.leave.unpaidDays > 0
            ? [item("Công thiếu không lương", { value: row.leave.unpaidDays, type: Number, format: DAYS, ...BORDER })]
            : []),
        ]
      : row.leave.eligible
      ? [
          item("Nghỉ phép năm có lương", { value: p.paidLeaveDays, type: Number, format: DAYS, ...BORDER }),
          item("Nghỉ không lương", { value: row.leave.unpaidDays, type: Number, format: DAYS, ...BORDER }),
          item("Phép năm còn lại", { value: row.leave.balance, type: Number, format: DAYS, ...BORDER }),
        ]
      : row.attendance.leaveDays > 0
        ? [item("Nghỉ (không hưởng phép năm)", { value: row.attendance.leaveDays, type: Number, format: DAYS, ...BORDER })]
        : []),
    ...(row.attendance.projectedDays > 0
      ? [item("Trong đó tạm tính theo lịch", { value: row.attendance.projectedDays, type: Number, ...BORDER })]
      : []),
    section("Thu nhập"),
    item(
      p.salaryType === "daily" ? "Đơn giá một ngày công" : "Lương cơ bản",
      money(p.baseSalary)
    ),
    ...(row.profile.contractType === "probation" && p.probationWorkdays !== 0
      ? [item(
          row.profile.probationSalary != null
            ? "Lương thử việc"
            : `Lương thử việc (${row.profile.probationPercent}%)`,
          money(p.appliedSalary)
        )]
      : []),
    ...(p.probationWorkdays != null && row.profile.probationEndDate
      ? [
          item(`Công thử việc (đến ${row.profile.probationEndDate.split("-").reverse().join("/")})`, {
            value: p.probationWorkdays,
            type: Number,
            format: DAYS,
            ...BORDER,
          }),
          item("Công tính 100% lương", {
            value: Math.round((p.paidWorkdays - p.probationWorkdays) * 100) / 100,
            type: Number,
            format: DAYS,
            ...BORDER,
          }),
        ]
      : []),
    item("Thành tiền theo ngày công", money(p.earned)),
    ...p.allowances.map((allowance) => item(allowance.name, money(allowance.amount))),
    ...p.overtime.map((ot) =>
      item(
        `OT ${ot.code} (${Math.round((ot.minutes / 60) * 100) / 100} giờ × ${ot.rate}%)`,
        money(ot.amount)
      )
    ),
    ...(p.payBasis === "net"
      ? [
          item("Thực nhận cam kết (NET)", money(p.targetNet ?? 0)),
          item("Công ty bù thuế & bảo hiểm", money(p.netGrossUp)),
        ]
      : []),
    item("Tổng thu nhập", { ...money(p.gross), fontWeight: "bold" }),
    section("Khấu trừ"),
    ...(p.insurance.total > 0
      ? [
          item(`BHXH ${pct(sheet.config.insurance.bhxh)}%`, money(p.insurance.bhxh)),
          item(`BHYT ${pct(sheet.config.insurance.bhyt)}%`, money(p.insurance.bhyt)),
          item(`BHTN ${pct(sheet.config.insurance.bhtn)}%`, money(p.insurance.bhtn)),
        ]
      : [item("Bảo hiểm", text("Không đóng"))]),
    ...(row.profile.taxMode === "progressive"
      ? [
          item("Giảm trừ bản thân", money(p.personalDeduction)),
          item(`Giảm trừ người phụ thuộc (${row.profile.dependents})`, money(p.dependentDeduction)),
        ]
      : []),
    item("Thu nhập tính thuế", money(p.taxableIncome)),
    item(`Thuế TNCN (${TAX_MODE_LABELS[row.profile.taxMode]})`, money(p.tax)),
    [
      { value: "THỰC NHẬN", type: String, ...BORDER, fontWeight: "bold", backgroundColor: "#DCFCE7" },
      { value: p.net, type: Number, format: MONEY, ...BORDER, fontWeight: "bold", backgroundColor: "#DCFCE7" },
    ],
  ];

  return {
    data,
    sheet: "Phiếu lương",
    showGridLines: false,
    columns: [{ width: 38 }, { width: 22 }],
  };
}

const hoursOf = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/// Dòng chữ trải hết bề ngang bảng.
function spanLine(span: number, value: string, style: Record<string, unknown> = {}): Cell[] {
  return [{ value, type: String, columnSpan: span, ...style }, ...Array.from({ length: span - 1 }, () => null)];
}

/// Khối đầu trang dùng chung cho các sheet của file từng người.
function personHeader(
  span: number,
  companyName: string,
  title: string,
  month: string,
  row: PayrollRow
): Cell[][] {
  const unit = [row.user.position, row.user.department].filter(Boolean).join(" · ");
  return [
    spanLine(span, companyName, { fontWeight: "bold", textColor: "#334155" }),
    spanLine(span, title, { fontWeight: "bold", fontSize: 15, textColor: BRAND_DARK, align: "center", height: 26 }),
    spanLine(span, `Tháng ${month.slice(5, 7)} năm ${month.slice(0, 4)}`, { align: "center", textColor: "#475569" }),
    spanLine(
      span,
      [`Họ tên: ${row.user.name}`, `Mã NV: ${row.user.employeeCode ?? ""}`, unit && `Chức vụ / bộ phận: ${unit}`, row.contractLabel]
        .filter(Boolean)
        .join("    ·    "),
      { height: 20 }
    ),
  ];
}

/// Theo mẫu "Bảng chấm công làm thêm giờ": mỗi phiếu OT đã duyệt một dòng,
/// kèm hệ số và cách duyệt (theo giờ trên phiếu hay admin chốt số giờ).
function overtimeSheet(sheet: PayrollSheet, row: PayrollRow, companyName: string) {
  const columns = [
    { label: "TT", width: 5 },
    { label: "Ngày tháng", width: 13 },
    { label: "Nơi đi / Nơi đến", width: 24 },
    { label: "Giờ bắt đầu", width: 9 },
    { label: "Giờ kết thúc", width: 9 },
    { label: "Ngày làm việc (T)", width: 10 },
    { label: "Ngày nghỉ (T1)", width: 10 },
    { label: "Ngày lễ (T2)", width: 10 },
    { label: "Hệ số", width: 8 },
    { label: "Hình thức duyệt", width: 24 },
    { label: "Nội dung", width: 34 },
  ];
  const span = columns.length;
  const center = { ...BORDER, align: "center" as const, alignVertical: "center" as const };
  const hourCell = (value: number | null) =>
    value ? { value, type: Number, format: DAYS, ...center } : { value: "", type: String, ...BORDER };
  const approval = (ot: PayrollRow["overtimeDetails"][number]) => {
    const parts = [
      ot.approvedMinutes != null && ot.computedMinutes != null && ot.approvedMinutes !== ot.computedMinutes
        ? `Admin chốt ${hoursOf(ot.approvedMinutes)} giờ (phiếu ghi ${hoursOf(ot.computedMinutes)} giờ)`
        : "Duyệt theo giờ trên phiếu",
      ot.adminNote ? `Ghi chú: ${ot.adminNote}` : null,
    ];
    return parts.filter(Boolean).join(". ");
  };

  const body: Cell[][] = row.overtimeDetails.map((ot, index) => {
    const zebra = index % 2 === 1 ? { backgroundColor: "#F8FAFC" } : {};
    return [
      { value: index + 1, type: Number, ...center, ...zebra },
      { value: `${dmy(ot.date)} ${weekdayLabel(ot.date)}`, type: String, ...BORDER, ...zebra },
      { value: ot.place ?? "", type: String, ...BORDER, wrap: true, ...zebra },
      { value: ot.plannedStart, type: String, ...center, ...zebra },
      { value: ot.plannedEnd, type: String, ...center, ...zebra },
      { ...hourCell(ot.code === "T" ? hoursOf(ot.minutes) : null), ...zebra },
      { ...hourCell(ot.code === "T1" ? hoursOf(ot.minutes) : null), ...zebra },
      { ...hourCell(ot.code === "T2" ? hoursOf(ot.minutes) : null), ...zebra },
      { value: `${ot.rate}%`, type: String, ...center, ...zebra },
      { value: approval(ot), type: String, ...BORDER, wrap: true, ...zebra },
      { value: ot.content, type: String, ...BORDER, wrap: true, ...zebra },
    ];
  });
  const total = (code: string) =>
    hoursOf(row.overtimeDetails.filter((ot) => ot.code === code).reduce((sum, ot) => sum + ot.minutes, 0));
  const foot = { ...BORDER, backgroundColor: "#E2E8F0", fontWeight: "bold" as const };
  const empty = row.overtimeDetails.length === 0;

  return {
    data: [
      ...personHeader(span, companyName, "BẢNG CHẤM CÔNG LÀM THÊM GIỜ", sheet.month, row),
      spanLine(span, ""),
      columns.map((column) => ({ value: column.label, type: String, ...HEAD, height: 32 })),
      ...(empty
        ? [spanLine(span, "Không có phiếu OT nào được duyệt trong tháng.", { ...BORDER, align: "center", fontStyle: "italic", textColor: "#64748B" })]
        : body),
      [
        { value: "Tổng số giờ", type: String, columnSpan: 5, ...foot, align: "center" as const },
        null,
        null,
        null,
        null,
        { value: total("T"), type: Number, format: DAYS, ...foot, align: "center" as const },
        { value: total("T1"), type: Number, format: DAYS, ...foot, align: "center" as const },
        { value: total("T2"), type: Number, format: DAYS, ...foot, align: "center" as const },
        { value: "", type: String, columnSpan: 3, ...foot },
        null,
        null,
      ],
      ...row.payroll.overtime.map((ot): Cell[] => [
        { value: `Tiền OT ${ot.code}: ${hoursOf(ot.minutes)} giờ × ${ot.rate}%`, type: String, columnSpan: 5, ...BORDER },
        null,
        null,
        null,
        null,
        { value: ot.amount, type: Number, format: MONEY, columnSpan: 6, ...BORDER },
        null,
        null,
        null,
        null,
        null,
      ]),
      [
        { value: "Tổng tiền lương làm thêm giờ", type: String, columnSpan: 5, ...foot },
        null,
        null,
        null,
        null,
        { value: row.payroll.overtimeTotal, type: Number, format: MONEY, columnSpan: 6, ...foot },
        null,
        null,
        null,
        null,
        null,
      ],
      spanLine(span, ""),
      spanLine(span, "T: làm thêm ngày làm việc · T1: ngày nghỉ hằng tuần · T2: ngày lễ. Số giờ là giờ được duyệt để trả lương.", {
        fontStyle: "italic",
        fontSize: 9,
        textColor: "#64748B",
      }),
    ],
    sheet: "Làm thêm giờ",
    showGridLines: false,
    stickyRowsCount: 6,
    columns: columns.map((column) => ({ width: column.width })),
  };
}

type PayrollDay = PayrollRow["attendance"]["days"][string];

/// Ai / cái gì quyết định kết quả cuối cùng của ngày.
function decisionOf(day: PayrollDay, times: DayPunchTimes | undefined): string {
  const notes: string[] = [];
  if (times?.adminEdited && !day.finalEdited) notes.push("admin sửa giờ chấm");
  if (day.adminEdited && !day.finalEdited) notes.push("admin đổi ca");
  const extra = notes.length ? ` (${notes.join(", ")})` : "";

  if (day.finalEdited) return "Admin chốt tay ở bảng công chốt";
  if (day.projected) return "Tạm tính theo lịch (ngày chưa tới)";
  if (day.reviewDecision === "count") return `Admin xem lại thiếu giờ: tính đủ công${extra}`;
  if (day.reviewDecision === "exclude") return `Admin xem lại thiếu giờ: không tính công${extra}`;
  if (day.needsReview) return `Thiếu giờ, admin chưa xem lại — đang tính đủ công${extra}`;
  if (day.status === "holiday") return "Ngày lễ — hưởng lương";
  if (day.status === "leave") return "Nghỉ (đã đánh dấu)";
  if (day.leaveDays && day.leaveDays < 1) return `Nghỉ nửa ngày, làm ${day.codes.join("+") || "nửa ngày"}${extra}`;
  if (day.status === "sick") return "Nghỉ ốm (đã đánh dấu)";
  if (day.status === "absent") return `Có lịch, không chấm công${extra}`;
  if (day.overtime && day.workdayValue <= 0) return "Làm thêm theo phiếu OT đã duyệt";
  if (day.status === "unscheduled") return `Làm ngoài lịch${extra}`;
  if (times?.firstIn || times?.lastOut || day.firstIn || day.lastOut) return `Máy chấm tự động${extra}`;
  return extra ? extra.slice(2, -1) : "";
}

/// Chấm công chi tiết từng ngày: giờ vào / ra, phút muộn, ký hiệu máy chấm và
/// quyết định cuối cùng (ai quyết, cách nào), công và OT.
function detailedAttendanceSheet(
  sheet: PayrollSheet,
  row: PayrollRow,
  companyName: string,
  times: Record<string, DayPunchTimes>
) {
  const columns = [
    { label: "Ngày", width: 11 },
    { label: "Thứ", width: 5 },
    { label: "Giờ vào", width: 8 },
    { label: "Giờ ra", width: 8 },
    { label: "Phút muộn", width: 8 },
    { label: "Giờ làm", width: 8 },
    { label: "Máy chấm", width: 10 },
    { label: "Chốt cuối cùng", width: 10 },
    { label: "Công", width: 7 },
    { label: "Trạng thái", width: 13 },
    { label: "Hình thức quyết định", width: 36 },
    { label: "OT (giờ)", width: 9 },
    { label: "Ghi chú", width: 26 },
  ];
  const span = columns.length;
  const swaps = { off: new Set(sheet.daySwaps?.off ?? []), work: new Set(sheet.daySwaps?.work ?? []) };
  const holidayFill = "#FCE7F3";
  const offFill = "#F1F5F9";
  const adminFill = "#FEF3C7";

  let lateTotal = 0;
  let hoursTotal = 0;
  let workdayTotal = 0;
  let otMinutes = 0;
  let lateCount = 0;

  const body: Cell[][] = sheet.dates.map((date) => {
    const day = row.attendance.days[date];
    const t = times[date];
    const isHoliday = Boolean(sheet.holidays[date]);
    const isOff = isOffDate(date, sheet.weeklyOffDays, swaps);
    const fill = isHoliday ? holidayFill : !day && isOff ? offFill : undefined;
    const base = { ...BORDER, fontSize: 10, alignVertical: "center" as const, ...(fill ? { backgroundColor: fill } : {}) };
    const center = { ...base, align: "center" as const };
    const blank = (style = center) => ({ value: "", type: String, ...style });

    const notes = [
      sheet.holidays[date] ? `Lễ: ${sheet.holidays[date]}` : null,
      swaps.off.has(date) ? "Nghỉ hoán đổi kèm ngày lễ" : null,
      swaps.work.has(date) ? "Đi làm bù (hoán đổi)" : null,
      !day && isOff && !swaps.off.has(date) ? "Ngày nghỉ hằng tuần" : null,
    ].filter(Boolean);

    if (!day) {
      return [
        { value: dmy(date), type: String, ...base },
        { value: weekdayLabel(date), type: String, ...center },
        blank(), blank(), blank(), blank(), blank(), blank(), blank(),
        { value: "", type: String, ...base },
        { value: "", type: String, ...base },
        blank(),
        { value: notes.join(" · "), type: String, ...base, wrap: true },
      ];
    }

    const firstIn = t?.firstIn ?? day.firstIn ?? null;
    const lastOut = t?.lastOut ?? day.lastOut ?? null;
    // Phút muộn có dấu: âm = đến sớm, cộng bù trừ vào tổng.
    const counted = LATE_COUNTED_STATUSES.includes(day.status as DayStatus);
    const late = counted ? (day.arrivalMinutes ?? day.lateMinutes) : 0;
    lateTotal += late;
    if (counted && day.lateMinutes > 0) lateCount++;
    hoursTotal += day.workedHours;
    workdayTotal += day.workdayValue;
    if (day.overtime) otMinutes += day.overtime.minutes;
    const machineLabel = accountingCellLabel(day.finalEdited && day.machine ? day.machine : day);
    const finalLabel = accountingCellLabel(day);
    if (day.projected) notes.push("Tạm tính theo lịch");

    return [
      { value: dmy(date), type: String, ...base },
      { value: weekdayLabel(date), type: String, ...center },
      firstIn
        ? { value: firstIn, type: String, ...center, ...(t?.inByAdmin ? { backgroundColor: adminFill } : {}) }
        : blank(),
      lastOut
        ? { value: lastOut, type: String, ...center, ...(t?.outByAdmin ? { backgroundColor: adminFill } : {}) }
        : blank(),
      late !== 0
        ? {
            value: late,
            type: Number,
            ...center,
            textColor: late > 0 ? "#B45309" : "#047857",
            fontWeight: "bold" as const,
          }
        : blank(),
      day.workedHours > 0 ? { value: day.workedHours, type: Number, format: "0.0", ...center } : blank(),
      { value: machineLabel, type: String, ...center, textColor: "#475569" },
      {
        value: finalLabel,
        type: String,
        ...center,
        fontWeight: "bold" as const,
        ...(day.finalEdited ? { backgroundColor: "#EDE9FE" } : {}),
      },
      day.workdayValue > 0 ? { value: day.workdayValue, type: Number, format: DAYS, ...center } : blank(),
      { value: DAY_STATUS_LABELS[day.status as DayStatus] ?? day.status, type: String, ...base },
      { value: decisionOf(day, t), type: String, ...base, wrap: true },
      day.overtime
        ? { value: `${day.overtime.code}: ${hoursOf(day.overtime.minutes)}`, type: String, ...center }
        : blank(),
      { value: notes.join(" · "), type: String, ...base, wrap: true },
    ];
  });

  const foot = { ...BORDER, backgroundColor: "#E2E8F0", fontWeight: "bold" as const, align: "center" as const };
  const summaryItem = (label: string, value: string | number): Cell[] => [
    { value: label, type: String, columnSpan: 4, ...BORDER, fontSize: 10 },
    null,
    null,
    null,
    { value, type: typeof value === "number" ? Number : String, columnSpan: 2, ...BORDER, fontSize: 10, fontWeight: "bold", align: "center", ...(typeof value === "number" ? { format: DAYS } : {}) },
    null,
    ...Array.from({ length: span - 6 }, () => null),
  ];
  const a = row.attendance;

  return {
    data: [
      ...personHeader(span, companyName, "BẢNG CHẤM CÔNG CHI TIẾT", sheet.month, row),
      spanLine(span, statusNote(sheet), { fontStyle: "italic", fontSize: 9, textColor: "#64748B" }),
      columns.map((column) => ({ value: column.label, type: String, ...HEAD, height: 32 })),
      ...body,
      [
        { value: "Tổng cộng", type: String, columnSpan: 4, ...foot },
        null,
        null,
        null,
        { value: lateTotal, type: Number, ...foot },
        { value: Math.round(hoursTotal * 10) / 10, type: Number, format: "0.0", ...foot },
        { value: "", type: String, columnSpan: 2, ...foot },
        null,
        { value: Math.round(workdayTotal * 100) / 100, type: Number, format: DAYS, ...foot },
        { value: "", type: String, columnSpan: 2, ...foot },
        null,
        { value: hoursOf(otMinutes), type: Number, format: DAYS, ...foot },
        { value: "", type: String, ...foot },
      ],
      spanLine(span, ""),
      spanLine(span, "TỔNG HỢP", { fontWeight: "bold", textColor: BRAND_DARK }),
      summaryItem("Ngày công tháng (chuẩn)", sheet.standardWorkdays),
      summaryItem("Công thực tế", Math.round(workdayTotal * 100) / 100),
      summaryItem("Số ngày đi muộn", lateCount),
      summaryItem("Tổng phút muộn (đã trừ phút đến sớm)", lateTotal),
      summaryItem("Số ngày vắng (có lịch, không chấm)", a.absentDays),
      summaryItem("Số ngày nghỉ / ốm", a.leaveDays + a.sickDays),
      summaryItem("Số ngày quên checkout", a.missedCheckoutDays),
      summaryItem("Giờ làm thêm được duyệt", hoursOf(otMinutes)),
      spanLine(span, ""),
      spanLine(
        span,
        "Ký hiệu: S ca sáng · C ca chiều · CN cả ngày · V vắng · N nghỉ · O ốm · L nghỉ lễ. " +
          "\"Máy chấm\" là kết quả hệ thống tự tính từ giờ chấm; \"Chốt cuối cùng\" là kết quả dùng để tính lương. " +
          "Ô tô vàng: giờ do admin nhập tay; ô tô tím: admin chốt tay; dòng hồng: ngày lễ; dòng xám: ngày nghỉ.",
        { fontStyle: "italic", fontSize: 9, textColor: "#64748B", wrap: true, height: 40 }
      ),
    ],
    sheet: "Chấm công chi tiết",
    showGridLines: false,
    stickyRowsCount: 6,
    columns: columns.map((column) => ({ width: column.width })),
  };
}

export async function buildPayslipWorkbook(
  sheet: PayrollSheet,
  row: PayrollRow,
  companyName: string,
  times: Record<string, DayPunchTimes> = {}
): Promise<Buffer> {
  return await writeXlsxFile(fixDecimalFormats([
    payslipSheet(sheet, row, companyName),
    detailedAttendanceSheet(sheet, row, companyName, times),
    overtimeSheet(sheet, row, companyName),
  ]) as Parameters<typeof writeXlsxFile>[0]).toBuffer();
}
