import { execute } from "@/lib/db";
import { handle, notFound, requireAdmin } from "@/lib/auth-guard";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const removed = await execute(`DELETE FROM "Holiday" WHERE "id" = $1`, [id]);
    if (removed === 0) notFound("Không tìm thấy ngày lễ");
    return { success: true };
  }, "Holiday delete error");
}
