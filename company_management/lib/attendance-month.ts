import { query } from "@/lib/db";
import { dateKeyVN, getMonthRange, listMonthDates } from "@/lib/datetime";
import {
  dayCellLabel,
  evaluateDay,
  minutesToHours,
  PunchInput,
} from "@/lib/attendance-rules";
import {
  applyDayMark,
  fullDayMinutesOf,
  getActiveSessionRules,
  getDayMarks,
  getDayReviews,
  getHolidayMap,
  getLunchBreak,
  getPendingShiftRequestDates,
  getWeeklyOffDays,
  resolveMonthSchedules,
  type ScheduleMap,
} from "@/lib/attendance-service";
import {
  EMPLOYMENT_TYPE_LABELS,
  EmploymentType,
  isRestDayFor,
  standardWorkdays,
} from "@/lib/schedule";
import { getApprovedOvertime } from "@/lib/overtime-service";
import { OVERTIME_CODES } from "@/lib/overtime";

export type MonthEmployee = {
  id: string;
  name: string;
  email: string;
  employeeCode: string | null;
  employmentType: string;
  department: string | null;
  position: string | null;
};

export type MonthDayCell = {
  status: string;
  label: string;
  codes: string[];
  workedHours: number;
  lateMinutes: number;
  outsideRadius: boolean;
  adminEdited: boolean;
  /// Đang có yêu cầu đổi ca chờ duyệt cho ngày này.
  pendingRequest: boolean;
  /// Số công của ngày (1 = x, 0,5 = x/2).
  workdayValue: number;
  /// Thiếu giờ, admin chưa xem lại.
  needsReview: boolean;
  /// Phiếu OT đã duyệt của ngày này.
  overtime: { code: string; minutes: number } | null;
  /// Ngày chưa tới (hoặc hôm nay chưa xong) được tạm tính đủ theo lịch.
  projected: boolean;
};

export type MonthSummaryRow = {
  user: MonthEmployee & { employmentLabel: string };
  days: Record<string, MonthDayCell>;
  workdays: number;
  reviewDays: number;
  /// Số phút OT đã duyệt theo ký hiệu T / T1 / T2.
  overtimeMinutes: Record<string, number>;
  lateDays: number;
  absentDays: number;
  /// Ngày nghỉ N (phép năm tính ở bảng lương).
  leaveDays: number;
  sickDays: number;
  missedCheckoutDays: number;
  attendanceDays: number;
  scheduledShifts: number;
  /// Số ngày được tạm tính theo lịch (chỉ khi bật projectRemaining).
  projectedDays: number;
  totalHours: number;
  sessions: Record<string, number>;
};

