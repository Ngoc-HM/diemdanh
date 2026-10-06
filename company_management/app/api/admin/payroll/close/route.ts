import { query, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { isValidMonth } from "@/lib/datetime";
import { computeMonthPayroll } from "@/lib/payroll-service";

/// Chốt lương tháng: tính lại lần cuối rồi lưu nguyên kết quả. Từ đó file tải
/// về luôn ra đúng con số đã chốt, dù chấm công hay hồ sơ lương có đổi.
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const month = String(body?.month || "");
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const existing = await queryOne<{ month: string }>(
      `SELECT "month" FROM "PayrollClosing" WHERE "month" = $1`,
      [month]
    );
    if (existing) conflict("Tháng này đã chốt lương, mở chốt trước nếu cần tính lại");

    const sheet = await computeMonthPayroll(month);
    const saved = await queryOne<{ closedAt: Date }>(
      `INSERT INTO "PayrollClosing" ("month", "snapshot", "closedBy")
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT ("month") DO NOTHING
       RETURNING "closedAt"`,
      [month, JSON.stringify(sheet), admin.userId]
    );
    if (!saved) conflict("Tháng này đã chốt lương");
    return { month, closedAt: saved!.closedAt.toISOString() };
  }, "Payroll close error");
}

/// Mở chốt: bỏ ảnh chụp, bảng lương quay về tính theo dữ liệu hiện tại.
export async function DELETE(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const month = new URL(req.url).searchParams.get("month") ?? "";
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");
    const removed = await query<{ month: string }>(
      `DELETE FROM "PayrollClosing" WHERE "month" = $1 RETURNING "month"`,
      [month]
    );
    if (removed.length === 0) notFound("Tháng này chưa chốt lương");
    return { month, reopened: true };
  }, "Payroll reopen error");
}
