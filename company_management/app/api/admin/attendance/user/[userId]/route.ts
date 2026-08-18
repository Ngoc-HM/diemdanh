import { query, queryOne, transaction } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import {
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
  getActiveSessionRules,
  getHolidayMap,
  resolveUserMonthSchedule,
} from "@/lib/attendance-service";
import { EMPLOYMENT_TYPE_LABELS, EmploymentType } from "@/lib/schedule";

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
    const [rules, rows, holidays] = await Promise.all([
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
    ]);

    const schedule = await resolveUserMonthSchedule(user!, month, rules);

    const byDate = new Map<string, PunchRow[]>();
    for (const row of rows) {
      const list = byDate.get(row.date) ?? [];
      list.push(row);
      byDate.set(row.date, list);
    }

    const days = listMonthDates(month).map((date) => {
      const rowsForDate = byDate.get(date) ?? [];
      const punchRows = rowsForDate.filter((row) => row.punchId && row.at);
      const scheduled = schedule.get(date) ?? [];

      const evaluation = evaluateDay({
        scheduled,
        punches: punchRows.map((row) => ({
          type: row.type!,
          at: row.at!,
          withinRadius: row.withinRadius ?? true,
        })),
        isHoliday: holidays.has(date),
      });

      return {
        date,
        weekday: weekdayLabel(date),
        holidayName: holidays.get(date) ?? null,
        scheduled: scheduled.map((rule) => ({
          code: rule.code,
          name: rule.name,
          workStart: rule.workStart,
          workEnd: rule.workEnd,
          minHours: rule.minHours,
        })),
        status: evaluation.status,
        statusLabel: DAY_STATUS_LABELS[evaluation.status],
        workedHours: minutesToHours(evaluation.workedMinutes),
        requiredHours: minutesToHours(evaluation.requiredMinutes),
        missingHours: minutesToHours(evaluation.missingMinutes),
        lateMinutes: evaluation.lateMinutes,
        earlyLeaveMinutes: evaluation.earlyLeaveMinutes,
        outsideRadius: evaluation.outsideRadius,
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

    return {
      user: {
        ...user,
        employmentLabel:
          EMPLOYMENT_TYPE_LABELS[user!.employmentType as EmploymentType] ??
          user!.employmentType,
      },
      month,
      sessions: rules,
      days,
      totals: {
        passedDays: days.filter(
          (day) => day.status === "passed" || day.status === "late"
        ).length,
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

    const sorted = [...punches].sort((a, b) => a.time.localeCompare(b.time));
    if (sorted.length % 2 !== 0) badRequest("Số lần vào và ra phải bằng nhau");
    for (const [index, punch] of sorted.entries()) {
      const expected = index % 2 === 0 ? "in" : "out";
      if (punch.type !== expected) {
        badRequest("Giờ vào và giờ ra phải xen kẽ nhau theo thứ tự thời gian");
      }
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
