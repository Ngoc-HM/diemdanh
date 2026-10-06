/// File Excel bảng lương — theo mẫu "Bảng chi tiết lương" và "Bảng chấm công
/// làm thêm giờ" kế toán đang dùng. Admin tự tải, không gửi email.
import writeXlsxFile from "write-excel-file/node";
import { attendanceSheet, accountingCellLabel } from "@/lib/attendance-export";
import { formatMonthLabel, weekdayLabel } from "@/lib/datetime";
import { PayrollRow, PayrollSheet } from "@/lib/payroll-service";
import { PAY_BASIS_LABELS, TAX_MODE_LABELS } from "@/lib/payroll";

const BRAND = "#0284C7";
const BRAND_DARK = "#0369A1";
const GRID = "#CBD5E1";
const BORDER = { borderColor: GRID, borderStyle: "thin" as const };
const MONEY = "#,##0";
const DAYS = "0.##";
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

export function companyPayrollFileName(month: string) {
  return `bang-luong-${month}.xlsx`;
}

export function payslipFileName(month: string, row: PayrollRow) {
  return `phieu-luong-${month}-${row.user.employeeCode || row.user.id.slice(0, 8)}.xlsx`;
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
      value: (row) => (row.profile.contractType === "probation" ? row.payroll.appliedSalary : ""),
      format: MONEY,
    },
    { label: "Ngày công", width: 8, value: (row) => row.payroll.workdays, format: DAYS },
    { label: "Phép năm", width: 7, value: (row) => row.payroll.paidLeaveDays, format: DAYS },
    { label: "Ngày công tháng", width: 8, value: (row) => row.payroll.standardWorkdays, format: "0" },
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
  const attendance = attendanceSheet({
    month: sheet.month,
    dates: sheet.dates,
    sessionCodes: sheet.sessionCodes,
    rows: sheet.rows.map((row) => row.attendance),
    companyName,
    holidays: sheet.holidays,
    weeklyOffDays: sheet.weeklyOffDays,
    standardWorkdays: sheet.standardWorkdays,
    exportedOn: sheet.computedOn,
  });
  return await writeXlsxFile([salarySheet(sheet, companyName), attendance]).toBuffer();
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
    ...(row.leave.eligible
      ? [
          item("Nghỉ phép năm có lương", { value: p.paidLeaveDays, type: Number, format: DAYS, ...BORDER }),
          item("Nghỉ không lương", { value: row.leave.unpaidDays, type: Number, format: DAYS, ...BORDER }),
          item("Phép năm còn lại", { value: row.leave.balance, type: Number, format: DAYS, ...BORDER }),
        ]
      : row.attendance.leaveDays > 0
        ? [item("Nghỉ (không hưởng phép năm)", { value: row.attendance.leaveDays, type: Number, ...BORDER })]
        : []),
    ...(row.attendance.projectedDays > 0
      ? [item("Trong đó tạm tính theo lịch", { value: row.attendance.projectedDays, type: Number, ...BORDER })]
      : []),
    section("Thu nhập"),
    item(
      p.salaryType === "daily" ? "Đơn giá một ngày công" : "Lương cơ bản",
      money(p.baseSalary)
    ),
    ...(row.profile.contractType === "probation"
      ? [item(`Lương thử việc (${row.profile.probationPercent}%)`, money(p.appliedSalary))]
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

/// Theo mẫu "Bảng chấm công làm thêm giờ": mỗi phiếu OT đã duyệt một dòng.
function overtimeSheet(sheet: PayrollSheet, row: PayrollRow, companyName: string) {
  const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
  const columns = [
    { label: "TT", width: 5 },
    { label: "Ngày tháng", width: 12 },
    { label: "Nơi đi / Nơi đến", width: 30 },
    { label: "Giờ bắt đầu", width: 10 },
    { label: "Giờ kết thúc", width: 10 },
    { label: "Ngày làm việc (T2–T6)", width: 12 },
    { label: "Thứ 7, Chủ nhật", width: 11 },
    { label: "Ngày lễ", width: 9 },
    { label: "Nội dung", width: 34 },
  ];
  const span = columns.length;
  const line = (value: string, style: Record<string, unknown> = {}): Cell[] => [
    { value, type: String, columnSpan: span, ...style },
    ...Array.from({ length: span - 1 }, () => null),
  ];
  const hourCell = (value: number | null) =>
    value ? { value, type: Number, format: DAYS, ...BORDER, align: "center" as const } : { value: "", type: String, ...BORDER };

  const body: Cell[][] = row.overtimeDetails.map((ot, index) => [
    { value: index + 1, type: Number, ...BORDER, align: "center" as const },
    { value: `${dmy(ot.date)} ${weekdayLabel(ot.date)}`, type: String, ...BORDER },
    { value: ot.place ?? "", type: String, ...BORDER, wrap: true },
    { value: ot.plannedStart, type: String, ...BORDER, align: "center" as const },
    { value: ot.plannedEnd, type: String, ...BORDER, align: "center" as const },
    hourCell(ot.code === "T" ? hours(ot.minutes) : null),
    hourCell(ot.code === "T1" ? hours(ot.minutes) : null),
    hourCell(ot.code === "T2" ? hours(ot.minutes) : null),
    { value: ot.content, type: String, ...BORDER, wrap: true },
  ]);
  const total = (code: string) =>
    hours(row.overtimeDetails.filter((ot) => ot.code === code).reduce((sum, ot) => sum + ot.minutes, 0));
  const foot = { ...BORDER, backgroundColor: "#E2E8F0", fontWeight: "bold" as const };

  return {
    data: [
      line(`Tên công ty: ${companyName}`, { fontWeight: "bold" }),
      line("BẢNG CHẤM CÔNG LÀM THÊM GIỜ", {
        fontWeight: "bold",
        fontSize: 15,
        textColor: BRAND_DARK,
        align: "center",
        height: 26,
      }),
      line(`Tháng ${sheet.month.slice(5, 7)} năm ${sheet.month.slice(0, 4)}`, { align: "center" }),
      line(`Họ tên: ${row.user.name}    ·    Chức vụ: ${row.user.position ?? ""}`),
      columns.map((column) => ({ value: column.label, type: String, ...HEAD, height: 30 })),
      ...body,
      [
        { value: "Tổng số giờ", type: String, columnSpan: 5, ...foot, align: "center" as const },
        null,
        null,
        null,
        null,
        { value: total("T"), type: Number, format: DAYS, ...foot, align: "center" as const },
        { value: total("T1"), type: Number, format: DAYS, ...foot, align: "center" as const },
        { value: total("T2"), type: Number, format: DAYS, ...foot, align: "center" as const },
        { value: "", type: String, ...foot },
      ],
      [
        { value: "Tổng tiền lương làm thêm giờ", type: String, columnSpan: 5, ...foot },
        null,
        null,
        null,
        null,
        { value: row.payroll.overtimeTotal, type: Number, format: MONEY, columnSpan: 4, ...foot },
        null,
        null,
        null,
      ],
    ],
    sheet: "Làm thêm giờ",
    showGridLines: false,
    columns: columns.map((column) => ({ width: column.width })),
  };
}

/// Chấm công từng ngày của một người (ký hiệu kế toán + công + OT).
function personalAttendanceSheet(sheet: PayrollSheet, row: PayrollRow) {
  const columns = [
    { label: "Ngày", width: 12 },
    { label: "Thứ", width: 6 },
    { label: "Ký hiệu", width: 10 },
    { label: "Giờ làm", width: 9 },
    { label: "Công", width: 7 },
    { label: "OT (giờ)", width: 9 },
    { label: "Ghi chú", width: 30 },
  ];
  const body: Cell[][] = sheet.dates
    .filter((date) => row.attendance.days[date])
    .map((date) => {
      const day = row.attendance.days[date];
      const notes = [
        sheet.holidays[date] ? `Lễ: ${sheet.holidays[date]}` : null,
        day.projected ? "Tạm tính theo lịch" : null,
        day.needsReview ? "Thiếu giờ, chưa xem lại" : null,
      ].filter(Boolean);
      return [
        { value: dmy(date), type: String, ...BORDER },
        { value: weekdayLabel(date), type: String, ...BORDER, align: "center" as const },
        {
          value: accountingCellLabel(day, row.attendance.user.employmentType),
          type: String,
          ...BORDER,
          align: "center" as const,
          fontWeight: "bold" as const,
        },
        day.workedHours > 0
          ? { value: day.workedHours, type: Number, format: "0.0", ...BORDER, align: "center" as const }
          : { value: "", type: String, ...BORDER },
        day.workdayValue > 0
          ? { value: day.workdayValue, type: Number, format: DAYS, ...BORDER, align: "center" as const }
          : { value: "", type: String, ...BORDER },
        day.overtime
          ? { value: `${day.overtime.code} · ${Math.round((day.overtime.minutes / 60) * 100) / 100}`, type: String, ...BORDER, align: "center" as const }
          : { value: "", type: String, ...BORDER },
        { value: notes.join(" · "), type: String, ...BORDER },
      ];
    });
  return {
    data: [
      [
        {
          value: `CHẤM CÔNG ${formatMonthLabel(sheet.month).toUpperCase()} — ${row.user.name}`,
          type: String,
          columnSpan: columns.length,
          fontWeight: "bold",
          fontSize: 13,
          textColor: BRAND_DARK,
        },
        ...Array.from({ length: columns.length - 1 }, () => null),
      ],
      columns.map((column) => ({ value: column.label, type: String, ...HEAD })),
      ...body,
    ],
    sheet: "Chấm công",
    showGridLines: false,
    columns: columns.map((column) => ({ width: column.width })),
  };
}

export async function buildPayslipWorkbook(
  sheet: PayrollSheet,
  row: PayrollRow,
  companyName: string
): Promise<Buffer> {
  return await writeXlsxFile([
    payslipSheet(sheet, row, companyName),
    overtimeSheet(sheet, row, companyName),
    personalAttendanceSheet(sheet, row),
  ]).toBuffer();
}
