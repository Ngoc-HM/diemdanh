import { execute, isUniqueViolation, queryOne } from "@/lib/db";
import { conflict, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { normalizeAllowance } from "@/lib/allowances";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const allowance = normalizeAllowance(await req.json().catch(() => null));
    try {
      const updated = await queryOne(
        `UPDATE "Allowance" SET "name" = $2, "amount" = $3, "mode" = $4,
                "taxable" = $5, "isActive" = $6
          WHERE "id" = $1
          RETURNING "id", "name", "amount"::float8 AS "amount", "mode", "taxable", "isActive"`,
        [id, allowance.name, allowance.amount, allowance.mode, allowance.taxable, allowance.isActive]
      );
      if (!updated) notFound("Không tìm thấy khoản hỗ trợ");
      return { allowance: updated };
    } catch (error) {
      if (isUniqueViolation(error)) conflict("Đã có khoản hỗ trợ trùng tên");
      throw error;
    }
  }, "Allowance update error");
}

/// Xoá khoản hỗ trợ: mọi người đang hưởng khoản này cũng mất theo. Bảng lương
/// đã chốt vẫn giữ nguyên số tiền cũ trong ảnh chụp.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const removed = await execute(`DELETE FROM "Allowance" WHERE "id" = $1`, [id]);
    if (removed === 0) notFound("Không tìm thấy khoản hỗ trợ");
    return { success: true };
  }, "Allowance delete error");
}
