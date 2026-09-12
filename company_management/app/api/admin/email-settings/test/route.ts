import { badRequest, handle, HttpError, requireAdmin } from "@/lib/auth-guard";
import { isValidEmail } from "@/lib/utils";
import { getEmailConfig, isEmailReady, sendMail } from "@/lib/mailer";

/// Gửi một email thử bằng cấu hình đã lưu, để admin kiểm tra SMTP.
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const to = String(body?.to || "").trim().toLowerCase();
    if (!isValidEmail(to)) badRequest("Email nhận không hợp lệ");

    const config = await getEmailConfig();
    if (!isEmailReady(config)) badRequest("Hãy lưu cấu hình SMTP trước khi gửi thử");

    try {
      await sendMail(config, {
        to,
        subject: "Email thử từ hệ thống chấm công",
        text: "Nếu bạn nhận được email này thì cấu hình SMTP đã hoạt động.",
      });
    } catch (error) {
      // Trả nguyên thông báo của SMTP để admin biết sai ở đâu (đăng nhập, cổng, TLS...).
      const detail = error instanceof Error ? error.message : String(error);
      throw new HttpError(502, `Gửi thất bại: ${detail}`);
    }

    return { success: true };
  }, "Email test error");
}
