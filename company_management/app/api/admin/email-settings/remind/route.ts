import { handle, requireAdmin } from "@/lib/auth-guard";
import { sendScheduleReminder } from "@/lib/reminder";

/// Admin bấm gửi nhắc đăng ký lịch ngay, không đợi bộ đếm tự động.
export async function POST() {
  return handle(async () => {
    await requireAdmin();
    return await sendScheduleReminder({ force: true });
  }, "Email reminder error");
}
