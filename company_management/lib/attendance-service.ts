import { query, queryOne } from "@/lib/db";
import {
  LunchBreak,
  parseLunchBreak,
  ReviewDecision,
  SessionRule,
} from "@/lib/attendance-rules";
import {
  DEFAULT_WEEKLY_OFF_DAYS,
  fullTimeWorkingDates,
  isSelfScheduled,
  parseRegistrationWindow,
  RegistrationWindowConfig,
} from "@/lib/schedule";
import { listDateRange } from "@/lib/datetime";
import { HolidayRow, WorkSessionRow } from "@/lib/types";


export type ScheduleMap = Map<string, SessionRule[]>;

export type DayMark = {
  userId: string;
  date: string;
  leaveCode: "N" | "O" | null;
  sessionIds: string[] | null;
  isAdminEdit: boolean;
};

/// Đánh dấu ngày (nghỉ N / ốm O / admin đổi ca) của một nhóm nhân viên trong
/// khoảng ngày. Khoá của map là `userId|date`.
export async function getDayMarks(
  userIds: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, DayMark>> {
  if (userIds.length === 0) return new Map();
  const rows = await query<DayMark>(
    `SELECT "userId", "date", "leaveCode", "sessionIds", "isAdminEdit"
       FROM "DayMark"
      WHERE "userId" = ANY($1::text[]) AND "date" BETWEEN $2 AND $3`,
    [userIds, startDate, endDate]
  );
  return new Map(rows.map((row) => [`${row.userId}|${row.date}`, row]));
}

/// Quyết định của admin cho các ngày thiếu giờ, khoá `userId|date`.
export async function getDayReviews(
  userIds: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, ReviewDecision>> {
  if (userIds.length === 0) return new Map();
  const rows = await query<{ userId: string; date: string; decision: ReviewDecision }>(
    `SELECT "userId", "date", "decision" FROM "DayReview"
      WHERE "userId" = ANY($1::text[]) AND "date" BETWEEN $2 AND $3`,
    [userIds, startDate, endDate]
  );
  return new Map(rows.map((row) => [`${row.userId}|${row.date}`, row.decision]));
}

/// Ngưỡng một ngày công cho ngày làm ngoài lịch: số giờ tối thiểu của bộ ca
/// mặc định full-time (thường là ca CN).
export function fullDayMinutesOf(rules: SessionRule[]): number {
  const minutes = pickFullTimeSessions(rules).reduce(
    (total, rule) => total + rule.minHours * 60,
    0
  );
  return minutes > 0 ? Math.round(minutes) : 7 * 60;
}

/// Ca thực tế của một ngày sau khi áp đánh dấu: admin đổi ca thì lấy ca mới,
/// ngày nghỉ/ốm thì không còn ca nào.
export function applyDayMark(
  scheduled: SessionRule[],
  mark: DayMark | undefined,
  ruleById: Map<string, SessionRule>
): SessionRule[] {
  if (!mark) return scheduled;
  if (mark.leaveCode) return [];
  if (!mark.sessionIds) return scheduled;
  return mark.sessionIds
    .map((id) => ruleById.get(id))
    .filter((rule): rule is SessionRule => Boolean(rule));
}

const SESSION_COLUMNS = `
  "id", "code", "name", "workStart", "workEnd",
  "minHours", "workdayValue", "isDefaultFull", "isActive", "sortOrder"
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

/// Bung mọi đợt nghỉ lễ (mỗi đợt trải từ startDate tới endDate) thành
/// map ngày -> tên, để việc chấm công tra cứu từng ngày một.
export async function getHolidayMap(
  startDate: string,
  endDate: string
): Promise<Map<string, string>> {
  const rows = await query<Pick<HolidayRow, "startDate" | "endDate" | "name">>(
    `SELECT "startDate", "endDate", "name" FROM "Holiday"
      WHERE "startDate" <= $2 AND "endDate" >= $1`,
    [startDate, endDate]
  );

  const map = new Map<string, string>();
  for (const row of rows) {
    const from = row.startDate > startDate ? row.startDate : startDate;
    const to = row.endDate < endDate ? row.endDate : endDate;
    for (const date of listDateRange(from, to)) {
      map.set(date, row.name);
    }
  }
  return map;
}

/// Ngày nghỉ cố định hằng tuần (0 = CN ... 6 = T7), admin chỉnh trong
/// trang Ngày lễ. Chưa cấu hình thì mặc định nghỉ Thứ 7 + Chủ nhật.
export async function getWeeklyOffDays(): Promise<number[]> {
  const setting = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'weekly_off_days'`
  );
  if (!setting) return [...DEFAULT_WEEKLY_OFF_DAYS];
  const days = setting.value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return [...new Set(days)];
}

