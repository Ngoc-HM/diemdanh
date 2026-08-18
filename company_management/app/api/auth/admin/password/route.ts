import { execute, queryOne } from "@/lib/db";
import { badRequest, handle, HttpError, requireAdmin } from "@/lib/auth-guard";
import { hashPassword, verifyPassword } from "@/lib/utils";
import { AdminRow } from "@/lib/types";

function isBcryptHash(value: string) {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

export async function PUT(req: Request) {
  return handle(async () => {
    const session = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || "");

    if (!currentPassword || !newPassword) badRequest("Vui lòng nhập đủ thông tin");
    if (newPassword.length < 8) badRequest("Mật khẩu mới phải có ít nhất 8 ký tự");
    if (newPassword === currentPassword) {
      badRequest("Mật khẩu mới phải khác mật khẩu hiện tại");
    }

    const admin = await queryOne<AdminRow>(
      `SELECT "id", "password" FROM "Admin" WHERE "username" = $1`,
      [session.email]
    );

    if (admin) {
      const valid = isBcryptHash(admin.password)
        ? await verifyPassword(currentPassword, admin.password)
        : admin.password === currentPassword;
      if (!valid) throw new HttpError(401, "Mật khẩu hiện tại không đúng");

      await execute(
        `UPDATE "Admin" SET "password" = $1, "updatedAt" = now() WHERE "id" = $2`,
        [await hashPassword(newPassword), admin.id]
      );
      return { success: true };
    }

    // Chưa có bản ghi trong DB thì đối chiếu với mật khẩu trong .env,
    // tránh việc phiên đăng nhập cũ đặt lại mật khẩu mà không cần biết mật khẩu cũ.
    const envPass = process.env.AUTH_ADMIN_PASSWORD || "admin123";
    if (currentPassword !== envPass) {
      throw new HttpError(401, "Mật khẩu hiện tại không đúng");
    }

    await execute(`INSERT INTO "Admin" ("username", "password") VALUES ($1, $2)`, [
      session.email,
      await hashPassword(newPassword),
    ]);
    return { success: true };
  }, "Change admin password error");
}
