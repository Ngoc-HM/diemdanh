import { queryOne } from "@/lib/db";
import { badRequest, handle, HttpError } from "@/lib/auth-guard";
import { verifyPassword } from "@/lib/utils";
import { setSessionCookie, signSession } from "@/lib/session";
import { UserRow } from "@/lib/types";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) badRequest("Vui lòng nhập email và mật khẩu");

    const user = await queryOne<UserRow>(
      `SELECT "id", "name", "email", "password", "role", "isActive"
         FROM "User" WHERE "email" = $1`,
      [email]
    );

    if (!user || user.role !== "employee") {
      throw new HttpError(401, "Email hoặc mật khẩu không đúng");
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) throw new HttpError(401, "Email hoặc mật khẩu không đúng");

    if (!user.isActive) {
      throw new HttpError(403, "Tài khoản đã ngừng hoạt động. Liên hệ quản trị viên.");
    }

    await setSessionCookie(
      await signSession({
        userId: user.id,
        role: "employee",
        name: user.name,
        email: user.email,
      })
    );

    return { success: true, user: { name: user.name } };
  }, "Login error");
}
