import { query } from "@/lib/db";
import { SessionRule } from "@/lib/attendance-rules";
import { fullTimeWorkingDates, isSelfScheduled } from "@/lib/schedule";
import { WorkSessionRow } from "@/lib/types";

export type ScheduleMap = Map<string, SessionRule[]>;

const SESSION_COLUMNS = `
  "id", "code", "name", "checkInStart", "checkInEnd", "workStart", "workEnd",
  "minHours", "isDefaultFull", "isActive", "sortOrder"
`;

export async function getActiveSessionRules(): Promise<WorkSessionRow[]> {
  return await query<WorkSessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM "WorkSession"
     WHERE "isActive" = true ORDER BY "sortOrder" ASC`
  );
}

export async function getAllSessionRules(): Promise<WorkSessionRow[]> {
  return await query<WorkSessionRow>(
    `SELECT * FROM "WorkSession" ORDER BY "sortOrder" ASC`
  );
}

/// Ca mặc định áp cho nhân viên full-time. Ưu tiên ca được đánh dấu
/// `isDefaultFull`; nếu admin chưa đánh dấu thì lấy ca dài nhất trong ngày.
export function pickFullTimeSessions(rules: SessionRule[]): SessionRule[] {
  const flagged = rules.filter((rule) => rule.isDefaultFull);
  if (flagged.length > 0) return flagged;
  if (rules.length === 0) return [];
  return [
    [...rules].sort(
      (a, b) => b.minHours - a.minHours || a.sortOrder - b.sortOrder
    )[0],
  ];
}

export async function getHolidayMap(
  startDate: string,
  endDate: string
): Promise<Map<string, string>> {
  const rows = await query<{ date: string; name: string }>(
    `SELECT "date", "name" FROM "Holiday" WHERE "date" BETWEEN $1 AND $2`,
    [startDate, endDate]
  );
  return new Map(rows.map((row) => [row.date, row.name]));
}

type ScheduledUser = { id: string; employmentType: string };

/// Lịch làm việc thực tế của từng nhân viên trong tháng.
/// full-time: T2–T6 với ca mặc định, sinh tự động, không cần đăng ký.
/// part-time & intern: đúng những ca đã đăng ký.
export async function resolveMonthSchedules(
  users: ScheduledUser[],
  month: string,
  rules: SessionRule[]
): Promise<Map<string, ScheduleMap>> {
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const defaultSessions = pickFullTimeSessions(rules);
  const fullTimeDates = fullTimeWorkingDates(month);

  const selfScheduledIds = users
    .filter((user) => isSelfScheduled(user.employmentType))
    .map((user) => user.id);

  const registeredDays =
    selfScheduledIds.length > 0
      ? await query<{ userId: string; date: string; sessionId: string }>(
          `SELECT r."userId", d."date", d."sessionId"
             FROM "ScheduleDay" d
             JOIN "ScheduleRegistration" r ON r."id" = d."registrationId"
            WHERE r."month" = $1 AND r."userId" = ANY($2::text[])`,
          [month, selfScheduledIds]
        )
      : [];

  const daysByUser = new Map<string, typeof registeredDays>();
  for (const row of registeredDays) {
    const list = daysByUser.get(row.userId) ?? [];
    list.push(row);
    daysByUser.set(row.userId, list);
  }

  const result = new Map<string, ScheduleMap>();

  for (const user of users) {
    const schedule: ScheduleMap = new Map();

    if (isSelfScheduled(user.employmentType)) {
      for (const day of daysByUser.get(user.id) ?? []) {
        const rule = ruleById.get(day.sessionId);
        // Ca đã bị admin xoá khỏi danh mục thì không còn dùng để tính công.
        if (!rule) continue;
        const existing = schedule.get(day.date);
        if (existing) existing.push(rule);
        else schedule.set(day.date, [rule]);
      }
    } else if (defaultSessions.length > 0) {
      for (const date of fullTimeDates) {
        schedule.set(date, [...defaultSessions]);
      }
    }

    result.set(user.id, schedule);
  }

  return result;
}

export async function resolveUserMonthSchedule(
  user: ScheduledUser,
  month: string,
  rules: SessionRule[]
): Promise<ScheduleMap> {
  const map = await resolveMonthSchedules([user], month, rules);
  return map.get(user.id) ?? new Map();
}

/// Các lần bấm giờ của nhiều ngày công, gom theo attendanceId.
export async function getPunchesByAttendance(
  attendanceIds: string[]
): Promise<Map<string, { type: string; at: Date; withinRadius: boolean }[]>> {
  if (attendanceIds.length === 0) return new Map();

  const rows = await query<{
    attendanceId: string;
    type: string;
    at: Date;
    withinRadius: boolean;
  }>(
    `SELECT "attendanceId", "type", "at", "withinRadius"
       FROM "AttendancePunch"
      WHERE "attendanceId" = ANY($1::text[])
      ORDER BY "at" ASC`,
    [attendanceIds]
  );

  const map = new Map<string, { type: string; at: Date; withinRadius: boolean }[]>();
  for (const row of rows) {
    const list = map.get(row.attendanceId) ?? [];
    list.push({ type: row.type, at: row.at, withinRadius: row.withinRadius });
    map.set(row.attendanceId, list);
  }
  return map;
}
