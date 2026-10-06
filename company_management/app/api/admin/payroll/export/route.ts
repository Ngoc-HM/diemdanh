import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { isValidMonth, monthKeyVN } from "@/lib/datetime";
import { getMonthPayroll } from "@/lib/payroll-service";
import {
  buildCompanyPayrollWorkbook,
  buildPayslipWorkbook,
  companyPayrollFileName,
  payslipFileName,
  XLSX_CONTENT_TYPE,
} from "@/lib/payroll-export";

/// Admin tải bảng lương: không có userId = bảng lương toàn công ty (kèm sheet
/// chấm công); có userId = phiếu lương của người đó (kèm làm thêm giờ và
/// chấm công từng ngày).
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? monthKeyVN();
    const userId = searchParams.get("userId");
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const [sheet, company] = await Promise.all([
      getMonthPayroll(month),
      queryOne<{ value: string }>(
        `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
      ),
    ]);
    const companyName = company?.value ?? "";

    let file: Buffer;
    let fileName: string;
    if (userId) {
      const row = sheet.rows.find((item) => item.user.id === userId);
      if (!row) notFound("Nhân viên không có trong bảng lương tháng này");
      file = await buildPayslipWorkbook(sheet, row!, companyName);
      fileName = payslipFileName(month, row!);
    } else {
      file = await buildCompanyPayrollWorkbook(sheet, companyName);
      fileName = companyPayrollFileName(month);
    }

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }, "Payroll export error");
}
