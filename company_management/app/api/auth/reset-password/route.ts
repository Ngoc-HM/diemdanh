import { queryOne, transaction } from "@/lib/db";
import { badRequest, handle } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/utils";
import { hashToken } from "@/lib/mailer";

/// Đặt mật khẩu mới bằng token trong email. Token dùng một lần.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "");
    const password = String(body?.password || "");

    if (!token) badRequest("Đường link đặt lại mật khẩu không hợp lệ");
    if (password.length < 6) badRequest("Mật khẩu phải có ít nhất 6 ký tự");

    const reset = await queryOne<{ id: string; userId: string }>(
      `SELECT r."id", r."userId"
         FROM "PasswordReset" r
         JOIN "User" u ON u."id" = r."userId"
        WHERE r."tokenHash" = $1 AND r."usedAt" IS NULL AND r."expiresAt" > now()
          AND u."isActive" = true`,
      [hashToken(token)]
    );
    if (!reset) {
      badRequest("Đường link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    }

    const hashed = await hashPassword(password);
    await transaction(async (client) => {
      await client.query(
        `UPDATE "User" SET "password" = $2, "updatedAt" = now() WHERE "id" = $1`,
        [reset!.userId, hashed]
      );
      await client.query(
        `UPDATE "PasswordReset" SET "usedAt" = now() WHERE "id" = $1`,
        [reset!.id]
      );
    });

    return { success: true };
  }, "Reset password error");
}
