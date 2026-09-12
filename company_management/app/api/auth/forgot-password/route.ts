import { randomBytes } from "node:crypto";
import { execute, queryOne } from "@/lib/db";
import { badRequest, handle, HttpError } from "@/lib/auth-guard";
import { isValidEmail } from "@/lib/utils";
import {
  getEmailConfig,
  hashToken,
  isEmailReady,
  resolveAppUrl,
  sendMail,
} from "@/lib/mailer";

const TOKEN_TTL_MINUTES = 60;

/// Nhân viên quên mật khẩu: gửi email chứa link đặt lại, hiệu lực 60 phút.
/// Luôn trả về thành công dù email không có trong hệ thống, để không lộ danh
/// sách tài khoản.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) badRequest("Email không hợp lệ");

    const config = await getEmailConfig();
    if (!isEmailReady(config)) {
      badRequest(
        "Hệ thống chưa cấu hình gửi email. Liên hệ quản trị viên để được đặt lại mật khẩu."
      );
    }

    const user = await queryOne<{ id: string; name: string; email: string }>(
      `SELECT "id", "name", "email" FROM "User"
        WHERE "email" = $1 AND "role" = 'employee' AND "isActive" = true`,
      [email]
    );

    if (user) {
      const token = randomBytes(32).toString("hex");
      // Mỗi tài khoản chỉ giữ một link còn hiệu lực.
      await execute(`DELETE FROM "PasswordReset" WHERE "userId" = $1`, [user.id]);
      await execute(
        `INSERT INTO "PasswordReset" ("userId", "tokenHash", "expiresAt")
         VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
        [user.id, hashToken(token), String(TOKEN_TTL_MINUTES)]
      );

      const link = `${resolveAppUrl(config, req.url)}/reset-password?token=${token}`;
      try {
        await sendMail(config, {
          to: user.email,
          subject: "Đặt lại mật khẩu chấm công",
          text: [
            `Chào ${user.name},`,
            "",
            "Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu. Mở đường link sau để đặt mật khẩu mới:",
            link,
            "",
            `Link có hiệu lực ${TOKEN_TTL_MINUTES} phút. Nếu không phải bạn yêu cầu thì bỏ qua email này.`,
          ].join("\n"),
        });
      } catch (error) {
        console.error("Forgot password mail error:", error);
        throw new HttpError(502, "Không gửi được email. Liên hệ quản trị viên.");
      }
    }

    return { success: true };
  }, "Forgot password error");
}
