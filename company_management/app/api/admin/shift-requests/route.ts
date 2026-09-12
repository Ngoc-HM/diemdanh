import { query, queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { getMonthRange, isValidMonth, monthKeyVN } from "@/lib/datetime";
import {
  buildAdminRequestViews,
  REQUEST_SELECT,
  RequestWithUserRow,
} from "@/lib/shift-requests";

/// Danh sách yêu cầu đổi ca cho admin.
/// - status=pending (mặc định): mọi yêu cầu đang chờ, không giới hạn tháng —
///   yêu cầu treo từ tháng trước vẫn phải được xử lý, không được "rơi" mất.
/// - status=all: mọi trạng thái trong `month`, để tra lại lịch sử.
/// `pendingCount` đếm toàn hệ thống để sidebar hiện badge dù đang xem tháng nào.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";
    const requestedMonth = searchParams.get("month");

    if (status !== "pending" && status !== "all") {
      badRequest("Bộ lọc trạng thái chỉ nhận pending hoặc all");
    }
    if (requestedMonth && !isValidMonth(requestedMonth)) {
      badRequest("Tháng không hợp lệ");
    }
    const month = requestedMonth || monthKeyVN();
    const { startDate, endDate } = getMonthRange(month);

    const where =
      status === "pending"
        ? `r."status" = 'pending'`
        : `r."date" BETWEEN $1 AND $2`;
    const params = status === "pending" ? [] : [startDate, endDate];

    const [rows, pending] = await Promise.all([
      query<RequestWithUserRow>(
        `${REQUEST_SELECT}
          WHERE ${where}
          ORDER BY CASE WHEN r."status" = 'pending' THEN 0 ELSE 1 END,
                   r."date" ASC, r."createdAt" ASC`,
        params
      ),
      queryOne<{ n: number }>(
        `SELECT count(*)::int AS n FROM "ShiftChangeRequest"
          WHERE "status" = 'pending'`
      ),
    ]);

    return {
      status,
      month,
      requests: await buildAdminRequestViews(rows),
      pendingCount: pending?.n ?? 0,
    };
  }, "Shift request admin list error");
}
