import { sendScheduleReminder } from "@/lib/reminder";

/// Mỗi giờ kiểm tra một lần: tới ngày mở đăng ký mà tháng này chưa gửi thì
/// gửi. Hàm gửi tự chống gửi trùng nên tần suất kiểm tra không quan trọng.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 30 * 1000;

const globalForScheduler = globalThis as unknown as {
  reminderTimer?: ReturnType<typeof setInterval>;
};

/// Chạy trong tiến trình server (gọi từ instrumentation.ts). Gắn vào
/// globalThis để hot-reload ở dev không tạo thêm bộ đếm thứ hai.
export function startReminderScheduler() {
  if (globalForScheduler.reminderTimer) return;

  const tick = async () => {
    try {
      const result = await sendScheduleReminder();
      if (result.sent > 0) {
        console.log(
          `[reminder] đã gửi ${result.sent}/${result.total} email nhắc đăng ký lịch ${result.month}`
        );
      }
    } catch (error) {
      console.error("[reminder] lỗi khi kiểm tra nhắc đăng ký:", error);
    }
  };

  console.log("[reminder] bộ nhắc đăng ký lịch đã khởi động, kiểm tra mỗi giờ");
  setTimeout(tick, FIRST_RUN_DELAY_MS).unref?.();
  globalForScheduler.reminderTimer = setInterval(tick, CHECK_INTERVAL_MS);
  globalForScheduler.reminderTimer.unref?.();
}
