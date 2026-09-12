import { queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { DEFAULT_WEEKLY_OFF_DAYS } from "@/lib/schedule";

/// Ngày nghỉ cố định hằng tuần: mảng số 0 (Chủ nhật) ... 6 (Thứ 7).
/// Nhân viên full-time chỉ bị gán lịch vào ngày không thuộc danh sách này.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const setting = await queryOne<{ value: string }>(
      `SELECT "value" FROM "Settings" WHERE "key" = 'weekly_off_days'`
    );
    const days = setting
      ? setting.value
          .split(",")
          .map((part) => Number(part.trim()))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [...DEFAULT_WEEKLY_OFF_DAYS];
    return { days: [...new Set(days)] };
  }, "Weekly off days read error");
}

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const raw = body?.days;

    if (!Array.isArray(raw)) badRequest("Danh sách ngày nghỉ không hợp lệ");
    const days = [...new Set(raw.map(Number))];
    if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      badRequest("Ngày nghỉ phải trong khoảng 0 (CN) tới 6 (T7)");
    }
    if (days.length === 7) badRequest("Không thể nghỉ cả 7 ngày trong tuần");

    const value = [...days].sort((a, b) => a - b).join(",");
    await queryOne(
      `INSERT INTO "Settings" ("id", "key", "value")
       VALUES ('cfg_weekly_off_days', 'weekly_off_days', $1)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "value"`,
      [value]
    );

    return { days };
  }, "Weekly off days write error");
}
