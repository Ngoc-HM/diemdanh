/// Tính lương — chỉ hàm thuần, không đụng database, để kiểm thử được từng
/// công thức. Số tiền tính bằng đồng, làm tròn ở từng khoản.
import { OvertimeConfig } from "@/lib/overtime";

export type SalaryType = "monthly" | "daily";
export type ContractType = "collaborator" | "probation" | "official";
export type TaxMode = "flat10" | "progressive" | "none";
export type AllowanceMode = "monthly" | "prorated" | "per_day";
/// GROSS = lương thoả thuận trước thuế, BH; NET = số cầm về, công ty chịu
/// thuế và BH phần người lao động.
export type PayBasis = "gross" | "net";

export const PAY_BASIS_LABELS: Record<PayBasis, string> = {
  gross: "GROSS",
  net: "NET",
};

export const CONTRACT_LABELS: Record<ContractType, string> = {
  collaborator: "CTV",
  probation: "Thử việc",
  official: "Chính thức",
};
export const TAX_MODE_LABELS: Record<TaxMode, string> = {
  flat10: "Khấu trừ 10%",
  progressive: "Luỹ tiến (có giảm trừ)",
  none: "Không khấu trừ",
};
export const ALLOWANCE_MODE_LABELS: Record<AllowanceMode, string> = {
  monthly: "Cố định mỗi tháng",
  prorated: "Theo tỉ lệ ngày công",
  per_day: "Theo số ngày công",
};

export type PayProfile = {
  payBasis: PayBasis;
  salaryType: SalaryType;
  baseSalary: number;
  contractType: ContractType;
  probationPercent: number;
  gender: "male" | "female" | null;
  dependents: number;
  taxMode: TaxMode;
  hasInsurance: boolean;
  insuranceSalary: number | null;
  annualLeave: boolean;
  leaveStartDate: string | null;
  bankAccount: string | null;
  bankName: string | null;
};

export const DEFAULT_PAY_PROFILE: PayProfile = {
  payBasis: "gross",
  salaryType: "monthly",
  baseSalary: 0,
  contractType: "official",
  probationPercent: 85,
  gender: null,
  dependents: 0,
  taxMode: "flat10",
  hasInsurance: false,
  insuranceSalary: null,
  annualLeave: false,
  leaveStartDate: null,
  bankAccount: null,
  bankName: null,
};

export type TaxBracket = { upTo: number | null; rate: number };

export type PayrollConfig = {
  /// Tỉ lệ người lao động đóng, theo %.
  insurance: { bhxh: number; bhyt: number; bhtn: number };
  /// Khấu trừ thẳng (CTV / thử việc ngắn hạn).
  flatTaxRate: number;
  /// Thu nhập dưới mức này thì không khấu trừ thẳng. Luật: 2.000.000đ / lần
  /// chi trả; để 0 = khấu trừ mọi khoản (như cách kế toán đang làm).
  flatTaxThreshold: number;
  personalDeduction: number;
  dependentDeduction: number;
  /// Biểu thuế luỹ tiến theo tháng, `upTo` = cận trên của bậc (null = còn lại).
  taxBrackets: TaxBracket[];
  annualLeave: {
    /// Số ngày phép một năm, cộng dần mỗi tháng daysPerYear / 12.
    daysPerYear: number;
    /// Phép cộng dồn tối đa bao nhiêu năm.
    maxCarryYears: number;
    /// Cứ đủ bấy nhiêu năm làm việc thì thêm 1 ngày phép mỗi năm.
    bonusEveryYears: number;
  };
};

/// Mặc định — mức giảm trừ và biểu thuế cần kế toán đối chiếu lại với quy định
/// đang áp dụng; admin sửa được ở trang Cài đặt lương.
export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  insurance: { bhxh: 8, bhyt: 1.5, bhtn: 1 },
  flatTaxRate: 10,
  flatTaxThreshold: 0,
  personalDeduction: 15_500_000,
  dependentDeduction: 6_200_000,
  taxBrackets: [
    { upTo: 10_000_000, rate: 5 },
    { upTo: 30_000_000, rate: 10 },
    { upTo: 60_000_000, rate: 20 },
    { upTo: 100_000_000, rate: 30 },
    { upTo: null, rate: 35 },
  ],
  annualLeave: { daysPerYear: 12, maxCarryYears: 3, bonusEveryYears: 5 },
};

