import { queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import {
  formatLunchBreak,
  LunchBreak,
  parseLunchBreak,
} from "@/lib/attendance-rules";
import { formatMinutes } from "@/lib/datetime";
import { TIME_PATTERN } from "@/lib/validation";

/// Giờ nghỉ trưa chung của công ty, admin đặt ở trang Ca làm việc. Phần giờ
/// công rơi vào khoảng này bị trừ trước khi so với số giờ tối thiểu của ca.
/// `start`/`end` = null nghĩa là không trừ gì.
function view(lunch: LunchBreak | null) {
  return lunch
    ? { start: formatMinutes(lunch.start), end: formatMinutes(lunch.end) }
    : { start: null, end: null };
}

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const setting = await queryOne<{ value: string }>(
      `SELECT "value" FROM "Settings" WHERE "key" = 'lunch_break'`
    );
    return view(parseLunchBreak(setting?.value));
  }, "Lunch break read error");
}

/// Gửi `start` và `end` rỗng để tắt trừ giờ nghỉ trưa.
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const start = String(body?.start ?? "").trim();
    const end = String(body?.end ?? "").trim();

    let lunch: LunchBreak | null = null;
    if (start || end) {
      if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
        badRequest("Giờ nghỉ trưa phải theo dạng HH:MM");
      }
      lunch = parseLunchBreak(`${start}-${end}`);
      if (!lunch) badRequest("Giờ kết thúc nghỉ trưa phải sau giờ bắt đầu");
    }

    await queryOne(
      `INSERT INTO "Settings" ("id", "key", "value")
       VALUES ('cfg_lunch_break', 'lunch_break', $1)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "value"`,
      [formatLunchBreak(lunch)]
    );

    return view(lunch);
  }, "Lunch break write error");
}
