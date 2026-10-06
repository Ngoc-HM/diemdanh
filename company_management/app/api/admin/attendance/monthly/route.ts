import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import {
  dateKeyVN,
  getMonthRange,
  isValidMonth,
  listMonthDates,
  monthKeyVN,
} from "@/lib/datetime";
import {
  DAY_STATUS_LABELS,
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
import {
  attendanceFileName,
  buildAttendanceWorkbook,
  XLSX_CONTENT_TYPE,
} from "@/lib/attendance-export";

type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  employeeCode: string | null;
  employmentType: string;
  department: string | null;
};

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? monthKeyVN();
    const today = dateKeyVN();
    // Giữ cả `export=csv` của link cũ: giờ luôn trả về file Excel.
    const wantsExcel = ["xlsx", "csv"].includes(searchParams.get("export") ?? "");

    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const { startDate, endDate, daysInMonth } = getMonthRange(month);
    const dates = listMonthDates(month);

    const [users, rules, punchRows, holidays, lunchBreak, weeklyOffDays] = await Promise.all([
      query<EmployeeRow>(
        `SELECT "id", "name", "email", "employeeCode", "employmentType", "department"
           FROM "User"
          WHERE "role" = 'employee' AND "isActive" = true
          ORDER BY "name" ASC`
      ),
      getActiveSessionRules(),
      query<{
        userId: string;
        date: string;
        type: string;
        at: Date;
        withinRadius: boolean;
      }>(
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
    const monthStandardWorkdays = standardWorkdays(month, weeklyOffDays);

    // Gom punch theo userId -> date.
    const punchesByUser = new Map<string, Map<string, PunchInput[]>>();
    for (const row of punchRows) {
      const byDate = punchesByUser.get(row.userId) ?? new Map<string, PunchInput[]>();
      const list = byDate.get(row.date) ?? [];
      list.push({ type: row.type, at: row.at, withinRadius: row.withinRadius });
      byDate.set(row.date, list);
      punchesByUser.set(row.userId, byDate);
    }

    const summary = users.map((user) => {
      const schedule: ScheduleMap = schedules.get(user.id) ?? new Map();
      const byDate = punchesByUser.get(user.id) ?? new Map<string, PunchInput[]>();

      const days: Record<
        string,
        {
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
        }
      > = {};
      const overtimeMinutes: Record<string, number> = Object.fromEntries(
        Object.values(OVERTIME_CODES).map((code) => [code, 0])
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
      const sessionCounts: Record<string, number> = Object.fromEntries(
        rules.map((rule) => [rule.code, 0])
      );

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
          label: ot
            ? evaluation.workdayValue > 0
              ? `${baseLabel}+${ot.code}`
              : ot.code
            : baseLabel,
          codes: evaluation.codes,
          workedHours: minutesToHours(evaluation.workedMinutes),
          lateMinutes: evaluation.lateMinutes,
          outsideRadius: evaluation.outsideRadius,
          workdayValue: evaluation.workdayValue,
          needsReview: evaluation.needsReview,
          overtime: ot ? { code: ot.code, minutes: ot.minutes } : null,
        };

        totalMinutes += evaluation.workedMinutes;
        if (punches.length > 0) attendanceDays++;
        if (evaluation.needsReview) reviewDays++;
        if (evaluation.countsAsWorkDay) {
          workdays += evaluation.workdayValue;
        }
        // Cột đếm ca chỉ tính ca thực sự đi làm, không tính ngày lễ được hưởng công.
        if (evaluation.countsAsWorkDay && evaluation.status !== "holiday") {
          for (const code of evaluation.codes) {
            sessionCounts[code] = (sessionCounts[code] || 0) + 1;
          }
        }
        if (evaluation.status === "late") lateDays++;
        if (evaluation.status === "absent") absentDays++;
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
        /// Số phút OT đã duyệt theo ký hiệu T / T1 / T2.
        overtimeMinutes,
        lateDays,
        absentDays,
        leaveDays,
        sickDays,
        missedCheckoutDays,
        attendanceDays,
        scheduledShifts,
        totalHours: minutesToHours(totalMinutes),
        sessions: sessionCounts,
      };
    });

    if (wantsExcel) {
      // Tên công ty chỉ cần khi xuất file, nên tra ở đây.
      const companyName = await queryOne<{ value: string }>(
        `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
      );

      const file = await buildAttendanceWorkbook({
        month,
        dates,
        sessionCodes: rules.map((rule) => rule.code),
        rows: summary,
        companyName: companyName?.value ?? "",
        holidays: Object.fromEntries(holidays),
        weeklyOffDays,
        standardWorkdays: monthStandardWorkdays,
        exportedOn: today,
      });

      return new NextResponse(new Uint8Array(file), {
        headers: {
          "Content-Type": XLSX_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${attendanceFileName(month)}"`,
        },
      });
    }

    return {
      month,
      daysInMonth,
      dates,
      sessions: rules,
      holidays: Object.fromEntries(holidays),
      statusLabels: DAY_STATUS_LABELS,
      standardWorkdays: monthStandardWorkdays,
      summary,
    };
  }, "Monthly attendance error");
}
