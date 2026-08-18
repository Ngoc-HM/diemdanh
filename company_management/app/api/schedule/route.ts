import { queryOne, transaction } from "@/lib/db";
import { badRequest, handle, requireEmployee } from "@/lib/auth-guard";
import {
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
  resolveUserMonthSchedule,
} from "@/lib/attendance-service";

/// Lịch làm việc của chính nhân viên trong một tháng.
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const { searchParams } = new URL(req.url);
    const requestedMonth = searchParams.get("month");

    if (requestedMonth && !isValidMonth(requestedMonth)) {
      badRequest("Tháng không hợp lệ");
    }

    const openMonth = openRegistrationMonth();
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

    const selfScheduled = isSelfScheduled(user!.employmentType);

    return {
      month,
      employmentType: user!.employmentType,
      selfScheduled,
      canEdit: selfScheduled && isRegistrationOpen(month),
      openMonth,
      window: registrationWindow(month),
      sessions: rules,
      dates: listMonthDates(month),
      days,
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

    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");
    if (!days || typeof days !== "object" || Array.isArray(days)) {
      badRequest("Dữ liệu lịch không hợp lệ");
    }

    const user = await queryOne<{ id: string; employmentType: string }>(
      `SELECT "id", "employmentType" FROM "User" WHERE "id" = $1`,
      [session.userId]
    );
    if (!user) badRequest("Không tìm thấy tài khoản");

    if (!isSelfScheduled(user!.employmentType)) {
      badRequest("Lịch của nhân viên toàn thời gian do hệ thống sinh tự động");
    }
    if (!isRegistrationOpen(month)) {
      const window = registrationWindow(month);
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

      return registration.rows[0].submittedAt;
    });

    return {
      month,
      savedDays: entries.length,
      submittedAt: submittedAt?.toISOString() ?? null,
    };
  }, "Schedule save error");
}
