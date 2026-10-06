import { query, queryOne } from "@/lib/db";
import { dateKeyVN, getMonthRange, monthKeyVN } from "@/lib/datetime";
import { computeMonthAttendance, MonthSummaryRow } from "@/lib/attendance-month";
import { getOvertimeConfig, OVERTIME_SELECT, OvertimeRow, buildOvertimeViews } from "@/lib/overtime-service";
import { OvertimeConfig } from "@/lib/overtime";
import {
  annualLeaveForMonth,
  AssignedAllowance,
  CONTRACT_LABELS,
  DEFAULT_PAY_PROFILE,
  computePayroll,
  parsePayrollConfig,
  PayProfile,
  PayrollConfig,
  PayrollResult,
} from "@/lib/payroll";

export async function getPayrollConfig(): Promise<PayrollConfig> {
  const setting = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'payroll_config'`
  );
  return parsePayrollConfig(setting?.value);
}

type PayProfileRow = PayProfile & { userId: string };

export const PAY_PROFILE_COLUMNS = `
  "userId", "payBasis", "salaryType", "baseSalary"::float8 AS "baseSalary", "contractType",
  "probationPercent", "gender", "dependents", "taxMode", "hasInsurance",
  "insuranceSalary"::float8 AS "insuranceSalary", "annualLeave", "leaveStartDate",
  "bankAccount", "bankName"
`;

export async function getPayProfiles(userIds: string[]): Promise<Map<string, PayProfile>> {
  if (userIds.length === 0) return new Map();
  const rows = await query<PayProfileRow>(
    `SELECT ${PAY_PROFILE_COLUMNS} FROM "PayProfile" WHERE "userId" = ANY($1::text[])`,
    [userIds]
  );
  return new Map(rows.map(({ userId, ...profile }) => [userId, profile]));
}

/// Khoản hỗ trợ đang bật của từng người, kèm mức áp dụng (riêng hoặc mặc định).
export async function getAssignedAllowances(
  userIds: string[]
): Promise<Map<string, AssignedAllowance[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await query<AssignedAllowance & { userId: string }>(
    `SELECT ea."userId", a."id" AS "allowanceId", a."name", a."mode", a."taxable",
            COALESCE(ea."amount", a."amount")::float8 AS "amount"
       FROM "EmployeeAllowance" ea
       JOIN "Allowance" a ON a."id" = ea."allowanceId"
      WHERE ea."userId" = ANY($1::text[]) AND a."isActive" = true
      ORDER BY a."sortOrder" ASC, a."name" ASC`,
    [userIds]
  );
  const map = new Map<string, AssignedAllowance[]>();
  for (const { userId, ...allowance } of rows) {
    map.set(userId, [...(map.get(userId) ?? []), allowance]);
  }
  return map;
}

/// Một dòng bảng lương: đủ dữ liệu để dựng cả bảng toàn công ty lẫn phiếu
/// lương từng người, và để lưu nguyên vào ảnh chụp khi chốt.
export type PayrollRow = {
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    position: string | null;
    department: string | null;
    employmentLabel: string;
  };
  hasProfile: boolean;
  profile: PayProfile;
  contractLabel: string;
  /// Nguyên dòng bảng công tháng của người này (để dựng sheet chấm công).
  attendance: MonthSummaryRow;
  leave: { eligible: boolean; paidDays: number; unpaidDays: number; balance: number };
  overtimeDetails: {
    date: string;
    code: string;
    rate: number;
    plannedStart: string;
    plannedEnd: string;
    place: string | null;
    content: string;
    minutes: number;
  }[];
  payroll: PayrollResult;
};

export type PayrollSheet = {
  month: string;
  generatedAt: string;
  /// Ngày tính: các ngày từ đây đến hết tháng được tạm tính theo lịch.
  computedOn: string;
  projected: boolean;
  standardWorkdays: number;
  dates: string[];
  holidays: Record<string, string>;
  weeklyOffDays: number[];
  sessionCodes: string[];
  config: PayrollConfig;
  overtimeConfig: OvertimeConfig;
  /// Tên các khoản hỗ trợ có người hưởng, theo thứ tự cột.
  allowanceNames: string[];
  rows: PayrollRow[];
  closed: { closedAt: string; closedBy: string | null } | null;
};

/// Tính bảng lương tháng từ dữ liệu hiện tại. Tháng chưa hết thì hôm nay và
/// các ngày sau được tạm tính là đi làm đủ theo lịch.
export async function computeMonthPayroll(month: string): Promise<PayrollSheet> {
  const today = dateKeyVN();
  const projected = month >= monthKeyVN();
  const attendance = await computeMonthAttendance(month, { projectRemaining: projected });
  const userIds = attendance.summary.map((row) => row.user.id);
  const { endDate, startDate } = getMonthRange(month);

  const [config, overtimeConfig, profiles, allowances, users, leaveRows, overtimeRows] =
    await Promise.all([
      getPayrollConfig(),
      getOvertimeConfig(),
      getPayProfiles(userIds),
      getAssignedAllowances(userIds),
      query<{ id: string; startDate: Date | null }>(
        `SELECT "id", "startDate" FROM "User" WHERE "id" = ANY($1::text[])`,
        [userIds]
      ),
      query<{ userId: string; date: string }>(
        `SELECT "userId", "date" FROM "DayMark"
          WHERE "leaveCode" = 'N' AND "userId" = ANY($1::text[]) AND "date" <= $2
          ORDER BY "date" ASC`,
        [userIds, endDate]
      ),
      query<OvertimeRow>(
        `${OVERTIME_SELECT}
          WHERE o."status" = 'approved' AND o."userId" = ANY($1::text[])
            AND o."date" BETWEEN $2 AND $3
          ORDER BY o."date" ASC`,
        [userIds, startDate, endDate]
      ),
    ]);
  const startByUser = new Map(
    users.map((user) => [user.id, user.startDate ? dateKeyVN(user.startDate) : null])
  );
  const leaveByUser = new Map<string, string[]>();
  for (const row of leaveRows) {
    leaveByUser.set(row.userId, [...(leaveByUser.get(row.userId) ?? []), row.date]);
  }
  const overtimeViews = await buildOvertimeViews(overtimeRows);

  const rows: PayrollRow[] = attendance.summary.map((summary) => {
    const userId = summary.user.id;
    const stored = profiles.get(userId);
    const profile = stored ?? DEFAULT_PAY_PROFILE;
    const leaveStart = profile.leaveStartDate ?? startByUser.get(userId) ?? null;
    const eligible = Boolean(stored && profile.annualLeave && leaveStart);
    const leave = eligible
      ? annualLeaveForMonth({
          startDate: leaveStart!,
          month,
          leaveDates: leaveByUser.get(userId) ?? [],
          config: config.annualLeave,
        })
      : { paidDays: 0, unpaidDays: summary.leaveDays, balance: 0 };

    const payroll = computePayroll({
      profile,
      config,
      overtimeConfig,
      standardWorkdays: attendance.standardWorkdays,
      workdays: summary.workdays,
      paidLeaveDays: leave.paidDays,
      overtimeMinutes: summary.overtimeMinutes,
      allowances: stored ? (allowances.get(userId) ?? []) : [],
    });

    return {
      user: {
        id: userId,
        name: summary.user.name,
        email: summary.user.email,
        employeeCode: summary.user.employeeCode,
        position: summary.user.position,
        department: summary.user.department,
        employmentLabel: summary.user.employmentLabel,
      },
      hasProfile: Boolean(stored),
      profile,
      contractLabel: CONTRACT_LABELS[profile.contractType],
      attendance: summary,
      leave: {
        eligible,
        paidDays: leave.paidDays,
        unpaidDays: leave.unpaidDays,
        balance: leave.balance,
      },
      overtimeDetails: overtimeViews
        .filter((view) => view.user.id === userId)
        .map((view) => ({
          date: view.date,
          code: view.code,
          rate: view.rate,
          plannedStart: view.plannedStart,
          plannedEnd: view.plannedEnd,
          place: view.place,
          content: view.content,
          minutes: view.minutes,
        })),
      payroll,
    };
  });

  const allowanceNames = [
    ...new Set(rows.flatMap((row) => row.payroll.allowances.map((item) => item.name))),
  ];

  return {
    month,
    generatedAt: new Date().toISOString(),
    computedOn: today,
    projected,
    standardWorkdays: attendance.standardWorkdays,
    dates: attendance.dates,
    holidays: Object.fromEntries(attendance.holidays),
    weeklyOffDays: attendance.weeklyOffDays,
    sessionCodes: attendance.rules.map((rule) => rule.code),
    config,
    overtimeConfig,
    allowanceNames,
    rows,
    closed: null,
  };
}

/// Bảng lương của tháng: đã chốt thì đọc ảnh chụp lúc chốt, chưa thì tính mới.
export async function getMonthPayroll(month: string): Promise<PayrollSheet> {
  const closing = await queryOne<{
    snapshot: PayrollSheet;
    closedAt: Date;
    closedBy: string | null;
  }>(
    `SELECT "snapshot", "closedAt", "closedBy" FROM "PayrollClosing" WHERE "month" = $1`,
    [month]
  );
  if (closing) {
    return {
      ...closing.snapshot,
      closed: { closedAt: closing.closedAt.toISOString(), closedBy: closing.closedBy },
    };
  }
  return await computeMonthPayroll(month);
}

/// Việc admin nên xử lý trước khi chốt.
export async function payrollWarnings(sheet: PayrollSheet) {
  const { startDate, endDate } = getMonthRange(sheet.month);
  const pending = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM "OvertimeRequest"
      WHERE "status" = 'pending' AND "date" BETWEEN $1 AND $2`,
    [startDate, endDate]
  );
  return {
    missingProfiles: sheet.rows.filter((row) => !row.hasProfile).map((row) => row.user.name),
    reviewDays: sheet.rows.reduce((sum, row) => sum + row.attendance.reviewDays, 0),
    pendingOvertime: pending?.n ?? 0,
    projectedDays: sheet.rows.reduce((sum, row) => sum + row.attendance.projectedDays, 0),
  };
}
