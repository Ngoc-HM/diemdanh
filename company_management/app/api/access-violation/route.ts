import { execute } from "@/lib/db";
import { handle } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";

/// Trang cảnh báo gọi vào đây để ghi lại lần truy cập sai. Chỉ ghi khi có
/// phiên đăng nhập: người lạ và bot quét đường dẫn thì bỏ qua, nếu không bảng
/// này đầy rác trong một ngày.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await getSession();
    if (!session) return { recorded: false };

    const body = await req.json().catch(() => ({}));
    const path = String(body?.path ?? "").slice(0, 500);
    const kind = body?.kind === "forbidden" ? "forbidden" : "not_found";
    if (!path.startsWith("/")) return { recorded: false };

    await execute(
      `INSERT INTO "AccessViolation"
         ("userId", "actorName", "actorRole", "path", "kind")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        // Admin không nằm trong bảng User nên không gắn khoá ngoại được.
        session.role === "employee" ? session.userId : null,
        session.name,
        session.role,
        path,
        kind,
      ]
    );

    return { recorded: true };
  }, "Access violation log error");
}
