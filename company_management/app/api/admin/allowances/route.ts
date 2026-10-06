import { isUniqueViolation, query, queryOne } from "@/lib/db";
import { conflict, handle, requireAdmin } from "@/lib/auth-guard";
import { normalizeAllowance } from "@/lib/allowances";

/// Danh mục khoản hỗ trợ, kèm số người đang được hưởng.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const allowances = await query(
      `SELECT a."id", a."name", a."amount"::float8 AS "amount", a."mode", a."taxable",
              a."isActive", a."sortOrder",
              (SELECT count(*)::int FROM "EmployeeAllowance" ea
                WHERE ea."allowanceId" = a."id") AS "assignedCount"
         FROM "Allowance" a
        ORDER BY a."sortOrder" ASC, a."name" ASC`
    );
    return { allowances };
  }, "Allowance list error");
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const allowance = normalizeAllowance(await req.json().catch(() => null));
    try {
      const created = await queryOne(
        `INSERT INTO "Allowance" ("name", "amount", "mode", "taxable", "isActive", "sortOrder")
         VALUES ($1, $2, $3, $4, $5,
                 (SELECT COALESCE(max("sortOrder"), 0) + 1 FROM "Allowance"))
         RETURNING "id", "name", "amount"::float8 AS "amount", "mode", "taxable", "isActive"`,
        [allowance.name, allowance.amount, allowance.mode, allowance.taxable, allowance.isActive]
      );
      return { allowance: created };
    } catch (error) {
      if (isUniqueViolation(error)) conflict("Đã có khoản hỗ trợ trùng tên");
      throw error;
    }
  }, "Allowance create error");
}
