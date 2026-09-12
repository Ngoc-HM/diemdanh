import { execute, queryOne } from "@/lib/db";
import { handle, HttpError } from "@/lib/auth-guard";
import { hashPassword, verifyPassword } from "@/lib/utils";
import { setSessionCookie, signSession } from "@/lib/session";
import { AdminRow } from "@/lib/types";
import {
  adminKey,
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-throttle";

function isBcryptHash(value: string) {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!username || !password) {
      throw new HttpError(400, "Vui lòng nhập tài khoản và mật khẩu");
    }

    const throttleKey = adminKey(username);
    await assertLoginAllowed(throttleKey);

    const admin = await queryOne<AdminRow>(
      `SELECT "id", "username", "password" FROM "Admin" WHERE "username" = $1`,
      [username]
    );

    if (admin) {
      const valid = isBcryptHash(admin.password)
        ? await verifyPassword(password, admin.password)
        : admin.password === password;

      if (!valid) {
        await recordLoginFailure(throttleKey);
        throw new HttpError(401, "Tài khoản hoặc mật khẩu không đúng");
      }

      // Nâng cấp bản ghi cũ còn lưu mật khẩu thô sang bcrypt.
      if (!isBcryptHash(admin.password)) {
        await execute(
          `UPDATE "Admin" SET "password" = $1, "updatedAt" = now() WHERE "id" = $2`,
          [await hashPassword(password), admin.id]
        );
      }

      await clearLoginFailures(throttleKey);
      await setSessionCookie(
        await signSession({
          userId: admin.id,
          role: "admin",
          name: "Administrator",
          email: admin.username,
        })
      );
      return { success: true };
    }

    // Chưa có admin nào trong DB: dùng thông tin trong .env để khởi tạo lần đầu.
    // Không có mật khẩu mặc định — thiếu AUTH_ADMIN_PASSWORD thì không ai đăng
    // nhập được, thà vậy còn hơn để lọt một tài khoản quản trị đoán được.
    const envUser = process.env.AUTH_ADMIN_USERNAME || "admin";
    const envPass = process.env.AUTH_ADMIN_PASSWORD;

    if (!envPass || username !== envUser || password !== envPass) {
      await recordLoginFailure(throttleKey);
      throw new HttpError(401, "Tài khoản hoặc mật khẩu không đúng");
    }

    const created = await queryOne<{ id: string; username: string }>(
      `INSERT INTO "Admin" ("username", "password") VALUES ($1, $2)
       RETURNING "id", "username"`,
      [envUser, await hashPassword(envPass)]
    );

    await clearLoginFailures(throttleKey);
    await setSessionCookie(
      await signSession({
        userId: created!.id,
        role: "admin",
        name: "Administrator",
        email: created!.username,
      })
    );
    return { success: true };
  }, "Admin login error");
}
