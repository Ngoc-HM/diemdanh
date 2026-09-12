import { execute, queryOne, transaction } from "@/lib/db";
import { badRequest, handle } from "@/lib/auth-guard";
import { hashPassword, isValidEmail } from "@/lib/utils";
import {
  hashToken,
  RESET_CODE_LENGTH,
  RESET_CODE_MAX_ATTEMPTS,
} from "@/lib/mailer";

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
      attempts: number;
    }>(
      `SELECT r."id", r."userId", r."tokenHash", r."attempts"
         FROM "PasswordReset" r
         JOIN "User" u ON u."id" = r."userId"
        WHERE u."email" = $1 AND u."isActive" = true
          AND r."usedAt" IS NULL AND r."expiresAt" > now()
        ORDER BY r."createdAt" DESC LIMIT 1`,
      [email]
    );
    // Không nói rõ là sai mã hay hết hạn hay không có tài khoản: cùng một câu.
    if (!reset) badRequest("Mã không đúng hoặc đã hết hạn, hãy gửi lại mã mới");

    if (reset.tokenHash !== hashToken(code)) {
      const attempts = reset.attempts + 1;
      // Mã chỉ 8 chữ số nên sai quá ngưỡng là huỷ, bắt xin mã khác.
      if (attempts >= RESET_CODE_MAX_ATTEMPTS) {
        await execute(`DELETE FROM "PasswordReset" WHERE "id" = $1`, [reset.id]);
        badRequest("Nhập sai quá nhiều lần, mã đã bị huỷ. Hãy gửi lại mã mới.");
      }
      await execute(
        `UPDATE "PasswordReset" SET "attempts" = $2 WHERE "id" = $1`,
        [reset.id, attempts]
      );
      badRequest(
        `Mã không đúng, còn ${RESET_CODE_MAX_ATTEMPTS - attempts} lần thử`
      );
    }

    const hashed = await hashPassword(password);
    await transaction(async (client) => {
      await client.query(
        `UPDATE "User" SET "password" = $2, "updatedAt" = now() WHERE "id" = $1`,
        [reset.userId, hashed]
      );
      await client.query(
        `UPDATE "PasswordReset" SET "usedAt" = now() WHERE "id" = $1`,
        [reset.id]
      );
    });

    return { success: true };
  }, "Reset password error");
}
