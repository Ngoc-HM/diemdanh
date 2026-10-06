import { query, queryOne } from "@/lib/db";
import { PunchInput } from "@/lib/attendance-rules";
import {
  applyDayMark,
  getActiveSessionRules,
  getDayMarks,
  getHolidayMap,
  getLunchBreak,
  getWeeklyOffDays,
  resolveMonthSchedules,
} from "@/lib/attendance-service";
import { getMonthRange, weekdayOfDateKey } from "@/lib/datetime";
import { EMPLOYMENT_TYPE_LABELS, EmploymentType } from "@/lib/schedule";
import {
  computeOvertimeMinutes,
  OVERTIME_CODES,
  OvertimeConfig,
  OvertimeDayType,
  overtimeDayType,
  overtimeRate,
  parseOvertimeConfig,
} from "@/lib/overtime";

export type OvertimeStatus = "pending" | "approved" | "rejected";

export type OvertimeRow = {
  id: string;
  userId: string;
  date: string;
  plannedStart: string;
  plannedEnd: string;
  place: string | null;
  content: string;
  status: OvertimeStatus;
  approvedMinutes: number | null;
  adminNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  userName: string;
  userEmail: string;
  userEmployeeCode: string | null;
  userEmploymentType: string;
};

export const OVERTIME_SELECT = `
  SELECT o."id", o."userId", o."date", o."plannedStart", o."plannedEnd",
         o."place", o."content", o."status", o."approvedMinutes", o."adminNote",
         o."reviewedAt", o."createdAt",
         u."name" AS "userName", u."email" AS "userEmail",
         u."employeeCode" AS "userEmployeeCode",
         u."employmentType" AS "userEmploymentType"
    FROM "OvertimeRequest" o
    JOIN "User" u ON u."id" = o."userId"
`;

/// Một phiếu OT kèm số giờ và hệ số đã tính.
export type OvertimeView = {
  id: string;
  date: string;
  plannedStart: string;
  plannedEnd: string;
  place: string | null;
  content: string;
  status: OvertimeStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  dayType: OvertimeDayType;
  /// T / T1 / T2
  code: string;
  /// Hệ số %, vd 150.
  rate: number;
  /// Số phút tính từ chấm công (hoặc giờ dự kiến nếu thiếu giờ vào/ra).
  computedMinutes: number;
  computedSource: "punches" | "planned";
  /// Số phút admin chốt tay, null = theo computedMinutes.
  approvedMinutes: number | null;
  /// Số phút dùng để trả lương.
  minutes: number;
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    employmentLabel: string;
  };
};

export async function getOvertimeConfig(): Promise<OvertimeConfig> {
  const setting = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'overtime_config'`
  );
  return parseOvertimeConfig(setting?.value);
}

/// Tính giờ và hệ số cho danh sách phiếu. Gom theo tháng để mỗi tháng chỉ tra
/// lịch, chấm công và ngày lễ một lần.
export async function buildOvertimeViews(rows: OvertimeRow[]): Promise<OvertimeView[]> {
  if (rows.length === 0) return [];

  const [config, rules, weeklyOffDays, lunchBreak] = await Promise.all([
    getOvertimeConfig(),
    getActiveSessionRules(),
    getWeeklyOffDays(),
    getLunchBreak(),
  ]);
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

  const byMonth = new Map<string, OvertimeRow[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), row]);
  }

  const views = new Map<string, OvertimeView>();
  for (const [month, monthRows] of byMonth) {
    const users = [
      ...new Map(
        monthRows.map((row) => [
          row.userId,
          { id: row.userId, employmentType: row.userEmploymentType },
        ])
      ).values(),
    ];
    const userIds = users.map((user) => user.id);
    const { startDate, endDate } = getMonthRange(month);
    const [schedules, marks, holidays, punchRows] = await Promise.all([
      resolveMonthSchedules(users, month, rules),
      getDayMarks(userIds, startDate, endDate),
      getHolidayMap(startDate, endDate),
      query<{ userId: string; date: string; type: string; at: Date; withinRadius: boolean }>(
        `SELECT a."userId", a."date", p."type", p."at", p."withinRadius"
           FROM "Attendance" a
           JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
          WHERE a."userId" = ANY($1::text[]) AND a."date" BETWEEN $2 AND $3
          ORDER BY p."at" ASC`,
        [userIds, startDate, endDate]
      ),
    ]);

    const punches = new Map<string, PunchInput[]>();
    for (const punch of punchRows) {
      const key = `${punch.userId}|${punch.date}`;
      punches.set(key, [
        ...(punches.get(key) ?? []),
        { type: punch.type, at: punch.at, withinRadius: punch.withinRadius },
      ]);
    }

    for (const row of monthRows) {
      const key = `${row.userId}|${row.date}`;
      const dayType = overtimeDayType(
        weekdayOfDateKey(row.date),
        weeklyOffDays,
        holidays.has(row.date)
      );
      const scheduled = applyDayMark(
        schedules.get(row.userId)?.get(row.date) ?? [],
        marks.get(key),
        ruleById
      );
      const computed = computeOvertimeMinutes({
        dayType,
        scheduled,
        punches: punches.get(key) ?? [],
        lunchBreak,
        plannedStart: row.plannedStart,
        plannedEnd: row.plannedEnd,
      });
      views.set(row.id, {
        id: row.id,
        date: row.date,
        plannedStart: row.plannedStart,
        plannedEnd: row.plannedEnd,
        place: row.place,
        content: row.content,
        status: row.status,
        adminNote: row.adminNote,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
        dayType,
        code: OVERTIME_CODES[dayType],
        rate: overtimeRate(config, dayType),
        computedMinutes: computed.minutes,
        computedSource: computed.source,
        approvedMinutes: row.approvedMinutes,
        minutes: row.approvedMinutes ?? computed.minutes,
        user: {
          id: row.userId,
          name: row.userName,
          email: row.userEmail,
          employeeCode: row.userEmployeeCode,
          employmentLabel:
            EMPLOYMENT_TYPE_LABELS[row.userEmploymentType as EmploymentType] ??
            row.userEmploymentType,
        },
      });
    }
  }

  // Giữ nguyên thứ tự của danh sách đầu vào.
  return rows.map((row) => views.get(row.id)!);
}

/// Phiếu OT đã duyệt của một nhóm nhân viên trong tháng, khoá `userId|date`.
/// Bảng công dùng để cộng giờ OT và biết ngày nào là ngày OT.
export async function getApprovedOvertime(
  userIds: string[],
  month: string
): Promise<Map<string, OvertimeView>> {
  if (userIds.length === 0) return new Map();
  const { startDate, endDate } = getMonthRange(month);
  const rows = await query<OvertimeRow>(
    `${OVERTIME_SELECT}
      WHERE o."status" = 'approved' AND o."userId" = ANY($1::text[])
        AND o."date" BETWEEN $2 AND $3`,
    [userIds, startDate, endDate]
  );
  const views = await buildOvertimeViews(rows);
  return new Map(
    views.map((view) => [`${view.user.id}|${view.date}`, view])
  );
}
