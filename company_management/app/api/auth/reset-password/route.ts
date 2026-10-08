import { execute, queryOne, transaction } from "@/lib/db";
import { badRequest, handle } from "@/lib/auth-guard";
import { hashPassword, isValidEmail } from "@/lib/utils";
import {
  hashToken,
  RESET_CODE_LENGTH,
  RESET_CODE_MAX_ATTEMPTS,
} from "@/lib/mailer";
import { clearLoginFailures, employeeKey } from "@/lib/login-throttle";
import { logLoginEvent } from "@/lib/security-log";

/// Đặt mật khẩu mới bằng mã 8 số trong email. Mã dùng một lần.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const code = String(body?.code || "").trim();
    const password = String(body?.password || "");

    if (!isValidEmail(email)) badRequest("Email không hợp lệ");
    if (!new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`).test(code)) {
      badRequest(`Mã phải gồm ${RESET_CODE_LENGTH} chữ số`);
    }
    if (password.length < 6) badRequest("Mật khẩu phải có ít nhất 6 ký tự");

    const reset = await queryOne<{
      id: string;
      userId: string;
      tokenHash: string;
    }>(
      `SELECT r."id", r."userId", r."tokenHash"
         FROM "PasswordReset" r
         JOIN "User" u ON u."id" = r."userId"
        WHERE u."email" = $1 AND u."isActive" = true
          AND r."usedAt" IS NULL AND r."expiresAt" > now()
        ORDER BY r."createdAt" DESC LIMIT 1`,
      [email]
    );
    // Không nói rõ là sai mã hay hết hạn hay không có tài khoản: cùng một câu.
    if (!reset) badRequest("Mã không đúng hoặc đã hết hạn, hãy gửi lại mã mới");

    // Giữ lượt thử TRƯỚC khi so mã, trong một câu UPDATE duy nhất. Đọc ra rồi
    // ghi lại thì N request bắn cùng lúc đều thấy attempts=0 và được thử cả N
    // lần; UPDATE khoá dòng nên tối đa RESET_CODE_MAX_ATTEMPTS request lọt qua.
    const claimed = await queryOne<{ attempts: number }>(
      `UPDATE "PasswordReset" SET "attempts" = "attempts" + 1
        WHERE "id" = $1 AND "usedAt" IS NULL AND "attempts" < $2
        RETURNING "attempts"`,
      [reset.id, RESET_CODE_MAX_ATTEMPTS]
    );
    if (!claimed) {
      await execute(`DELETE FROM "PasswordReset" WHERE "id" = $1`, [reset.id]);
      badRequest("Nhập sai quá nhiều lần, mã đã bị huỷ. Hãy gửi lại mã mới.");
    }

    if (reset.tokenHash !== hashToken(code)) {
      // Mã chỉ 8 chữ số nên sai quá ngưỡng là huỷ, bắt xin mã khác.
      if (claimed.attempts >= RESET_CODE_MAX_ATTEMPTS) {
        await execute(`DELETE FROM "PasswordReset" WHERE "id" = $1`, [reset.id]);
        badRequest("Nhập sai quá nhiều lần, mã đã bị huỷ. Hãy gửi lại mã mới.");
      }
      badRequest(
        `Mã không đúng, còn ${RESET_CODE_MAX_ATTEMPTS - claimed.attempts} lần thử`
      );
    }

    const hashed = await hashPassword(password);
    await transaction(async (client) => {
      // Hai request đúng mã cùng lúc: chỉ request đánh dấu được "đã dùng" mới
      // được đổi mật khẩu.
      const used = await client.query(
        `UPDATE "PasswordReset" SET "usedAt" = now()
          WHERE "id" = $1 AND "usedAt" IS NULL`,
        [reset.id]
      );
      if (used.rowCount === 0) {
        badRequest("Mã không đúng hoặc đã hết hạn, hãy gửi lại mã mới");
      }
      // Tăng phiên bản phiên: ai đang giữ phiên cũ (kể cả kẻ biết mật khẩu
      // cũ) bị đăng xuất ngay.
      await client.query(
        `UPDATE "User" SET "password" = $2, "sessionVersion" = "sessionVersion" + 1,
                "updatedAt" = now()
          WHERE "id" = $1`,
        [reset.userId, hashed]
      );
    });
    await logLoginEvent(req, "password_reset", {
      type: "employee",
      id: reset.userId,
      identifier: email,
    });

    // Đổi được mật khẩu thì gỡ luôn khoá đăng nhập: người dùng thật vừa chứng
    // minh họ đọc được hộp thư của chính mình.
    await clearLoginFailures(employeeKey(email));

    return { success: true };
  }, "Reset password error");
}
