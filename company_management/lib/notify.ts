/// Gửi email báo cho nhân viên khi admin sửa công / xử lý yêu cầu của họ.
/// Gửi nền: không bắt admin chờ SMTP, và lỗi gửi (chưa cấu hình, máy chủ mail
/// trục trặc) chỉ ghi log — thao tác của admin không bao giờ hỏng vì email.
import { queryOne } from "@/lib/db";
import { getEmailConfig, isEmailReady, sendMail } from "@/lib/mailer";
import { composeNoticeEmail, Notice } from "@/lib/employee-notice";

async function deliver(userId: string, notice: Notice) {
  const config = await getEmailConfig();
  if (!isEmailReady(config) || !config.notifyEnabled) return;

  const user = await queryOne<{ name: string; email: string; isActive: boolean }>(
    `SELECT "name", "email", "isActive" FROM "User" WHERE "id" = $1`,
    [userId]
  );
  if (!user || !user.isActive) return;

  const company = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
  );
  const email = composeNoticeEmail(notice, {
    name: user.name,
    companyName: company?.value ?? "",
  });
  await sendMail(config, { to: user.email, ...email });
}

export function notifyEmployee(userId: string, notice: Notice): void {
  deliver(userId, notice).catch((error) => {
    console.error(`[notify] không gửi được email "${notice.subject}" cho ${userId}:`, error);
  });
}
