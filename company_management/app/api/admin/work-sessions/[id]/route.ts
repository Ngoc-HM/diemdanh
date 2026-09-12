import { execute, queryOne, transaction } from "@/lib/db";
import { badRequest, conflict, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { normalizeSession, validateSession } from "@/lib/validation";
import { WorkSessionRow } from "@/lib/types";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const session = normalizeSession(body);
    const validationError = validateSession(session);
    if (validationError) badRequest(validationError);

    const duplicate = await queryOne<{ id: string }>(
      `SELECT "id" FROM "WorkSession" WHERE "code" = $1`,
      [session.code]
    );
    if (duplicate && duplicate.id !== id) conflict("Mã ca đã tồn tại");

    const updated = await transaction(async (client) => {
      if (session.isDefaultFull) {
        await client.query(
          `UPDATE "WorkSession" SET "isDefaultFull" = false WHERE "id" <> $1`,
          [id]
        );
      }
      const result = await client.query<WorkSessionRow>(
        `UPDATE "WorkSession" SET
           "code" = $2, "name" = $3,
           "workStart" = $4, "workEnd" = $5, "minHours" = $6, "sortOrder" = $7,
           "isActive" = $8, "isDefaultFull" = $9, "updatedAt" = now()
         WHERE "id" = $1 RETURNING *`,
        [
          id,
          session.code,
          session.name,
          session.workStart,
          session.workEnd,
          session.minHours,
          session.sortOrder,
          session.isActive,
          session.isDefaultFull,
        ]
      );
      return result.rows[0] ?? null;
    });

    if (!updated) notFound("Không tìm thấy ca làm việc");

    return { session: updated };
  }, "Work session update error");
}

/// Ca đã được đăng ký ở tháng nào đó thì không xoá được — xoá sẽ làm mất
/// căn cứ tính công của các tháng cũ. Trường hợp đó chỉ nên tắt `isActive`.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;

    const session = await queryOne<{ id: string }>(
      `SELECT "id" FROM "WorkSession" WHERE "id" = $1`,
      [id]
    );
    if (!session) notFound("Không tìm thấy ca làm việc");

    const usage = await queryOne<{ n: number }>(
      `SELECT count(*)::int AS n FROM "ScheduleDay" WHERE "sessionId" = $1`,
      [id]
    );
    if ((usage?.n ?? 0) > 0) {
      conflict(
        `Ca này đang được dùng trong ${usage!.n} ngày đã đăng ký. Hãy tắt hoạt động thay vì xoá.`
      );
    }

    await execute(`DELETE FROM "WorkSession" WHERE "id" = $1`, [id]);
    return { success: true };
  }, "Work session delete error");
}
