import { query, queryOne, transaction } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import {
  isValidDateKey,
  isValidMonth,
  listMonthDates,
  monthKeyVN,
} from "@/lib/datetime";
import { isSelfScheduled } from "@/lib/schedule";
import {
  getActiveSessionRules,
  getHolidayMap,
  resolveMonthSchedules,
  type ScheduleMap,
} from "@/lib/attendance-service";

type EmployeeSummary = {
  id: string;
  name: string;
  email: string;
  employeeCode: string | null;
  employmentType: string;
};

/// Toàn cảnh lịch làm việc của cả công ty trong một tháng.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? monthKeyVN();
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const dates = listMonthDates(month);
    const [users, rules, holidays] = await Promise.all([
      query<EmployeeSummary>(
        `SELECT "id", "name", "email", "employeeCode", "employmentType"
           FROM "User"
          WHERE "role" = 'employee' AND "isActive" = true
          ORDER BY "employmentType" ASC, "name" ASC`
      ),
      getActiveSessionRules(),
      getHolidayMap(dates[0], dates[dates.length - 1]),
    ]);

    const schedules = await resolveMonthSchedules(users, month, rules);

    const rows = users.map((user) => {
      const schedule: ScheduleMap = schedules.get(user.id) ?? new Map();
      const days: Record<string, string[]> = {};
      let totalShifts = 0;
      let plannedHours = 0;

      for (const date of dates) {
        const sessions = schedule.get(date) ?? [];
        if (sessions.length === 0) continue;
        days[date] = sessions.map((rule) => rule.code);
        totalShifts += sessions.length;
        plannedHours += sessions.reduce((sum, rule) => sum + rule.minHours, 0);
      }

      return {
        user,
        selfScheduled: isSelfScheduled(user.employmentType),
        registered: schedule.size > 0,
        days,
        totalShifts,
        plannedHours: Math.round(plannedHours * 10) / 10,
      };
    });

    return {
      month,
      dates,
      sessions: rules,
      holidays: Object.fromEntries(holidays),
      rows,
    };
  }, "Admin schedule read error");
}

/// Admin xếp hoặc sửa lịch cho một nhân viên, không bị giới hạn cửa sổ đăng ký.
export async function PUT(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "");
    const month = body?.month;
    const days = body?.days;

    if (!userId) badRequest("Thiếu nhân viên");
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");
    if (!days || typeof days !== "object" || Array.isArray(days)) {
      badRequest("Dữ liệu lịch không hợp lệ");
    }

    const user = await queryOne<{ id: string; employmentType: string }>(
      `SELECT "id", "employmentType" FROM "User" WHERE "id" = $1`,
      [userId]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

    if (!isSelfScheduled(user!.employmentType)) {
      badRequest(
        "Nhân viên toàn thời gian dùng lịch cố định T2–T6. Đổi loại hợp đồng nếu muốn xếp lịch riêng."
      );
    }

    const rules = await getActiveSessionRules();
    const activeIds = new Set(rules.map((rule) => rule.id));
    const validDates = new Set(listMonthDates(month));

    const entries: { date: string; sessionId: string }[] = [];
    for (const [date, sessionIds] of Object.entries(
      days as Record<string, unknown>
    )) {
      if (!isValidDateKey(date) || !validDates.has(date)) {
        badRequest(`Ngày ${date} không thuộc tháng ${month}`);
      }
      if (!Array.isArray(sessionIds)) {
        badRequest(`Danh sách ca của ngày ${date} không hợp lệ`);
      }
      for (const sessionId of new Set(sessionIds.map(String))) {
        if (!activeIds.has(sessionId)) badRequest("Ca làm việc không tồn tại");
        entries.push({ date, sessionId });
      }
    }

    await transaction(async (client) => {
      const registration = await client.query<{ id: string }>(
        `INSERT INTO "ScheduleRegistration" ("userId", "month", "submittedAt", "updatedBy")
         VALUES ($1, $2, now(), $3)
         ON CONFLICT ("userId", "month")
         DO UPDATE SET "submittedAt" = now(), "updatedBy" = $3, "updatedAt" = now()
         RETURNING "id"`,
        [userId, month, admin.userId]
      );
      const registrationId = registration.rows[0].id;

      await client.query(`DELETE FROM "ScheduleDay" WHERE "registrationId" = $1`, [
        registrationId,
      ]);

      if (entries.length > 0) {
        await client.query(
          `INSERT INTO "ScheduleDay" ("registrationId", "date", "sessionId")
           SELECT $1, entry.date, entry.session
             FROM unnest($2::text[], $3::text[]) AS entry(date, session)`,
          [
            registrationId,
            entries.map((entry) => entry.date),
            entries.map((entry) => entry.sessionId),
          ]
        );
      }
    });

    return { userId, month, savedDays: entries.length };
  }, "Admin schedule save error");
}
