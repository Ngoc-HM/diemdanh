import { query, queryOne, transaction } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import {
  dateKeyVN,
  isValidDateKey,
  isValidMonth,
  listMonthDates,
  monthKeyVN,
} from "@/lib/datetime";
import { isSelfScheduled } from "@/lib/schedule";
import {
  applyDayMark,
  getActiveSessionRules,
  getDayMarks,
  getHolidayMap,
  getPendingShiftRequestDates,
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

/// Toàn cảnh lịch làm việc của cả công ty trong một tháng, đã áp các đánh dấu
/// ngày (nghỉ N / ốm O / admin đổi ca) để khớp với bảng chấm công và với lịch
/// nhân viên tự thấy.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? monthKeyVN();
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const dates = listMonthDates(month);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const today = dateKeyVN();

    const [users, rules, holidays] = await Promise.all([
      query<EmployeeSummary>(
        `SELECT "id", "name", "email", "employeeCode", "employmentType"
           FROM "User"
          WHERE "role" = 'employee' AND "isActive" = true
          ORDER BY "employmentType" ASC, "name" ASC`
      ),
      getActiveSessionRules(),
      getHolidayMap(startDate, endDate),
    ]);
    const userIds = users.map((user) => user.id);

    const [schedules, marks, registrations, pendingRequests, punchCounts] =
      await Promise.all([
        resolveMonthSchedules(users, month, rules),
        getDayMarks(userIds, startDate, endDate),
        userIds.length > 0
          ? query<{ userId: string }>(
              `SELECT "userId" FROM "ScheduleRegistration"
                WHERE "month" = $1 AND "userId" = ANY($2::text[])`,
              [month, userIds]
            )
          : Promise.resolve([]),
        getPendingShiftRequestDates(userIds, startDate, endDate),
        // Chỉ cần biết ngày nào có bấm giờ để tô vắng / ngoài lịch, không
        // cần ghép cặp vào-ra như bảng chấm công; đếm một câu cho cả tháng.
        userIds.length > 0
          ? query<{ userId: string; date: string; punches: number }>(
              `SELECT a."userId", a."date", COUNT(p."id")::int AS "punches"
                 FROM "Attendance" a
                 JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
                WHERE a."date" BETWEEN $1 AND $2
                  AND a."userId" = ANY($3::text[])
                GROUP BY a."userId", a."date"`,
              [startDate, endDate, userIds]
            )
          : Promise.resolve([]),
      ]);
    const registeredIds = new Set(registrations.map((row) => row.userId));
    const punchedDates = new Set(
      punchCounts
        .filter((row) => row.punches > 0)
        .map((row) => `${row.userId}|${row.date}`)
    );
    const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

    const rows = users.map((user) => {
      const schedule: ScheduleMap = schedules.get(user.id) ?? new Map();
      const days: Record<string, string[]> = {};
      const leaves: Record<string, "N" | "O"> = {};
      /// Ngày đang có yêu cầu đổi ca chờ duyệt.
      const pendingDates: string[] = [];
      /// Ngày đã qua, có ca mà không bấm giờ (khác nghỉ N đã xin).
      const absentDates: string[] = [];
      /// Ngày có bấm giờ nhưng không có ca nào — vẫn tính công.
      const unscheduledDates: string[] = [];
      let totalShifts = 0;
      let plannedHours = 0;

      for (const date of dates) {
        const key = `${user.id}|${date}`;
        const mark = marks.get(key);
        if (mark?.leaveCode) leaves[date] = mark.leaveCode;
        if (pendingRequests.has(key)) pendingDates.push(date);

        const sessions = applyDayMark(schedule.get(date) ?? [], mark, ruleById);
        const punched = punchedDates.has(key);
        // Cùng quy tắc với evaluateDay: nghỉ/ốm đã đánh dấu thì không phải
        // vắng hay ngoài lịch; ngày lễ có lịch mà không đi cũng không tính vắng.
        const excused = Boolean(mark?.leaveCode);

        if (sessions.length === 0) {
          if (punched && !excused) unscheduledDates.push(date);
          continue;
        }
        days[date] = sessions.map((rule) => rule.code);
        totalShifts += sessions.length;
        plannedHours += sessions.reduce((sum, rule) => sum + rule.minHours, 0);

        if (date < today && !punched && !excused && !holidays.has(date)) {
          absentDates.push(date);
        }
      }

      const selfScheduled = isSelfScheduled(user.employmentType);
      return {
        user,
        selfScheduled,
        // part-time/intern: đã nộp lịch chưa. full-time: admin có xếp riêng
        // cho tháng này không (không thì đang dùng lịch cố định).
        registered: selfScheduled ? schedule.size > 0 : registeredIds.has(user.id),
        days,
        leaves,
        pendingDates,
        absentDates,
        unscheduledDates,
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
/// Với nhân viên toàn thời gian, lịch lưu ở đây thay cho lịch cố định của tháng
/// đó. Ngày nào được gán ca thì đánh dấu nghỉ/ốm/đổi ca cũ của ngày đó bị gỡ:
/// lịch admin vừa lưu là lịch có hiệu lực.
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

    const user = await queryOne<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "id" = $1`,
      [userId]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

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

      const touchedDates = [...new Set(entries.map((entry) => entry.date))];
      if (touchedDates.length > 0) {
        await client.query(
          `DELETE FROM "DayMark" WHERE "userId" = $1 AND "date" = ANY($2::text[])`,
          [userId, touchedDates]
        );
      }
    });

    return { userId, month, savedDays: entries.length };
  }, "Admin schedule save error");
}
