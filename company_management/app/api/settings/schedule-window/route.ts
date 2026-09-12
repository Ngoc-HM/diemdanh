import { queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { getRegistrationWindowConfig } from "@/lib/attendance-service";
import {
  formatRegistrationWindow,
  RegistrationWindowConfig,
  validateRegistrationWindow,
} from "@/lib/schedule";

/// Cửa sổ đăng ký lịch tháng T+1, tính theo ngày trong tháng T: mở từ ngày
/// `openDay`, đóng sau hết ngày `closeDay`. Chỉ áp cho nhân viên bán thời gian
/// và thực tập — full-time dùng lịch cố định do hệ thống sinh, không đăng ký.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return await getRegistrationWindowConfig();
  }, "Registration window read error");
}

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const config: RegistrationWindowConfig = {
      openDay: Number(body?.openDay),
      closeDay: Number(body?.closeDay),
    };

    const error = validateRegistrationWindow(config);
    if (error) badRequest(error);

    await queryOne(
      `INSERT INTO "Settings" ("id", "key", "value")
       VALUES ('cfg_schedule_registration_window', 'schedule_registration_window', $1)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "value"`,
      [formatRegistrationWindow(config)]
    );

    return config;
  }, "Registration window write error");
}
