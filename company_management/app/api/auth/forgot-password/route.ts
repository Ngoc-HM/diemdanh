import { randomInt } from "node:crypto";
import { execute, queryOne } from "@/lib/db";
import { badRequest, handle, HttpError } from "@/lib/auth-guard";
import { isValidEmail } from "@/lib/utils";
import {
  getEmailConfig,
  hashToken,
  isEmailReady,
  RESET_CODE_LENGTH,
  RESET_CODE_TTL_MINUTES,
  sendMail,
} from "@/lib/mailer";

/// Bấm gửi lại liên tục thì trong khoảng này vẫn dùng mã cũ, không gửi thêm
/// thư — vừa đỡ spam hộp thư vừa đỡ bị lợi dụng để dội mail người khác.
const RESEND_COOLDOWN_SECONDS = 60;

/// Nhân viên quên mật khẩu: gửi mã 8 số qua email, nhập ở bước sau để đặt lại.
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
      const recent = await queryOne<{ id: string }>(
        `SELECT "id" FROM "PasswordReset"
          WHERE "userId" = $1 AND "usedAt" IS NULL AND "expiresAt" > now()
            AND "createdAt" > now() - ($2 || ' seconds')::interval`,
        [user.id, String(RESEND_COOLDOWN_SECONDS)]
      );
      // Vừa gửi xong thì thôi, mã cũ vẫn còn hiệu lực.
      if (recent) return { success: true };

      const code = String(randomInt(0, 10 ** RESET_CODE_LENGTH)).padStart(
        RESET_CODE_LENGTH,
        "0"
      );

      // Mỗi tài khoản chỉ giữ một mã còn hiệu lực.
      await execute(`DELETE FROM "PasswordReset" WHERE "userId" = $1`, [user.id]);
      await execute(
        `INSERT INTO "PasswordReset" ("userId", "tokenHash", "expiresAt")
         VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
        [user.id, hashToken(code), String(RESET_CODE_TTL_MINUTES)]
      );

      try {
        await sendMail(config!, {
          to: user.email,
          subject: `Mã đặt lại mật khẩu: ${code}`,
          text: [
            `Chào ${user.name},`,
            "",
            "Mã đặt lại mật khẩu của bạn là:",
            code,
            "",
            `Mã có hiệu lực ${RESET_CODE_TTL_MINUTES} phút. Nếu không phải bạn yêu cầu thì bỏ qua email này.`,
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
