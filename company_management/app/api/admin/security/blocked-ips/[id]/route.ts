import { queryOne } from "@/lib/db";
import { handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { invalidateBlockedRanges } from "@/lib/ip-policy";

/// Bỏ chặn. Tài khoản đã bị khoá vì IP này vẫn giữ khoá cho tới khi admin mở.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const removed = await queryOne(
      `DELETE FROM "BlockedIp" WHERE "id" = $1 RETURNING "id"`,
      [id]
    );
    if (!removed) notFound("Không tìm thấy IP trong danh sách chặn");
    invalidateBlockedRanges();
    return { success: true };
  }, "Blocked IP delete error");
}
