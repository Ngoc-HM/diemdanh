/// Next.js gọi register() một lần khi server khởi động. Chỉ chạy ở runtime
/// Node (không phải edge của middleware) vì bộ nhắc cần pg và nodemailer.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderScheduler } = await import("@/lib/reminder-scheduler");
    startReminderScheduler();
  }
}
