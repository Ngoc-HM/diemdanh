import { query } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { getMonthRange, isValidMonth, monthKeyVN } from "@/lib/datetime";
import {
  buildOvertimeViews,
  OVERTIME_SELECT,
  OvertimeRow,
} from "@/lib/overtime-service";

const STATUSES = ["pending", "approved", "rejected"];

/// Phiếu OT của cả công ty trong tháng. `status` lọc theo trạng thái; không
/// truyền thì lấy hết, phiếu đang chờ lên đầu.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const requested = searchParams.get("month");
    if (requested && !isValidMonth(requested)) badRequest("Tháng không hợp lệ");
    const month = requested || monthKeyVN();
    const status = searchParams.get("status");
    if (status && !STATUSES.includes(status)) badRequest("Trạng thái không hợp lệ");
    const { startDate, endDate } = getMonthRange(month);

    const rows = await query<OvertimeRow>(
      `${OVERTIME_SELECT}
        WHERE o."date" BETWEEN $1 AND $2
          AND ($3::text IS NULL OR o."status" = $3)
        ORDER BY (o."status" = 'pending') DESC, o."date" DESC, u."name" ASC`,
      [startDate, endDate, status]
    );
    const pending = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "OvertimeRequest" WHERE "status" = 'pending'`
    );
    return {
      month,
      requests: await buildOvertimeViews(rows),
      pendingTotal: pending[0]?.n ?? 0,
    };
  }, "Admin overtime list error");
}
