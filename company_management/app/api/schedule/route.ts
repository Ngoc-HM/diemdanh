import { query, queryOne, transaction } from "@/lib/db";
import { badRequest, handle, requireEmployee } from "@/lib/auth-guard";
import {
  dateKeyVN,
  getMonthRange,
  isValidMonth,
  isValidDateKey,
  listMonthDates,
  monthKeyVN,
} from "@/lib/datetime";
import {
  isRegistrationOpen,
  isSelfScheduled,
  openRegistrationMonth,
  registrationWindow,
} from "@/lib/schedule";
import {
  getActiveSessionRules,
  getDayMarks,
  getHolidayMap,
  getPendingShiftRequestDates,
  getRegistrationWindowConfig,
  resolveUserMonthSchedule,
} from "@/lib/attendance-service";

/// Lịch làm việc của chính nhân viên trong một tháng, kèm ba nhóm ngày để lưới
/// tô màu: đang chờ duyệt đổi ca, có lịch mà không đi (đỏ), đi làm không có
/// lịch (vàng, vẫn tính công).
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const { searchParams } = new URL(req.url);
    const requestedMonth = searchParams.get("month");

    if (requestedMonth && !isValidMonth(requestedMonth)) {
      badRequest("Tháng không hợp lệ");
    }

    const windowConfig = await getRegistrationWindowConfig();
    const openMonth = openRegistrationMonth(windowConfig);
    const month = requestedMonth ?? openMonth ?? monthKeyVN();

    const user = await queryOne<{ id: string; employmentType: string }>(
      `SELECT "id", "employmentType" FROM "User" WHERE "id" = $1`,
      [session.userId]
    );
    if (!user) badRequest("Không tìm thấy tài khoản");

    const rules = await getActiveSessionRules();
    const schedule = await resolveUserMonthSchedule(user!, month, rules);

    const days: Record<string, string[]> = {};
    for (const [date, sessions] of schedule) {
      days[date] = sessions.map((rule) => rule.id);
    }

    const { startDate, endDate } = getMonthRange(month);
    const [marks, holidays, pending, punchRows] = await Promise.all([
      getDayMarks([user!.id], startDate, endDate),
      getHolidayMap(startDate, endDate),
      getPendingShiftRequestDates([user!.id], startDate, endDate),
      // Chỉ cần biết ngày nào có bấm giờ, không cần xếp loại đầy đủ như
      // /api/attendance — đủ để phân biệt vắng với đi làm ngoài lịch.
      query<{ date: string; punches: number }>(
        `SELECT a."date", COUNT(p."id")::int AS "punches"
           FROM "Attendance" a
           JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
          WHERE a."userId" = $1 AND a."date" BETWEEN $2 AND $3
          GROUP BY a."date"`,
        [user!.id, startDate, endDate]
      ),
    ]);

    const offDays: string[] = [];
    const adminEdited: string[] = [];
    // Ngày nghỉ/ốm không bao giờ bị tính vắng hay ngoài lịch.
    const leaveDates = new Set<string>();
    for (const mark of marks.values()) {
      if (mark.leaveCode === "N") offDays.push(mark.date);
      if (mark.isAdminEdit) adminEdited.push(mark.date);
      // Admin đổi ca thì lịch hiển thị phải theo ca admin đặt.
      if (mark.sessionIds && !mark.leaveCode) days[mark.date] = mark.sessionIds;
      if (mark.leaveCode) {
        leaveDates.add(mark.date);
        delete days[mark.date];
      }
    }

    const dates = listMonthDates(month);
    const today = dateKeyVN();
    const punchedDates = new Set(punchRows.map((row) => row.date));
    const absentDates: string[] = [];
    const unscheduledDates: string[] = [];
    for (const date of dates) {
      if (holidays.has(date) || leaveDates.has(date)) continue;
      const hasShift = (days[date]?.length ?? 0) > 0;
      const punched = punchedDates.has(date);
      // Vắng chỉ kết luận được khi ngày đã qua; hôm nay chưa bấm giờ thì
      // có thể còn đang trên đường đến.
      if (hasShift && !punched && date < today) absentDates.push(date);
      // Ngoài lịch tính cả hôm nay: đã bấm giờ là đã đi làm.
      if (!hasShift && punched) unscheduledDates.push(date);
    }
    // Khoá của set là `userId|date`; chỉ có một nhân viên nên lấy phần ngày.
    const pendingDates = [...pending].map((key) => key.slice(key.indexOf("|") + 1));

    const selfScheduled = isSelfScheduled(user!.employmentType);

    return {
      month,
      employmentType: user!.employmentType,
      selfScheduled,
      canEdit: selfScheduled && isRegistrationOpen(month, windowConfig),
      openMonth,
      window: registrationWindow(month, windowConfig),
      sessions: rules,
      dates,
      days,
      offDays,
      adminEdited,
      pendingDates,
      absentDates,
      unscheduledDates,
    };
  }, "Schedule read error");
}