/// Bảng công tháng của nhân viên đang hoạt động — dùng chung cho trang bảng
/// chấm công, file Excel và bảng lương, để mọi nơi ra cùng một con số.
///
/// `projectRemaining`: tạm tính các ngày từ hôm nay đến hết tháng là đi làm
/// đủ theo lịch (ngày đã đăng ký nghỉ thì không). Bảng lương dùng khi chốt
/// lương trước cuối tháng.
export async function computeMonthAttendance(
  month: string,
  options: { userIds?: string[]; projectRemaining?: boolean } = {}
) {
  const today = dateKeyVN();
  const { startDate, endDate, daysInMonth } = getMonthRange(month);
  const dates = listMonthDates(month);

  const [allUsers, rules, punchRows, holidays, lunchBreak, weeklyOffDays] =
    await Promise.all([
      query<MonthEmployee>(
        `SELECT "id", "name", "email", "employeeCode", "employmentType",
                "department", "position"
           FROM "User"
          WHERE "role" = 'employee' AND "isActive" = true
          ORDER BY "name" ASC`
      ),
      getActiveSessionRules(),
      query<{ userId: string; date: string; type: string; at: Date; withinRadius: boolean }>(
        `SELECT a."userId", a."date", p."type", p."at", p."withinRadius"
           FROM "Attendance" a
           JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
          WHERE a."date" BETWEEN $1 AND $2
          ORDER BY a."userId", a."date", p."at" ASC`,
        [startDate, endDate]
      ),
      getHolidayMap(startDate, endDate),
      getLunchBreak(),
      getWeeklyOffDays(),
    ]);

  const users = options.userIds
    ? allUsers.filter((user) => options.userIds!.includes(user.id))
    : allUsers;
  const userIds = users.map((user) => user.id);
  const [schedules, marks, pendingRequests, reviews, overtime] = await Promise.all([
    resolveMonthSchedules(users, month, rules),
    getDayMarks(userIds, startDate, endDate),
    getPendingShiftRequestDates(userIds, startDate, endDate),
    getDayReviews(userIds, startDate, endDate),
    getApprovedOvertime(userIds, month),
  ]);
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const fullDayMinutes = fullDayMinutesOf(rules);

  const punchesByUser = new Map<string, Map<string, PunchInput[]>>();
  for (const row of punchRows) {
    const byDate = punchesByUser.get(row.userId) ?? new Map<string, PunchInput[]>();
    const list = byDate.get(row.date) ?? [];
    list.push({ type: row.type, at: row.at, withinRadius: row.withinRadius });
    byDate.set(row.date, list);
    punchesByUser.set(row.userId, byDate);
  }

  const summary: MonthSummaryRow[] = users.map((user) => {
    const schedule: ScheduleMap = schedules.get(user.id) ?? new Map();
    const byDate = punchesByUser.get(user.id) ?? new Map<string, PunchInput[]>();
    const days: Record<string, MonthDayCell> = {};
    const overtimeMinutes: Record<string, number> = Object.fromEntries(
      Object.values(OVERTIME_CODES).map((code) => [code, 0])
    );
    const sessionCounts: Record<string, number> = Object.fromEntries(
      rules.map((rule) => [rule.code, 0])
    );
    let workdays = 0;
    let reviewDays = 0;
    let lateDays = 0;
    let missedCheckoutDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let sickDays = 0;
    let attendanceDays = 0;
    let totalMinutes = 0;
    let scheduledShifts = 0;
    let projectedDays = 0;

    for (const date of dates) {
      const mark = marks.get(`${user.id}|${date}`);
      const pendingRequest = pendingRequests.has(`${user.id}|${date}`);
      const scheduled = applyDayMark(schedule.get(date) ?? [], mark, ruleById);
      const punches = byDate.get(date) ?? [];
      scheduledShifts += scheduled.length;

      const isHoliday = holidays.has(date);
      const ot = overtime.get(`${user.id}|${date}`);
      const evaluation = evaluateDay({
        scheduled,
        punches,
        isHoliday,
        isPast: date < today,
        leaveCode: mark?.leaveCode ?? null,
        lunchBreak,
        // Ngày không có ca mà có phiếu OT đã duyệt là ngày làm thêm: trả
        // theo giờ OT, không cộng thêm công "ngoài lịch".
        isRestDay:
          isRestDayFor(user.employmentType, date, weeklyOffDays, isHoliday) ||
          (Boolean(ot) && scheduled.length === 0),
        fullDayMinutes,
        reviewDecision: reviews.get(`${user.id}|${date}`) ?? null,
      });

      // Chốt lương trước cuối tháng: hôm nay và các ngày sau coi như đi làm
      // đủ theo lịch. Ngày đã đăng ký nghỉ thì lịch rỗng nên không cộng gì.
      const scheduledValue = scheduled.reduce(
        (total, rule) => total + (rule.workdayValue ?? 1),
        0
      );
      const projected =
        Boolean(options.projectRemaining) &&
        date >= today &&
        !mark?.leaveCode &&
        scheduledValue > evaluation.workdayValue;
      const workdayValue = projected ? scheduledValue : evaluation.workdayValue;

      // Ngày trống vẫn phải có ô nếu đang chờ duyệt đổi ca, để lưới tô vàng được.
      if (
        evaluation.status === "off" &&
        punches.length === 0 &&
        !mark &&
        !pendingRequest &&
        !ot
      ) {
        continue;
      }

      const baseLabel = dayCellLabel(evaluation);
      if (ot) overtimeMinutes[ot.code] = (overtimeMinutes[ot.code] ?? 0) + ot.minutes;

      days[date] = {
        status: evaluation.status,
        adminEdited: mark?.isAdminEdit ?? false,
        pendingRequest,
        // Ngày có OT: thêm ký hiệu OT; ngày chỉ có OT (không có công) thì
        // chỉ hiện ký hiệu OT.
        label: ot ? (workdayValue > 0 ? `${baseLabel}+${ot.code}` : ot.code) : baseLabel,
        codes: evaluation.codes,
        workedHours: minutesToHours(evaluation.workedMinutes),
        lateMinutes: evaluation.lateMinutes,
        outsideRadius: evaluation.outsideRadius,
        workdayValue,
        needsReview: evaluation.needsReview,
        overtime: ot ? { code: ot.code, minutes: ot.minutes } : null,
        projected,
      };

      totalMinutes += evaluation.workedMinutes;
      if (punches.length > 0) attendanceDays++;
      if (evaluation.needsReview) reviewDays++;
      if (projected) projectedDays++;
      workdays += workdayValue;
      // Cột đếm ca chỉ tính ca thực sự đi làm, không tính ngày lễ được hưởng công.
      if (evaluation.countsAsWorkDay && evaluation.status !== "holiday") {
        for (const code of evaluation.codes) {
          sessionCounts[code] = (sessionCounts[code] || 0) + 1;
        }
      }
      if (evaluation.status === "late") lateDays++;
      if (evaluation.status === "absent" && !projected) absentDays++;
      if (evaluation.status === "leave") leaveDays++;
      if (evaluation.status === "sick") sickDays++;
      if (evaluation.status === "missed_out") missedCheckoutDays++;
    }

    return {
      user: {
        ...user,
        employmentLabel:
          EMPLOYMENT_TYPE_LABELS[user.employmentType as EmploymentType] ??
          user.employmentType,
      },
      days,
      workdays,
      reviewDays,
      overtimeMinutes,
      lateDays,
      absentDays,
      leaveDays,
      sickDays,
      missedCheckoutDays,
      attendanceDays,
      scheduledShifts,
      projectedDays,
      totalHours: minutesToHours(totalMinutes),
      sessions: sessionCounts,
    };
  });

  return {
    month,
    today,
    dates,
    daysInMonth,
    rules,
    holidays,
    weeklyOffDays,
    standardWorkdays: standardWorkdays(month, weeklyOffDays),
    summary,
  };
}
