import { query } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/auth-guard";

type Row = {
  id: string;
  actorName: string | null;
  actorRole: string | null;
  path: string;
  kind: "not_found" | "forbidden";
  createdAt: Date;
};

/// Những lần người đã đăng nhập mở đường dẫn không tồn tại hoặc không đủ
/// quyền. Chỉ giữ 100 dòng gần nhất cho gọn.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const rows = await query<Row>(
      `SELECT "id", "actorName", "actorRole", "path", "kind", "createdAt"
         FROM "AccessViolation"
        ORDER BY "createdAt" DESC LIMIT 100`
    );
    return {
      items: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }, "Access violation list error");
}
