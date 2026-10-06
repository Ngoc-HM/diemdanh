import { execute, queryOne } from "@/lib/db";
import { HttpError } from "@/lib/auth-guard";
import { hashPassword, verifyPassword } from "@/lib/utils";
import type { SessionPayload } from "@/lib/session";
import { AdminRow, UserRow } from "@/lib/types";
import {
  adminKey,
  assertLoginAllowed,
  clearLoginFailures,
  employeeKey,
  EMPLOYEE_UNLOCK_HINT,
  recordLoginFailure,
} from "@/lib/login-throttle";

/// Một trang đăng nhập cho cả hai vai trò, một ô "Email hoặc tên đăng nhập".
/// Chuỗi nhập vào trùng tên đăng nhập admin (bảng Admin, không phân biệt hoa
/// thường, có thể là "admin" hay một email) thì vào khu quản trị, không thì tìm
/// theo email trong bảng nhân viên. Một email không thể vừa là admin vừa là
/// nhân viên: assertEmailNotAdmin chặn ở mọi chỗ tạo hoặc đổi email nhân viên.
export async function login(
  rawIdentifier: string,
  password: string
): Promise<SessionPayload> {
  const identifier = rawIdentifier.trim().toLowerCase();
  const admin = await queryOne<{ username: string }>(
    `SELECT "username" FROM "Admin" WHERE lower("username") = $1`,
    [identifier]
  );
  if (admin) return loginAdmin(admin.username, password);

  // Chưa có dòng Admin nào cho tên này nhưng khớp tài khoản khởi tạo trong
  // .env: để loginAdmin tạo admin lần đầu.
  const envUser = (process.env.AUTH_ADMIN_USERNAME || "admin").trim();
  if (identifier === envUser.toLowerCase()) return loginAdmin(envUser, password);

  return loginEmployee(identifier, password);
}

/// Chặn đặt email nhân viên trùng tài khoản admin, nếu không trang đăng nhập
/// chung sẽ không biết đưa người đó vào khu nào.
export async function assertEmailNotAdmin(email: string) {
  const admin = await queryOne<{ id: string }>(
    `SELECT "id" FROM "Admin" WHERE lower("username") = lower($1)`,
    [email]
  );
  if (admin) throw new HttpError(409, "Email đã được dùng");
}

/// Sai gì cũng cùng một câu, không để lộ tài khoản đó là admin hay nhân viên,
/// có tồn tại hay không.
const INVALID_LOGIN = "Tài khoản hoặc mật khẩu không đúng";

async function loginEmployee(
  rawEmail: string,
  password: string
): Promise<SessionPayload> {
  const email = rawEmail.toLowerCase();
  // Đếm cả email không có trong hệ thống, để không ai suy ra được email nào
  // có tài khoản qua việc có bị khoá hay không.
  const throttleKey = employeeKey(email);
  await assertLoginAllowed(throttleKey, EMPLOYEE_UNLOCK_HINT);

  const user = await queryOne<UserRow>(
    `SELECT "id", "name", "email", "password", "role", "isActive"
       FROM "User" WHERE "email" = $1`,
    [email]
  );

  if (!user || user.role !== "employee") {
    await recordLoginFailure(throttleKey);
    throw new HttpError(401, INVALID_LOGIN);
  }

  if (!(await verifyPassword(password, user.password))) {
    await recordLoginFailure(throttleKey);
    throw new HttpError(401, INVALID_LOGIN);
  }

  if (!user.isActive) {
    throw new HttpError(403, "Tài khoản đã ngừng hoạt động. Liên hệ quản trị viên.");
  }

  await clearLoginFailures(throttleKey);
  return { userId: user.id, role: "employee", name: user.name, email: user.email };
}

function isBcryptHash(value: string) {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

async function loginAdmin(
  username: string,
  password: string
): Promise<SessionPayload> {
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
      throw new HttpError(401, INVALID_LOGIN);
    }

    // Nâng cấp bản ghi cũ còn lưu mật khẩu thô sang bcrypt.
    if (!isBcryptHash(admin.password)) {
      await execute(
        `UPDATE "Admin" SET "password" = $1, "updatedAt" = now() WHERE "id" = $2`,
        [await hashPassword(password), admin.id]
      );
    }

    await clearLoginFailures(throttleKey);
    return {
      userId: admin.id,
      role: "admin",
      name: "Administrator",
      email: admin.username,
    };
  }

  // Chưa có admin nào trong DB: dùng thông tin trong .env để khởi tạo lần đầu.
  // Không có mật khẩu mặc định — thiếu AUTH_ADMIN_PASSWORD thì không ai đăng
  // nhập được, thà vậy còn hơn để lọt một tài khoản quản trị đoán được.
  const envUser = (process.env.AUTH_ADMIN_USERNAME || "admin").trim();
  const envPass = process.env.AUTH_ADMIN_PASSWORD;

  if (!envPass || username !== envUser || password !== envPass) {
    await recordLoginFailure(throttleKey);
    throw new HttpError(401, INVALID_LOGIN);
  }

  const created = await queryOne<{ id: string; username: string }>(
    `INSERT INTO "Admin" ("username", "password") VALUES ($1, $2)
     RETURNING "id", "username"`,
    [envUser, await hashPassword(envPass)]
  );

  await clearLoginFailures(throttleKey);
  return {
    userId: created!.id,
    role: "admin",
    name: "Administrator",
    email: created!.username,
  };
}
