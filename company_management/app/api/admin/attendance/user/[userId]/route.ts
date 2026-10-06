import { NextResponse } from "next/server";
import { query, queryOne, transaction } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import {
  dateKeyVN,
  formatTimeVN,
  getMonthRange,
  isValidDateKey,
  isValidMonth,
  listMonthDates,
  monthKeyVN,
  vnDateTimeToUtc,
  weekdayLabel,
} from "@/lib/datetime";
import {
  DAY_STATUS_LABELS,
  evaluateDay,
  minutesToHours,
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
  resolveUserMonthSchedule,
} from "@/lib/attendance-service";
import {
  EMPLOYMENT_TYPE_LABELS,
  EmploymentType,
  isRestDayFor,
  standardWorkdays,
} from "@/lib/schedule";
import { toEntryView, WORK_REPORT_COLUMNS } from "@/lib/work-reports";
import { WorkReportEntryRow } from "@/lib/types";
import { getApprovedOvertime } from "@/lib/overtime-service";
import {
  buildEmployeeAttendanceWorkbook,
  employeeAttendanceFileName,
  XLSX_CONTENT_TYPE,
} from "@/lib/attendance-export";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type PunchRow = {
  date: string;
  note: string | null;
  editedAt: Date | null;
  punchId: string | null;
  type: string | null;
  at: Date | null;
  distance: number | null;
  withinRadius: boolean | null;
  isManual: boolean | null;
  locationName: string | null;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { userId } = await params;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? monthKeyVN();
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");
    const today = dateKeyVN();

    const user = await queryOne<{
      id: string;
      name: string;
      email: string;
      employeeCode: string | null;
      employmentType: string;
      department: string | null;
      position: string | null;
      isActive: boolean;
    }>(
      `SELECT "id", "name", "email", "employeeCode", "employmentType",
              "department", "position", "isActive"
         FROM "User" WHERE "id" = $1`,
      [userId]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

    const { startDate, endDate } = getMonthRange(month);
    const [rules, rows, holidays, lunchBreak, reportRows, weeklyOffDays] = await Promise.all([
      getActiveSessionRules(),
      query<PunchRow>(
        `SELECT a."date", a."note", a."editedAt",
                p."id" AS "punchId", p."type", p."at", p."distance",
                p."withinRadius", p."isManual", l."name" AS "locationName"
           FROM "Attendance" a
           LEFT JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
           LEFT JOIN "WorkLocation" l ON l."id" = p."locationId"
          WHERE a."userId" = $1 AND a."date" BETWEEN $2 AND $3
          ORDER BY a."date" ASC, p."at" ASC`,
        [userId, startDate, endDate]
      ),
      getHolidayMap(startDate, endDate),
      getLunchBreak(),
      // Nội dung công việc nhân viên tự khai, chỉ để admin xem — không tham
      // gia vào việc tính giờ công hay xếp loại ngày.
      query<WorkReportEntryRow>(
        `SELECT ${WORK_REPORT_COLUMNS} FROM "WorkReportEntry"
          WHERE "userId" = $1 AND "date" BETWEEN $2 AND $3
          ORDER BY "date" ASC, "startAt" ASC`,
        [userId, startDate, endDate]
      ),
      getWeeklyOffDays(),
    ]);

    const reportsByDate = new Map<string, WorkReportEntryRow[]>();
    for (const row of reportRows) {
      const list = reportsByDate.get(row.date) ?? [];
      list.push(row);
      reportsByDate.set(row.date, list);
    }

    const [schedule, marks, pendingRequests, reviews, overtime] = await Promise.all([
      resolveUserMonthSchedule(user!, month, rules),
      getDayMarks([userId], startDate, endDate),
      getPendingShiftRequestDates([userId], startDate, endDate),
      getDayReviews([userId], startDate, endDate),
      getApprovedOvertime([userId], month),
    ]);
    const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
    const fullDayMinutes = fullDayMinutesOf(rules);

    const byDate = new Map<string, PunchRow[]>();
    for (const row of rows) {
      const list = byDate.get(row.date) ?? [];
      list.push(row);
      byDate.set(row.date, list);
    }

    const days = listMonthDates(month).map((date) => {
      const rowsForDate = byDate.get(date) ?? [];
      const punchRows = rowsForDate.filter((row) => row.punchId && row.at);
      const reports = (reportsByDate.get(date) ?? []).map(toEntryView);
      const mark = marks.get(`${userId}|${date}`);
      const scheduled = applyDayMark(schedule.get(date) ?? [], mark, ruleById);
      const ot = overtime.get(`${userId}|${date}`);

      const evaluation = evaluateDay({
        scheduled,
        punches: punchRows.map((row) => ({
          type: row.type!,
          at: row.at!,
          withinRadius: row.withinRadius ?? true,
        })),
        isHoliday: holidays.has(date),
        isPast: date < today,
        leaveCode: mark?.leaveCode ?? null,
        lunchBreak,
        isRestDay:
          isRestDayFor(user!.employmentType, date, weeklyOffDays, holidays.has(date)) ||
          (Boolean(ot) && scheduled.length === 0),
        fullDayMinutes,
        reviewDecision: reviews.get(`${userId}|${date}`) ?? null,
      });

      return {
        date,
        weekday: weekdayLabel(date),
        adminEdited: mark?.isAdminEdit ?? false,
        // Đang có yêu cầu đổi ca chờ duyệt: dòng tô vàng để admin biết ngày đó đang treo.
        pendingRequest: pendingRequests.has(`${userId}|${date}`),
        holidayName: holidays.get(date) ?? null,
        scheduled: scheduled.map((rule) => ({
          code: rule.code,
          name: rule.name,
          workStart: rule.workStart,
          workEnd: rule.workEnd,
          minHours: rule.minHours,
        })),
        status: evaluation.status,
        countsAsWorkDay: evaluation.countsAsWorkDay,
        workdayValue: evaluation.workdayValue,
        needsReview: evaluation.needsReview,
        reviewDecision: evaluation.reviewDecision,
        overtime: ot
          ? { id: ot.id, code: ot.code, rate: ot.rate, minutes: ot.minutes, place: ot.place }
          : null,
        statusLabel: DAY_STATUS_LABELS[evaluation.status],
        workedHours: minutesToHours(evaluation.workedMinutes),
        requiredHours: minutesToHours(evaluation.requiredMinutes),
        missingHours: minutesToHours(evaluation.missingMinutes),
        lateMinutes: evaluation.lateMinutes,
        earlyLeaveMinutes: evaluation.earlyLeaveMinutes,
        outsideRadius: evaluation.outsideRadius,
        reports,
        reportMinutes: reports.reduce((sum, entry) => sum + entry.minutes, 0),
        note: rowsForDate[0]?.note ?? null,
        editedAt: rowsForDate[0]?.editedAt?.toISOString() ?? null,
        punches: punchRows.map((row) => ({
          id: row.punchId!,
          type: row.type!,
          time: formatTimeVN(row.at!),
          at: row.at!.toISOString(),
          distance: row.distance,
          withinRadius: row.withinRadius ?? true,
          isManual: row.isManual ?? false,
          locationName: row.locationName,
        })),
      };
    });

    const employmentLabel =
      EMPLOYMENT_TYPE_LABELS[user!.employmentType as EmploymentType] ??
      user!.employmentType;
    const workdays = days.reduce((sum, day) => sum + day.workdayValue, 0);
    const monthStandardWorkdays = standardWorkdays(month, weeklyOffDays);

    if (searchParams.get("export") === "xlsx") {
      const companyName = await queryOne<{ value: string }>(
        `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
      );
      const file = await buildEmployeeAttendanceWorkbook({
        month,
        companyName: companyName?.value ?? "",
        user: { ...user!, employmentLabel },
        days: days.map((day) => ({
          date: day.date,
          holidayName: day.holidayName,
          scheduledCodes: day.scheduled.map((rule) => rule.code),
          firstIn: day.punches.find((punch) => punch.type === "in")?.time ?? null,
          lastOut:
            day.punches.filter((punch) => punch.type === "out").at(-1)?.time ?? null,
          workedHours: day.workedHours,
          workdayValue: day.workdayValue,
          overtime: day.overtime,
          statusLabel:
            day.reviewDecision === "exclude"
              ? `${day.statusLabel} — không tính công`
              : day.statusLabel,
          note: day.note,
        })),
        workdays,
        standardWorkdays: monthStandardWorkdays,
        weeklyOffDays,
        exportedOn: today,
      });
      return new NextResponse(new Uint8Array(file), {
        headers: {
          "Content-Type": XLSX_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${employeeAttendanceFileName(
            month,
            user!.employeeCode,
            userId
          )}"`,
        },
      });
    }

    return {
      user: { ...user, employmentLabel },
      month,
      sessions: rules,
      days,
      totals: {
        workdays,
        standardWorkdays: monthStandardWorkdays,
        overtimeMinutes: days.reduce((sum, day) => sum + (day.overtime?.minutes ?? 0), 0),
        reviewDays: days.filter((day) => day.needsReview).length,
        lateDays: days.filter((day) => day.status === "late").length,
        absentDays: days.filter((day) => day.status === "absent").length,
        totalHours:
          Math.round(days.reduce((sum, day) => sum + day.workedHours, 0) * 10) / 10,
      },
    };
  }, "User attendance detail error");
}

