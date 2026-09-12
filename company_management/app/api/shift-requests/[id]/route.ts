import { execute, queryOne } from "@/lib/db";
import { conflict, handle, notFound, requireEmployee } from "@/lib/auth-guard";

/// Nhân viên rút lại yêu cầu của chính mình khi admin chưa xử lý. Yêu cầu của
/// người khác trả 404 như không tồn tại, để không lộ id yêu cầu của đồng
/// nghiệp; đã duyệt/từ chối thì giữ lại làm lịch sử, không cho xoá.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const session = await requireEmployee();
    const { id } = await params;

    const request = await queryOne<{ id: string; status: string }>(
      `SELECT "id", "status" FROM "ShiftChangeRequest"
        WHERE "id" = $1 AND "userId" = $2`,
      [id, session.userId]
    );
    if (!request) notFound("Không tìm thấy yêu cầu");
    if (request!.status !== "pending") {
      conflict("Yêu cầu đã được xử lý, không huỷ được nữa");
    }

    await execute(`DELETE FROM "ShiftChangeRequest" WHERE "id" = $1`, [id]);
    return { success: true };
  }, "Shift request delete error");
}
