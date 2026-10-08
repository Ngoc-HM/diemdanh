import { queryOne } from "@/lib/db";
import { handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { logLoginEvent } from "@/lib/security-log";
import { bumpSessionVersion, disableTwoFactor } from "@/lib/two-factor";

/// Admin tắt xác thực 2 lớp của một nhân viên (mất điện thoại, hết mã dự
/// phòng). Mọi phiên của nhân viên đó bị đăng xuất; họ đăng nhập lại bằng
/// mật khẩu rồi tự bật lại.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const user = await queryOne<{ id: string; email: string }>(
      `SELECT "id", "email" FROM "User" WHERE "id" = $1`,
      [id]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

    const account = { type: "employee", id: user!.id } as const;
    await disableTwoFactor(account);
    await bumpSessionVersion(account);
    await logLoginEvent(req, "2fa_reset_by_admin", {
      ...account,
      identifier: `${user!.email} (bởi ${admin.email})`,
    });
    return { success: true };
  }, "Admin reset 2FA error");
}
