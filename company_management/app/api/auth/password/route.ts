import { execute, queryOne } from "@/lib/db";
import { badRequest, handle, HttpError, notFound, requireEmployee } from "@/lib/auth-guard";
import { hashPassword, verifyPassword } from "@/lib/utils";
import { reissueSession } from "@/lib/session";
import { logLoginEvent } from "@/lib/security-log";
import { bumpSessionVersion } from "@/lib/two-factor";

/// Nhân viên tự đổi mật khẩu, phải biết mật khẩu hiện tại. Đổi xong thì mọi
/// phiên khác (máy khác, trình duyệt khác) bị đăng xuất.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || "");

    if (!currentPassword || !newPassword) badRequest("Vui lòng nhập đủ thông tin");
    if (newPassword.length < 6) badRequest("Mật khẩu mới phải có ít nhất 6 ký tự");
    if (newPassword === currentPassword) {
      badRequest("Mật khẩu mới phải khác mật khẩu hiện tại");
    }

    const user = await queryOne<{ id: string; password: string }>(
      `SELECT "id", "password" FROM "User" WHERE "id" = $1`,
      [session.userId]
    );
    if (!user) notFound("Không tìm thấy tài khoản");

    if (!(await verifyPassword(currentPassword, user!.password))) {
      throw new HttpError(401, "Mật khẩu hiện tại không đúng");
    }

    await execute(
      `UPDATE "User" SET "password" = $2, "updatedAt" = now() WHERE "id" = $1`,
      [user!.id, await hashPassword(newPassword)]
    );
    const account = { type: "employee", id: user!.id } as const;
    await reissueSession(session, await bumpSessionVersion(account));
    await logLoginEvent(req, "password_changed", { ...account, identifier: session.email });
    return { success: true };
  }, "Change password error");
}
