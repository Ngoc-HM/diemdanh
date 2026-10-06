import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { isValidMonth, monthKeyVN } from "@/lib/datetime";
import { DAY_STATUS_LABELS } from "@/lib/attendance-rules";
import { computeMonthAttendance } from "@/lib/attendance-month";
import {
  attendanceFileName,
  buildAttendanceWorkbook,
  XLSX_CONTENT_TYPE,
} from "@/lib/attendance-export";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? monthKeyVN();
    // Giữ cả `export=csv` của link cũ: giờ luôn trả về file Excel.
    const wantsExcel = ["xlsx", "csv"].includes(searchParams.get("export") ?? "");

    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const result = await computeMonthAttendance(month);

    if (wantsExcel) {
      // Tên công ty chỉ cần khi xuất file, nên tra ở đây.
      const companyName = await queryOne<{ value: string }>(
        `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
      );
      const file = await buildAttendanceWorkbook({
        month,
        dates: result.dates,
        sessionCodes: result.rules.map((rule) => rule.code),
        rows: result.summary,
        companyName: companyName?.value ?? "",
        holidays: Object.fromEntries(result.holidays),
        weeklyOffDays: result.weeklyOffDays,
        standardWorkdays: result.standardWorkdays,
        exportedOn: result.today,
      });

      return new NextResponse(new Uint8Array(file), {
        headers: {
          "Content-Type": XLSX_CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${attendanceFileName(month)}"`,
        },
      });
    }

    return {
      month,
      daysInMonth: result.daysInMonth,
      dates: result.dates,
      sessions: result.rules,
      holidays: Object.fromEntries(result.holidays),
      statusLabels: DAY_STATUS_LABELS,
      standardWorkdays: result.standardWorkdays,
      summary: result.summary,
    };
  }, "Monthly attendance error");
}
