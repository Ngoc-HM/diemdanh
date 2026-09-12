import { query } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import {
  dateKeyVN,
  formatTimeVN,
  getMonthRange,
  isValidMonth,
  monthKeyVN,
  weekdayLabel,
} from "@/lib/datetime";
import { pairPunches, type PunchInput } from "@/lib/attendance-rules";

type PunchRow = {
  userId: string;
  userName: string;
  employeeCode: string | null;
  department: string | null;
  date: string;
  type: string;
  at: Date;
};

/// Các ngày nhân viên đã check-in nhưng hết ngày vẫn không có lần check-out
/// nào. Ngày hôm nay không tính vì ca vẫn đang mở hợp lệ.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? monthKeyVN();
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const today = dateKeyVN();
    const { startDate, endDate } = getMonthRange(month);

    const rows = await query<PunchRow>(
      `SELECT a."userId", u."name" AS "userName", u."employeeCode",
              u."department", a."date", p."type", p."at"
         FROM "Attendance" a
         JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
         JOIN "User" u ON u."id" = a."userId"
        WHERE a."date" BETWEEN $1 AND $2 AND a."date" < $3
        ORDER BY a."date" DESC, u."name" ASC, p."at" ASC`,
      [startDate, endDate, today]
    );

    // Gom theo nhân viên + ngày rồi soi ngày nào còn ca mở.
    const byKey = new Map<
      string,
      { row: PunchRow; punches: PunchInput[] }
    >();
    for (const row of rows) {
      const key = `${row.userId}|${row.date}`;
      const entry = byKey.get(key) ?? { row, punches: [] };
      entry.punches.push({ type: row.type, at: row.at, withinRadius: true });
      byKey.set(key, entry);
    }

    const items = [...byKey.values()]
      .map(({ row, punches }) => ({ row, paired: pairPunches(punches) }))
      .filter(({ paired }) => paired.openSince !== null)
      .map(({ row, paired }) => ({
        userId: row.userId,
        userName: row.userName,
        employeeCode: row.employeeCode,
        department: row.department,
        date: row.date,
        weekday: weekdayLabel(row.date),
        checkInAt: formatTimeVN(paired.openSince!),
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName));

    return { month, today, count: items.length, items };
  }, "Missed checkout error");
}
