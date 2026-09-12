import { query, queryOne } from "@/lib/db";
import { formatMonthLabel } from "@/lib/datetime";
import { openRegistrationMonth, registrationWindow } from "@/lib/schedule";
import { getRegistrationWindowConfig } from "@/lib/attendance-service";
import {
  getEmailConfig,
  isEmailReady,
  resolveAppUrl,
  sendMail,
} from "@/lib/mailer";

const SENT_KEY = "schedule_reminder_sent";

export type ReminderResult = {
  sent: number;
  total: number;
  month: string | null;
  /// Lý do không gửi, nếu có.
  skipped?: string;
};

function formatDateVN(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

/// Tháng mục tiêu của lần nhắc gần nhất đã gửi (YYYY-MM), null nếu chưa từng.
export async function getLastReminderMonth(): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = $1`,
    [SENT_KEY]
  );
  return row?.value ?? null;
}

/// Gửi email nhắc đăng ký lịch tháng T+1 cho nhân viên bán thời gian và thực
/// tập. Mỗi tháng chỉ gửi một lần (ghi nhớ trong Settings); `force` dùng cho
/// nút "Gửi nhắc ngay" của admin, bỏ qua cả cờ bật/tắt lẫn kiểm tra đã gửi.
export async function sendScheduleReminder(
  options: { force?: boolean; now?: Date } = {}
): Promise<ReminderResult> {
  const now = options.now ?? new Date();
  const windowConfig = await getRegistrationWindowConfig();
  const month = openRegistrationMonth(windowConfig, now);
  if (!month) {
    return { sent: 0, total: 0, month: null, skipped: "Chưa tới ngày mở đăng ký" };
  }

  const config = await getEmailConfig();
  if (!isEmailReady(config)) {
    return { sent: 0, total: 0, month, skipped: "Chưa cấu hình SMTP" };
  }
  if (!options.force && !config.reminderEnabled) {
    return { sent: 0, total: 0, month, skipped: "Nhắc đăng ký đang tắt" };
  }
  if (!options.force && (await getLastReminderMonth()) === month) {
    return { sent: 0, total: 0, month, skipped: "Tháng này đã gửi rồi" };
  }

  const employees = await query<{ name: string; email: string }>(
    `SELECT "name", "email" FROM "User"
      WHERE "role" = 'employee' AND "isActive" = true
        AND "employmentType" IN ('part_time', 'intern')
      ORDER BY "name" ASC`
  );

  const window = registrationWindow(month, windowConfig);
  const appUrl = resolveAppUrl(config);
  const label = formatMonthLabel(month);
  const deadline = formatDateVN(window.closesOn);

  let sent = 0;
  for (const employee of employees) {
    const lines = [
      `Chào ${employee.name},`,
      "",
      `Cửa sổ đăng ký lịch làm việc ${label} đã mở. Vui lòng đăng ký ca trước hết ngày ${deadline}.`,
      "",
      appUrl ? `Đăng ký tại: ${appUrl}/dashboard/schedule` : "",
      "",
      "Sau hạn trên hệ thống sẽ khoá lịch, muốn thay đổi phải liên hệ quản trị viên.",
    ];
    try {
      await sendMail(config, {
        to: employee.email,
        subject: `Nhắc đăng ký lịch làm việc ${label}`,
        text: lines.filter((line, index) => line !== "" || index > 0).join("\n"),
      });
      sent++;
    } catch (error) {
      console.error(`[reminder] gửi tới ${employee.email} thất bại:`, error);
    }
  }

  // Chỉ ghi nhận "đã gửi" khi thực sự gửi được (hoặc không có ai để gửi),
  // để lần kiểm tra sau còn thử lại nếu SMTP đang lỗi.
  if (sent > 0 || employees.length === 0) {
    await queryOne(
      `INSERT INTO "Settings" ("key", "value") VALUES ($1, $2)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "key"`,
      [SENT_KEY, month]
    );
  }

  return { sent, total: employees.length, month };
}
