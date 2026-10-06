import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { isValidMonth, monthKeyVN } from "@/lib/datetime";
import { getMonthPayroll, payrollWarnings } from "@/lib/payroll-service";

/// Bảng lương tháng: đã chốt thì trả ảnh chụp lúc chốt, chưa thì tính mới
/// (tháng chưa hết thì hôm nay → cuối tháng tạm tính đủ theo lịch).
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const month = new URL(req.url).searchParams.get("month") ?? monthKeyVN();
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const sheet = await getMonthPayroll(month);
    return {
      ...sheet,
      // Lưới ngày chỉ cần khi xuất file, bỏ bớt cho nhẹ trang.
      rows: sheet.rows.map(({ attendance, ...row }) => ({
        ...row,
        attendance: {
          workdays: attendance.workdays,
          leaveDays: attendance.leaveDays,
          reviewDays: attendance.reviewDays,
          projectedDays: attendance.projectedDays,
        },
      })),
      warnings: await payrollWarnings(sheet),
    };
  }, "Payroll read error");
}