/// Admin sửa hoặc bổ sung công một ngày. Ghi đè toàn bộ lần bấm giờ của ngày đó
/// và đánh dấu `isManual` để phân biệt với dữ liệu GPS thật.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { userId } = await params;
    const body = await req.json().catch(() => ({}));
    const date = String(body?.date || "");
    const note = String(body?.note || "").trim() || null;
    const rawPunches = body?.punches;

    if (!isValidDateKey(date)) badRequest("Ngày không hợp lệ");
    if (!Array.isArray(rawPunches)) badRequest("Danh sách giờ không hợp lệ");

    const user = await queryOne<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "id" = $1`,
      [userId]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

    const punches = rawPunches.map((punch: Record<string, unknown>) => ({
      type: String(punch?.type || ""),
      time: String(punch?.time || ""),
    }));

    for (const punch of punches) {
      if (punch.type !== "in" && punch.type !== "out") {
        badRequest("Loại chấm công phải là vào hoặc ra");
      }
      if (!TIME_PATTERN.test(punch.time)) {
        badRequest(`Giờ "${punch.time}" không hợp lệ, cần dạng HH:MM`);
      }
    }

    // Mỗi ngày đúng một giờ vào, giờ ra bấm bao nhiêu lần cũng được và phải
    // nằm sau giờ vào; giờ công tính theo lần ra muộn nhất.
    const sorted = [...punches].sort((a, b) => a.time.localeCompare(b.time));
    const ins = sorted.filter((punch) => punch.type === "in");
    const outs = sorted.filter((punch) => punch.type === "out");

    if (ins.length > 1) badRequest("Mỗi ngày chỉ có một giờ vào");
    if (outs.length > 0 && ins.length === 0) {
      badRequest("Có giờ ra thì phải có giờ vào");
    }
    if (ins.length === 1 && outs.some((punch) => punch.time <= ins[0].time)) {
      badRequest("Giờ ra phải sau giờ vào");
    }
    if (new Set(sorted.map((punch) => punch.time)).size !== sorted.length) {
      badRequest("Có hai lần bấm giờ trùng nhau");
    }

    await transaction(async (client) => {
      const attendance = await client.query<{ id: string }>(
        `INSERT INTO "Attendance" ("userId", "date", "note", "editedBy", "editedAt")
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT ("userId", "date")
         DO UPDATE SET "note" = $3, "editedBy" = $4, "editedAt" = now(),
                       "updatedAt" = now()
         RETURNING "id"`,
        [userId, date, note, admin.userId]
      );
      const attendanceId = attendance.rows[0].id;

      await client.query(
        `DELETE FROM "AttendancePunch" WHERE "attendanceId" = $1`,
        [attendanceId]
      );

      if (sorted.length > 0) {
        await client.query(
          `INSERT INTO "AttendancePunch"
             ("attendanceId", "type", "at", "isManual", "withinRadius")
           SELECT $1, entry.type, entry.at, true, true
             FROM unnest($2::text[], $3::timestamptz[]) AS entry(type, at)`,
          [
            attendanceId,
            sorted.map((punch) => punch.type),
            sorted.map((punch) => vnDateTimeToUtc(date, punch.time)),
          ]
        );
      }
    });

    return { success: true, date, punches: sorted.length };
  }, "Manual attendance edit error");
}