/// Nhân viên part-time/intern lưu lịch tháng T+1. Chỉ nhận trong cửa sổ đăng ký.
export async function PUT(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const body = await req.json().catch(() => ({}));
    const month = body?.month;
    const days = body?.days;
    const rawOffDays = body?.offDays ?? [];

    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");
    if (!days || typeof days !== "object" || Array.isArray(days)) {
      badRequest("Dữ liệu lịch không hợp lệ");
    }
    if (!Array.isArray(rawOffDays)) badRequest("Danh sách ngày nghỉ không hợp lệ");

    const user = await queryOne<{ id: string; employmentType: string }>(
      `SELECT "id", "employmentType" FROM "User" WHERE "id" = $1`,
      [session.userId]
    );
    if (!user) badRequest("Không tìm thấy tài khoản");

    if (!isSelfScheduled(user!.employmentType)) {
      badRequest("Lịch của nhân viên toàn thời gian do hệ thống sinh tự động");
    }
    const windowConfig = await getRegistrationWindowConfig();
    if (!isRegistrationOpen(month, windowConfig)) {
      const window = registrationWindow(month, windowConfig);
      badRequest(
        `Đã ngoài hạn đăng ký. Lịch tháng này chỉ nhận từ ${window.opensOn} đến ${window.closesOn}.`
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
        if (!activeIds.has(sessionId)) {
          badRequest("Ca làm việc không tồn tại hoặc đã ngừng dùng");
        }
        entries.push({ date, sessionId });
      }
    }

    const offDays = [...new Set(rawOffDays.map(String))];
    for (const date of offDays) {
      if (!isValidDateKey(date) || !validDates.has(date)) {
        badRequest(`Ngày nghỉ ${date} không thuộc tháng ${month}`);
      }
      if (entries.some((entry) => entry.date === date)) {
        badRequest(`Ngày ${date} vừa đăng ký nghỉ vừa đăng ký ca`);
      }
    }

    const { startDate, endDate } = getMonthRange(month);

    const submittedAt = await transaction(async (client) => {
      const registration = await client.query<{ id: string; submittedAt: Date }>(
        `INSERT INTO "ScheduleRegistration" ("userId", "month", "submittedAt", "updatedBy")
         VALUES ($1, $2, now(), $1)
         ON CONFLICT ("userId", "month")
         DO UPDATE SET "submittedAt" = now(), "updatedBy" = $1, "updatedAt" = now()
         RETURNING "id", "submittedAt"`,
        [user!.id, month]
      );
      const registrationId = registration.rows[0].id;

      await client.query(`DELETE FROM "ScheduleDay" WHERE "registrationId" = $1`, [
        registrationId,
      ]);

      if (entries.length > 0) {
        // unnest cho phép chèn cả mảng trong một câu lệnh duy nhất.
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

      // Ngày nghỉ N do nhân viên tự đặt; không đụng vào ô admin đã sửa.
      await client.query(
        `DELETE FROM "DayMark"
          WHERE "userId" = $1 AND "date" BETWEEN $2 AND $3
            AND "isAdminEdit" = false`,
        [user!.id, startDate, endDate]
      );

      if (offDays.length > 0) {
        await client.query(
          `INSERT INTO "DayMark" ("userId", "date", "leaveCode")
           SELECT $1, entry.date, 'N' FROM unnest($2::text[]) AS entry(date)
           ON CONFLICT ("userId", "date") DO NOTHING`,
          [user!.id, offDays]
        );
      }

      return registration.rows[0].submittedAt;
    });

    return {
      month,
      savedDays: entries.length,
      savedOffDays: offDays.length,
      submittedAt: submittedAt?.toISOString() ?? null,
    };
  }, "Schedule save error");
}
