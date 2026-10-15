import { query, transaction } from "@/lib/db";
import {
  badRequest,
  conflict,
  handle,
  notFound,
  requireAdmin,
} from "@/lib/auth-guard";
import {
  dateKeyVN,
  formatTimeVN,
  getMonthRange,
  isValidDateKey,
  isValidMonth,
  minutesOfDayVN,
  monthKeyVN,
  parseTimeToMinutes,
  vnDateTimeToUtc,
  weekdayLabel,
} from "@/lib/datetime";
import { pairPunches, type PunchInput } from "@/lib/attendance-rules";
import { attendanceEditNotice } from "@/lib/employee-notice";
import { notifyEmployee } from "@/lib/notify";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const NOTE_MAX = 300;

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
      [startDate, endDate, today],
    );

    // Gom theo nhân viên + ngày rồi soi ngày nào còn ca mở.
    const byKey = new Map<string, { row: PunchRow; punches: PunchInput[] }>();
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
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName),
      );

    return { month, today, count: items.length, items };
  }, "Missed checkout error");
}

/// Bổ sung giờ ra cho một ngày quên checkout, ngay tại nơi admin đang xem
/// (trang Quên checkout, ô "?" của bảng chấm công). Chỉ thêm đúng một lần ra,
/// không đụng các lần bấm khác; ngày phải đang thiếu giờ ra.
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId ?? "");
    const date = String(body?.date ?? "");
    const time = String(body?.time ?? "").trim();
    const note =
      String(body?.note ?? "")
        .trim()
        .slice(0, NOTE_MAX) || null;

    if (!userId) badRequest("Thiếu nhân viên");
    if (!isValidDateKey(date)) badRequest("Ngày không hợp lệ");
    if (!TIME_PATTERN.test(time)) badRequest("Giờ ra phải có dạng HH:MM");

    const rows = await query<{ attendanceId: string; type: string; at: Date }>(
      `SELECT a."id" AS "attendanceId", p."type", p."at"
         FROM "Attendance" a
         JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
        WHERE a."userId" = $1 AND a."date" = $2
        ORDER BY p."at" ASC`,
      [userId, date],
    );
    if (rows.length === 0) notFound("Ngày này chưa có giờ vào");

    const paired = pairPunches(
      rows.map((row) => ({ type: row.type, at: row.at, withinRadius: true })),
    );
    if (!paired.openSince) conflict("Ngày này đã có giờ ra rồi");
    if (parseTimeToMinutes(time) <= minutesOfDayVN(paired.openSince!)) {
      badRequest(`Giờ ra phải sau giờ vào ${formatTimeVN(paired.openSince!)}`);
    }

    const attendanceId = rows[0].attendanceId;
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO "AttendancePunch"
           ("attendanceId", "type", "at", "isManual", "withinRadius")
         VALUES ($1, 'out', $2, true, true)`,
        [attendanceId, vnDateTimeToUtc(date, time)],
      );
      await client.query(
        `UPDATE "Attendance"
            SET "note" = COALESCE($2, "note"), "editedBy" = $3, "editedAt" = now(),
                "updatedAt" = now()
          WHERE "id" = $1`,
        [attendanceId, note, admin.userId],
      );
    });

    const before = rows.map((row) => ({
      type: row.type,
      time: formatTimeVN(row.at),
    }));
    notifyEmployee(
      userId,
      attendanceEditNotice({
        date,
        before,
        after: [...before, { type: "out", time }],
        note: note ?? "Bổ sung giờ ra (quên checkout)",
      }),
    );
    return { success: true, date, time };
  }, "Missed checkout fix error");
}