export function parsePayrollConfig(raw: string | null | undefined): PayrollConfig {
  if (!raw) return structuredClone(DEFAULT_PAYROLL_CONFIG);
  try {
    const parsed = JSON.parse(raw) as Partial<PayrollConfig>;
    const config: PayrollConfig = {
      ...DEFAULT_PAYROLL_CONFIG,
      ...parsed,
      insurance: { ...DEFAULT_PAYROLL_CONFIG.insurance, ...parsed.insurance },
      annualLeave: { ...DEFAULT_PAYROLL_CONFIG.annualLeave, ...parsed.annualLeave },
      taxBrackets: parsed.taxBrackets ?? DEFAULT_PAYROLL_CONFIG.taxBrackets,
    };
    return validatePayrollConfig(config) ? structuredClone(DEFAULT_PAYROLL_CONFIG) : config;
  } catch {
    return structuredClone(DEFAULT_PAYROLL_CONFIG);
  }
}

const isPercent = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;
const isMoney = (value: number) => Number.isFinite(value) && value >= 0;

/// Trả câu lỗi hoặc null.
export function validatePayrollConfig(config: PayrollConfig): string | null {
  const { insurance } = config;
  if (![insurance.bhxh, insurance.bhyt, insurance.bhtn, config.flatTaxRate].every(isPercent)) {
    return "Tỉ lệ bảo hiểm và thuế phải trong khoảng 0 – 100%";
  }
  if (
    ![config.flatTaxThreshold, config.personalDeduction, config.dependentDeduction].every(
      isMoney
    )
  ) {
    return "Mức giảm trừ và ngưỡng khấu trừ không được âm";
  }
  const brackets = config.taxBrackets;
  if (!Array.isArray(brackets) || brackets.length === 0) return "Biểu thuế phải có ít nhất một bậc";
  for (let index = 0; index < brackets.length; index++) {
    const bracket = brackets[index];
    const last = index === brackets.length - 1;
    if (!isPercent(bracket.rate)) return "Thuế suất từng bậc phải trong khoảng 0 – 100%";
    if (last ? bracket.upTo !== null : !isMoney(bracket.upTo ?? NaN)) {
      return "Bậc thuế cuối không có cận trên, các bậc trước phải có";
    }
    if (!last && index > 0 && (bracket.upTo ?? 0) <= (brackets[index - 1].upTo ?? 0)) {
      return "Cận trên các bậc thuế phải tăng dần";
    }
  }
  const leave = config.annualLeave;
  if (
    !(leave.daysPerYear >= 0 && leave.daysPerYear <= 60) ||
    !(leave.maxCarryYears >= 1 && leave.maxCarryYears <= 10) ||
    !(leave.bonusEveryYears >= 1 && leave.bonusEveryYears <= 50)
  ) {
    return "Cấu hình phép năm không hợp lệ";
  }
  return null;
}

/// Thuế luỹ tiến từng phần.
export function progressiveTax(taxableIncome: number, brackets: TaxBracket[]): number {
  let remaining = Math.max(0, taxableIncome);
  let lower = 0;
  let tax = 0;
  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const width = bracket.upTo === null ? Infinity : bracket.upTo - lower;
    const part = Math.min(remaining, width);
    tax += (part * bracket.rate) / 100;
    remaining -= part;
    if (bracket.upTo !== null) lower = bracket.upTo;
  }
  return Math.round(tax);
}

// ---------------------------------------------------------------- phép năm

const monthIndex = (month: string) =>
  Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

/// Số ngày phép có lương trong tháng cần tính và số phép còn lại sau tháng đó.
///  - Cộng dần mỗi tháng daysPerYear / 12 kể từ tháng bắt đầu (có tính tháng
///    bắt đầu), cứ đủ `bonusEveryYears` năm thêm 1 ngày/năm.
///  - Phép tồn không quá `maxCarryYears` năm (chặn trần số dư).
///  - Ngày nghỉ N trừ dần vào số dư theo thứ tự thời gian; hết phép thì là
///    nghỉ không lương.
export function annualLeaveForMonth(input: {
  startDate: string;
  month: string;
  /// Mọi ngày nghỉ N từ ngày bắt đầu đến hết tháng cần tính.
  leaveDates: string[];
  config: PayrollConfig["annualLeave"];
}): { paidDays: number; unpaidDays: number; balance: number; accrued: number } {
  const { startDate, month, config } = input;
  const startMonth = startDate.slice(0, 7);
  if (monthIndex(month) < monthIndex(startMonth)) {
    return { paidDays: 0, unpaidDays: 0, balance: 0, accrued: 0 };
  }
  const byMonth = new Map<string, number>();
  for (const date of input.leaveDates) {
    if (date < startDate) continue;
    const key = date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }

  const cap = config.daysPerYear * config.maxCarryYears;
  let balance = 0;
  let accrued = 0;
  let paidDays = 0;
  let unpaidDays = 0;
  for (let index = monthIndex(startMonth); index <= monthIndex(month); index++) {
    const years = Math.floor((index - monthIndex(startMonth)) / 12);
    const perYear = config.daysPerYear + Math.floor(years / config.bonusEveryYears);
    balance = Math.min(cap + perYear, balance + perYear / 12);
    accrued += perYear / 12;

    const key = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
    const used = byMonth.get(key) ?? 0;
    // Phép trừ theo ngày nguyên: số dư lẻ (do thưởng thâm niên) để dành.
    const paid = Math.min(used, Math.floor(balance));
    balance -= paid;
    if (key === month) {
      paidDays = paid;
      unpaidDays = used - paid;
    }
  }
  return {
    paidDays,
    unpaidDays,
    balance: Math.round(balance * 100) / 100,
    accrued: Math.round(accrued * 100) / 100,
  };
}

