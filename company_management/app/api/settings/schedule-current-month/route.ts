import { queryOne } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/auth-guard";
import { getCurrentMonthRegistrationOpen } from "@/lib/attendance-service";

/// Công tắc admin: cho nhân viên bán thời gian / thực tập tự đăng ký lịch tháng
/// hiện tại (chỉ từ hôm nay trở đi). Lưu ở Settings schedule_current_month_open.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return { enabled: await getCurrentMonthRegistrationOpen() };
  }, "Current month registration read error");
}

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const enabled = body?.enabled === true;
    await queryOne(
      `INSERT INTO "Settings" ("id", "key", "value")
       VALUES ('cfg_schedule_current_month_open', 'schedule_current_month_open', $1)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "value"`,
      [enabled ? "true" : "false"],
    );
    return { enabled };
  }, "Current month registration write error");
}