/// Những ngày đang có yêu cầu đổi ca chờ duyệt của một nhóm nhân viên, khoá
/// `userId|date`. Lưới lịch và bảng công tô vàng các ngày này để cả admin lẫn
/// nhân viên biết ngày đó đang treo.
export async function getPendingShiftRequestDates(
  userIds: string[],
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await query<{ userId: string; date: string }>(
    `SELECT "userId", "date" FROM "ShiftChangeRequest"
      WHERE "status" = 'pending'
        AND "userId" = ANY($1::text[]) AND "date" BETWEEN $2 AND $3`,
    [userIds, startDate, endDate]
  );
  return new Set(rows.map((row) => `${row.userId}|${row.date}`));
}

/// Cửa sổ đăng ký lịch tháng sau (ngày mở / ngày đóng trong tháng trước đó),
/// admin đặt ở trang Lịch làm việc. Chưa đặt thì dùng mặc định 20 → hết tháng.
export async function getRegistrationWindowConfig(): Promise<RegistrationWindowConfig> {
  const setting = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'schedule_registration_window'`
  );
  return parseRegistrationWindow(setting?.value);
}

/// Giờ nghỉ trưa chung của công ty, admin đặt ở trang Ca làm việc. Chưa đặt
/// hoặc đã tắt thì giờ công không trừ gì.
export async function getLunchBreak(): Promise<LunchBreak | null> {
  const setting = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'lunch_break'`
  );
  return parseLunchBreak(setting?.value);
}

type ScheduledUser = { id: string; employmentType: string };

/// Lịch làm việc thực tế của từng nhân viên trong tháng.
/// full-time: tự sinh cho mọi ngày không phải ngày nghỉ hằng tuần, với ca mặc
/// định; nếu admin đã xếp lịch riêng cho tháng đó thì dùng lịch admin xếp.
/// part-time & intern: đúng những ca đã đăng ký.
export async function resolveMonthSchedules(
  users: ScheduledUser[],
  month: string,
  rules: SessionRule[]
): Promise<Map<string, ScheduleMap>> {
  const result = new Map<string, ScheduleMap>();
  if (users.length === 0) return result;

  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const defaultSessions = pickFullTimeSessions(rules);
  const fullTimeDates = fullTimeWorkingDates(month, await getWeeklyOffDays());
  const userIds = users.map((user) => user.id);

  const [registrations, registeredDays] = await Promise.all([
    query<{ userId: string }>(
      `SELECT "userId" FROM "ScheduleRegistration"
        WHERE "month" = $1 AND "userId" = ANY($2::text[])`,
      [month, userIds]
    ),
    query<{ userId: string; date: string; sessionId: string }>(
      `SELECT r."userId", d."date", d."sessionId"
         FROM "ScheduleDay" d
         JOIN "ScheduleRegistration" r ON r."id" = d."registrationId"
        WHERE r."month" = $1 AND r."userId" = ANY($2::text[])`,
      [month, userIds]
    ),
  ]);

  const registeredIds = new Set(registrations.map((row) => row.userId));
  const daysByUser = new Map<string, typeof registeredDays>();
  for (const row of registeredDays) {
    const list = daysByUser.get(row.userId) ?? [];
    list.push(row);
    daysByUser.set(row.userId, list);
  }

  for (const user of users) {
    const schedule: ScheduleMap = new Map();
    // full-time chỉ dùng lịch đăng ký khi admin đã xếp riêng cho tháng này.
    const useRegistration =
      isSelfScheduled(user.employmentType) || registeredIds.has(user.id);

    if (useRegistration) {
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