// ---------------------------------------------------------------- lương

export type AssignedAllowance = {
  allowanceId: string;
  name: string;
  mode: AllowanceMode;
  taxable: boolean;
  /// Mức áp cho người này (mức riêng, hoặc mặc định của khoản).
  amount: number;
};

export type PayrollInput = {
  profile: PayProfile;
  config: PayrollConfig;
  overtimeConfig: OvertimeConfig;
  standardWorkdays: number;
  /// Số công đi làm thực tế (đã gồm ngày lễ được hưởng công).
  workdays: number;
  /// Ngày nghỉ phép năm có lương.
  paidLeaveDays: number;
  /// Phút OT đã duyệt theo ký hiệu T / T1 / T2.
  overtimeMinutes: Record<string, number>;
  allowances: AssignedAllowance[];
};

export type PayrollResult = {
  payBasis: PayBasis;
  /// Lương cơ bản theo hồ sơ (với NET là số cầm về khi đủ công).
  baseSalary: number;
  /// Lương áp dụng (thử việc = base × %), theo tháng hoặc theo ngày.
  appliedSalary: number;
  salaryType: SalaryType;
  standardWorkdays: number;
  workdays: number;
  paidLeaveDays: number;
  /// Số công được trả lương = công đi làm + phép năm.
  paidWorkdays: number;
  dailyRate: number;
  hourlyRate: number;
  /// Thành tiền theo ngày công.
  earned: number;
  allowances: { allowanceId: string; name: string; taxable: boolean; amount: number }[];
  allowanceTotal: number;
  overtime: { code: string; minutes: number; rate: number; amount: number }[];
  overtimeTotal: number;
  /// Lương NET: phần công ty bù thêm để sau thuế và BH người lao động vẫn cầm
  /// đúng số thoả thuận (0 với GROSS). Đã gồm trong `gross`.
  netGrossUp: number;
  /// Số thực nhận cam kết với NET (= earned + hỗ trợ + OT); null với GROSS.
  targetNet: number | null;
  /// Tổng thu nhập trước khấu trừ.
  gross: number;
  insurance: { bhxh: number; bhyt: number; bhtn: number; total: number };
  personalDeduction: number;
  dependentDeduction: number;
  taxableIncome: number;
  tax: number;
  net: number;
};

const OT_RATE_BY_CODE = (config: OvertimeConfig): Record<string, number> => ({
  T: config.weekdayRate,
  T1: config.weeklyOffRate,
  T2: config.holidayRate,
});

