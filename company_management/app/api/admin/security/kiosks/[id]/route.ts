import { handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { revokeKioskDevice } from "@/lib/presence";

/// Thu hồi màn hình (mất máy, chuyển chỗ). Khoá sinh mã đổi luôn, nên mã ai
/// chụp lại trước đó cũng hết dùng được.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    if (!(await revokeKioskDevice(id))) notFound("Không tìm thấy màn hình");
    return { success: true };
  }, "Kiosk revoke error");
}
