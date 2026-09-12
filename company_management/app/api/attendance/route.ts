import { query, queryOne } from "@/lib/db";
import { badRequest, handle, requireEmployee } from "@/lib/auth-guard";
import {
  dateKeyVN,
  getMonthRange,
  isValidMonth,
  listMonthDates,
  monthKeyVN,
} from "@/lib/datetime";
import { evaluateDay, minutesToHours } from "@/lib/attendance-rules";
import {
  applyDayMark,
  getActiveSessionRules,
  getDayMarks,
  getHolidayMap,
  getLunchBreak,
  getPendingShiftRequestDates,
  resolveUserMonthSchedule,
} from "@/lib/attendance-service";
import { AttendancePunchRow } from "@/lib/types";

type AttendanceWithPunch = {
  attendanceId: string;
  date: string;
  note: string | null;
} & Partial<AttendancePunchRow>;

/// Bảng công của chính nhân viên đang đăng nhập.
/// Không có `month` thì trả về tháng hiện tại; luôn kèm ngày hôm nay để trang
/// điểm danh biết đang ở trạng thái nào.
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const { searchParams } = new URL(req.url);
    const requestedMonth = searchParams.get("month");

    if (requestedMonth && !isValidMonth(requestedMonth)) {
      badRequest("Tháng không hợp lệ");
    }

    const today = dateKeyVN();
    const month = requestedMonth ?? monthKeyVN();
    const { startDate, endDate } = getMonthRange(month);

    const user = await queryOne<{
      id: string;
      name: string;
      employmentType: string;
    }>(`SELECT "id", "name", "employmentType" FROM "User" WHERE "id" = $1`, [
      session.userId,
    ]);
    if (!user) badRequest("Không tìm thấy tài khoản");

    const [rows, rules, holidays, lunchBreak, pending] = await Promise.all([
      query<AttendanceWithPunch>(
        `SELECT a."id" AS "attendanceId", a."date", a."note",
                p."id", p."type", p."at", p."distance", p."isManual"
           FROM "Attendance" a
           LEFT JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
          WHERE a."userId" = $1 AND a."date" BETWEEN $2 AND $3
          ORDER BY a."date" ASC, p."at" ASC`,
        [user!.id, startDate, endDate]
      ),
      getActiveSessionRules(),
      getHolidayMap(startDate, endDate),
      getLunchBreak(),
      getPendingShiftRequestDates([user!.id], startDate, endDate),
    ]);

    const schedule = await resolveUserMonthSchedule(user!, month, rules);
    const marks = await getDayMarks([user!.id], startDate, endDate);
    const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

    // Gộp kết quả JOIN thành từng ngày kèm danh sách punch.
    const byDate = new Map<
      string,
      { note: string | null; punches: AttendancePunchRow[] }
    >();
    for (const row of rows) {
      const entry = byDate.get(row.date) ?? { note: row.note, punches: [] };
      if (row.id && row.type && row.at) {
        entry.punches.push({
          id: row.id,
          type: row.type,
          at: row.at,
          distance: row.distance ?? null,
          isManual: row.isManual ?? false,
        } as AttendancePunchRow);
      }
      byDate.set(row.date, entry);
    }

    const days = listMonthDates(month).map((date) => {
      const entry = byDate.get(date);
      const mark = marks.get(`${user!.id}|${date}`);
      const evaluation = evaluateDay({
        scheduled: applyDayMark(schedule.get(date) ?? [], mark, ruleById),
        punches: (entry?.punches ?? []).map((punch) => ({
          type: punch.type,
          at: punch.at,
          withinRadius: true,
        })),
        isHoliday: holidays.has(date),
        isPast: date < today,
        leaveCode: mark?.leaveCode ?? null,
        lunchBreak,
      });

      return {
        date,
        holidayName: holidays.get(date) ?? null,
        adminEdited: mark?.isAdminEdit ?? false,
        // Đang có yêu cầu đổi ca chờ duyệt: bảng tô vàng để nhân viên biết
        // ngày đó còn treo.
        pendingRequest: pending.has(`${user!.id}|${date}`),
        note: entry?.note ?? null,
        status: evaluation.status,
        countsAsWorkDay: evaluation.countsAsWorkDay,
        codes: evaluation.codes,
        workedHours: minutesToHours(evaluation.workedMinutes),
        requiredHours: minutesToHours(evaluation.requiredMinutes),
        lateMinutes: evaluation.lateMinutes,
        earlyLeaveMinutes: evaluation.earlyLeaveMinutes,
        punches: (entry?.punches ?? []).map((punch) => ({
          id: punch.id,
          type: punch.type,
          at: punch.at.toISOString(),
          distance: punch.distance,
          isManual: punch.isManual,
        })),
      };
    });

    const todayEntry = days.find((day) => day.date === today) ?? null;
    // Mỗi ngày chỉ check-in một lần; check-out bấm được nhiều lần nên lấy
    // lần muộn nhất sau giờ vào.
    const todayPunches = todayEntry?.punches ?? [];
    const checkInAt = todayPunches.find((punch) => punch.type === "in")?.at ?? null;
    const lastOutAt = checkInAt
      ? (todayPunches
          .filter((punch) => punch.type === "out" && punch.at > checkInAt)
          .at(-1)?.at ?? null)
      : null;

    return {
      user: { name: user!.name, employmentType: user!.employmentType },
      month,
      today,
      todayEntry,
      checkInAt,
      lastOutAt,
      days,
      summary: {
        passedDays: days.filter((day) => day.countsAsWorkDay).length,
        workedHours:
          Math.round(days.reduce((sum, day) => sum + day.workedHours, 0) * 10) / 10,
        absentDays: days.filter((day) => day.status === "absent").length,
        lateDays: days.filter((day) => day.status === "late").length,
      },
    };
  }, "Attendance list error");
}