export function computePayroll(input: PayrollInput): PayrollResult {
  const { profile, config, overtimeConfig, standardWorkdays } = input;
  const factor = profile.contractType === "probation" ? profile.probationPercent / 100 : 1;
  const appliedSalary = Math.round(profile.baseSalary * factor);
  const paidWorkdays = input.workdays + input.paidLeaveDays;

  const dailyRate =
    profile.salaryType === "daily"
      ? appliedSalary
      : standardWorkdays > 0
        ? appliedSalary / standardWorkdays
        : 0;
  const hourlyRate = dailyRate / overtimeConfig.hoursPerDay;
  const earned = Math.round(dailyRate * paidWorkdays);

  const ratio = standardWorkdays > 0 ? Math.min(1, paidWorkdays / standardWorkdays) : 0;
  const allowances = input.allowances.map((allowance) => {
    const amount =
      allowance.mode === "monthly"
        ? allowance.amount
        : allowance.mode === "prorated"
          ? allowance.amount * ratio
          : allowance.amount * input.workdays;
    return {
      allowanceId: allowance.allowanceId,
      name: allowance.name,
      taxable: allowance.taxable,
      amount: Math.round(amount),
    };
  });
  const allowanceTotal = allowances.reduce((sum, item) => sum + item.amount, 0);
  const taxableAllowances = allowances
    .filter((item) => item.taxable)
    .reduce((sum, item) => sum + item.amount, 0);

  const rates = OT_RATE_BY_CODE(overtimeConfig);
  const overtime = Object.entries(input.overtimeMinutes)
    .filter(([, minutes]) => minutes > 0)
    .map(([code, minutes]) => ({
      code,
      minutes,
      rate: rates[code] ?? 100,
      amount: Math.round(((hourlyRate * minutes) / 60) * ((rates[code] ?? 100) / 100)),
    }));
  const overtimeTotal = overtime.reduce((sum, item) => sum + item.amount, 0);
  /// Phần lương OT bằng lương giờ thường (100%) — phần trả thêm do hệ số
  /// không chịu thuế TNCN khi tính luỹ tiến.
  const overtimeBase = Math.round(
    overtime.reduce((sum, item) => sum + (hourlyRate * item.minutes) / 60, 0)
  );

  const insuranceBase = profile.hasInsurance
    ? (profile.insuranceSalary ?? profile.baseSalary)
    : 0;
  const bhxh = Math.round((insuranceBase * config.insurance.bhxh) / 100);
  const bhyt = Math.round((insuranceBase * config.insurance.bhyt) / 100);
  const bhtn = Math.round((insuranceBase * config.insurance.bhtn) / 100);
  const insuranceTotal = bhxh + bhyt + bhtn;

  /// Khấu trừ với một khoản lương chịu thuế cộng thêm (`grossUp`, dùng cho NET).
  const settle = (grossUp: number) => {
    const gross = earned + grossUp + allowanceTotal + overtimeTotal;
    let personalDeduction = 0;
    let dependentDeduction = 0;
    let taxableIncome = 0;
    let tax = 0;
    if (profile.taxMode === "flat10") {
      taxableIncome = earned + grossUp + taxableAllowances + overtimeTotal;
      tax =
        taxableIncome >= config.flatTaxThreshold
          ? Math.round((taxableIncome * config.flatTaxRate) / 100)
          : 0;
    } else if (profile.taxMode === "progressive") {
      personalDeduction = config.personalDeduction;
      dependentDeduction = config.dependentDeduction * profile.dependents;
      taxableIncome = Math.max(
        0,
        earned +
          grossUp +
          taxableAllowances +
          overtimeBase -
          insuranceTotal -
          personalDeduction -
          dependentDeduction
      );
      tax = progressiveTax(taxableIncome, config.taxBrackets);
    }
    return {
      gross,
      personalDeduction,
      dependentDeduction,
      taxableIncome,
      tax,
      net: gross - insuranceTotal - tax,
    };
  };

  // NET: số cam kết là thành tiền + hỗ trợ + OT tính theo lương NET. Dò khoản
  // bù nhỏ nhất để thực nhận không thấp hơn số đó (thực nhận tăng đơn điệu theo
  // khoản bù vì thuế suất biên luôn < 100%).
  let netGrossUp = 0;
  let targetNet: number | null = null;
  if (profile.payBasis === "net") {
    targetNet = earned + allowanceTotal + overtimeTotal;
    let low = 0;
    let high = Math.max(1, targetNet) * 2 + insuranceTotal;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (settle(middle).net >= targetNet) high = middle;
      else low = middle + 1;
    }
    netGrossUp = low;
  }
  const settled = settle(netGrossUp);

  return {
    payBasis: profile.payBasis,
    baseSalary: profile.baseSalary,
    appliedSalary,
    salaryType: profile.salaryType,
    standardWorkdays,
    workdays: input.workdays,
    paidLeaveDays: input.paidLeaveDays,
    paidWorkdays,
    dailyRate: Math.round(dailyRate),
    hourlyRate: Math.round(hourlyRate),
    earned,
    allowances,
    allowanceTotal,
    overtime,
    overtimeTotal,
    netGrossUp,
    targetNet,
    gross: settled.gross,
    insurance: { bhxh, bhyt, bhtn, total: insuranceTotal },
    personalDeduction: settled.personalDeduction,
    dependentDeduction: settled.dependentDeduction,
    taxableIncome: settled.taxableIncome,
    tax: settled.tax,
    net: settled.net,
  };
}
