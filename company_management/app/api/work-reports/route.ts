import { isUniqueViolation, query, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, requireEmployee } from "@/lib/auth-guard";
import {
  dateKeyVN,
  formatMinutes,
  getMonthRange,
  isValidMonth,
  minutesOfDayVN,
  monthKeyVN,
  vnDateTimeToUtc,
} from "@/lib/datetime";
import {
  MAX_ENTRIES_PER_DAY,
  parseEntryTime,
  toEntryView,
  validateBoundary,
  validateContent,
  WORK_REPORT_COLUMNS,
} from "@/lib/work-reports";
import { WorkReportEntryRow } from "@/lib/types";

/// Nội dung công việc của chính nhân viên đang đăng nhập.
/// Nhân viên chỉ khai được cho ngày hôm nay; tháng cũ chỉ để xem lại.
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const { searchParams } = new URL(req.url);
    const requestedMonth = searchParams.get("month");
    if (requestedMonth && !isValidMonth(requestedMonth)) {
      badRequest("Tháng không hợp lệ");
    }

    const month = requestedMonth ?? monthKeyVN();
    const today = dateKeyVN();
    const { startDate, endDate } = getMonthRange(month);

    const [rows, punches] = await Promise.all([
      query<WorkReportEntryRow>(
        `SELECT ${WORK_REPORT_COLUMNS} FROM "WorkReportEntry"
          WHERE "userId" = $1 AND "date" BETWEEN $2 AND $3
          ORDER BY "date" ASC, "startAt" ASC`,
        [session.userId, startDate, endDate]
      ),
      // Giờ vào / ra của hôm nay: dùng để điền sẵn giờ bắt đầu của khoảng đầu
      // tiên và để nhân viên đối chiếu "đã khai" với "có mặt".
      query<{ type: string; at: Date }>(
        `SELECT p."type", p."at"
           FROM "Attendance" a
           JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
          WHERE a."userId" = $1 AND a."date" = $2
          ORDER BY p."at" ASC`,
        [session.userId, today]
      ),
    ]);

    const days = new Map<string, WorkReportEntryRow[]>();
    for (const row of rows) {
      const list = days.get(row.date) ?? [];
      list.push(row);
      days.set(row.date, list);
    }

    const checkIn = punches.find((punch) => punch.type === "in")?.at ?? null;
    const lastOut = checkIn
      ? (punches
          .filter(
            (punch) =>
              punch.type === "out" && punch.at.getTime() > checkIn.getTime()
          )
          .at(-1)?.at ?? null)
      : null;

    return {
      month,
      today,
      checkInAt: checkIn ? checkIn.toISOString() : null,
      lastOutAt: lastOut ? lastOut.toISOString() : null,
      // Khoảng thời gian có mặt (vào → ra muộn nhất), không trừ nghỉ trưa —
      // đây là mốc để so với tổng thời gian đã khai, không phải giờ công.
      presentMinutes:
        checkIn && lastOut
          ? Math.round((lastOut.getTime() - checkIn.getTime()) / 60_000)
          : null,
      days: [...days.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, entries]) => ({
          date,
          totalMinutes: entries.reduce(
            (sum, row) =>
              sum +
              Math.round((row.endAt.getTime() - row.startAt.getTime()) / 60_000),
            0
          ),
          entries: entries.map(toEntryView),
        })),
    };
  }, "Work report list error");
}

/// Thêm một khoảng cho ngày hôm nay. Giờ bắt đầu không do client quyết định:
/// đã có khoảng trước thì nối đúng vào giờ kết thúc của nó; chỉ khoảng đầu
/// tiên trong ngày mới nhận `startTime` từ nhân viên.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const body = await req.json().catch(() => ({}));
    const today = dateKeyVN();

    const requestedDate = body?.date ? String(body.date) : today;
    if (requestedDate !== today) {
      badRequest("Chỉ khai được nội dung công việc của ngày hôm nay");
    }

    const content = String(body?.content ?? "").trim();
    const contentError = validateContent(content);
    if (contentError) badRequest(contentError);

    const entries = await query<WorkReportEntryRow>(
      `SELECT ${WORK_REPORT_COLUMNS} FROM "WorkReportEntry"
        WHERE "userId" = $1 AND "date" = $2 ORDER BY "startAt" ASC`,
      [session.userId, today]
    );
    if (entries.length >= MAX_ENTRIES_PER_DAY) {
      badRequest(`Mỗi ngày tối đa ${MAX_ENTRIES_PER_DAY} khoảng công việc`);
    }

    const last = entries.at(-1);
    const startMinutes = last
      ? minutesOfDayVN(last.endAt)
      : parseEntryTime(body?.startTime);
    if (startMinutes === null) {
      badRequest("Giờ bắt đầu không hợp lệ, cần dạng HH:MM");
    }

    const endMinutes = parseEntryTime(body?.endTime);
    if (endMinutes === null) {
      badRequest("Giờ kết thúc không hợp lệ, cần dạng HH:MM");
    }

    const error = validateBoundary({
      startMinutes: startMinutes!,
      endMinutes: endMinutes!,
      nextEndMinutes: null,
      nowMinutes: minutesOfDayVN(new Date()),
    });
    if (error) badRequest(error);

    try {
      await queryOne(
        `INSERT INTO "WorkReportEntry" ("userId", "date", "startAt", "endAt", "content")
         VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
        [
          session.userId,
          today,
          vnDateTimeToUtc(today, formatMinutes(startMinutes!)),
          vnDateTimeToUtc(today, formatMinutes(endMinutes!)),
          content,
        ]
      );
    } catch (error) {
      // Bấm lưu hai lần (hoặc mở hai tab) thì cả hai cùng nối vào một mốc giờ
      // và đụng khoá duy nhất. Báo lại cho người dùng thay vì trả lỗi 500.
      if (isUniqueViolation(error)) {
        conflict("Khoảng này vừa được lưu rồi, tải lại trang để xem danh sách mới");
      }
      throw error;
    }

    return { date: today, entries: await listToday(session.userId, today) };
  }, "Work report create error");
}

/// Danh sách khoảng của một ngày, dạng đã sẵn sàng cho giao diện.
async function listToday(userId: string, date: string) {
  const rows = await query<WorkReportEntryRow>(
    `SELECT ${WORK_REPORT_COLUMNS} FROM "WorkReportEntry"
      WHERE "userId" = $1 AND "date" = $2 ORDER BY "startAt" ASC`,
    [userId, date]
  );
  return rows.map(toEntryView);
}
