import { execute, queryOne } from "@/lib/db";
import { conflict, handle, notFound, requireEmployee } from "@/lib/auth-guard";

/// Nhân viên rút phiếu OT của chính mình khi admin chưa xử lý. Phiếu của người
/// khác trả 404 như không tồn tại.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const session = await requireEmployee();
    const { id } = await params;
    const request = await queryOne<{ status: string }>(
      `SELECT "status" FROM "OvertimeRequest" WHERE "id" = $1 AND "userId" = $2`,
      [id, session.userId]
    );
    if (!request) notFound("Không tìm thấy phiếu OT");
    if (request!.status !== "pending") {
      conflict("Phiếu đã được xử lý, không huỷ được nữa");
    }
    await execute(`DELETE FROM "OvertimeRequest" WHERE "id" = $1`, [id]);
    return { success: true };
  }, "Overtime delete error");
}
