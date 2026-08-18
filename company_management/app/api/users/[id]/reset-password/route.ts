import { execute, queryOne } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const password = String(body?.password || "");

    if (password.length < 6) badRequest("Mật khẩu phải có ít nhất 6 ký tự");

    const user = await queryOne<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "id" = $1`,
      [id]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

    await execute(
      `UPDATE "User" SET "password" = $2, "updatedAt" = now() WHERE "id" = $1`,
      [id, await hashPassword(password)]
    );

    return { success: true };
  }, "Reset password error");
}
