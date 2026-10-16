import { queryOne } from "@/lib/db";
import { handle, notFound, requireEmployee } from "@/lib/auth-guard";

/// Nhân viên bỏ đăng ký một máy của mình.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const session = await requireEmployee();
    const { id } = await params;
    const removed = await queryOne(
      `DELETE FROM "EmployeeDevice" WHERE "id" = $1 AND "userId" = $2 RETURNING "id"`,
      [id, session.userId],
    );
    if (!removed) notFound("Không tìm thấy máy này");
    return { success: true };
  }, "Device delete error");
}
