import { queryOne } from "@/lib/db";
import { handle, notFound, requireAdmin } from "@/lib/auth-guard";

/// Admin xoá máy đã đăng ký của nhân viên (vd máy đổi chủ, nghỉ việc).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const removed = await queryOne(
      `DELETE FROM "EmployeeDevice" WHERE "id" = $1 RETURNING "id"`,
      [id],
    );
    if (!removed) notFound("Không tìm thấy máy này");
    return { success: true };
  }, "Wifi device delete error");
}
