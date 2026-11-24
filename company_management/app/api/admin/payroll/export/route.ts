import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { queryOne } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { getMonthRange, isValidMonth, monthKeyVN } from "@/lib/datetime";
import { getDayPunchTimes } from "@/lib/attendance-service";
import { getMonthPayroll } from "@/lib/payroll-service";
import {
  attachmentHeader,
  buildCompanyPayrollWorkbook,
  buildPayslipWorkbook,
  companyPayrollFileName,
  employeePayslipsZipName,
  payslipFileName,
  XLSX_CONTENT_TYPE,
} from "@/lib/payroll-export";

/// Admin tải bảng lương:
/// - mặc định: bảng lương toàn công ty (kèm sheet chấm công và OT);
/// - `userId`: file của một người (phiếu lương, chấm công chi tiết, làm thêm giờ);
/// - `scope=employees`: file zip, mỗi người một file như trên.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? monthKeyVN();
    const userId = searchParams.get("userId");
    const scope = searchParams.get("scope");
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const [sheet, company] = await Promise.all([
      getMonthPayroll(month),
      queryOne<{ value: string }>(
        `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
      ),
    ]);
    const companyName = company?.value ?? "";

    if (!userId && scope !== "employees") {
      const file = await buildCompanyPayrollWorkbook(sheet, companyName);
      return xlsxResponse(file, companyPayrollFileName(month));
    }

    const rows = userId ? sheet.rows.filter((item) => item.user.id === userId) : sheet.rows;
    if (userId && rows.length === 0) notFound("Nhân viên không có trong bảng lương tháng này");
    const { startDate, endDate } = getMonthRange(month);
    const times = await getDayPunchTimes(
      rows.map((row) => row.user.id),
      startDate,
      endDate
    );

    if (userId) {
      const row = rows[0];
      const file = await buildPayslipWorkbook(sheet, row, companyName, times.get(row.user.id) ?? {});
      return xlsxResponse(file, payslipFileName(month, row));
    }

    if (rows.length === 0) notFound("Tháng này chưa có ai trong bảng lương");
    const files: Record<string, Uint8Array> = {};
    for (const row of rows) {
      const file = await buildPayslipWorkbook(sheet, row, companyName, times.get(row.user.id) ?? {});
      let name = payslipFileName(month, row);
      // Trùng tên (hai người cùng tên, không có mã NV) thì đánh số thêm.
      for (let i = 2; files[name]; i++) name = payslipFileName(month, row).replace(/\.xlsx$/, ` (${i}).xlsx`);
      files[name] = new Uint8Array(file);
    }
    const zip = zipSync(files, { level: 6 });
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": attachmentHeader(employeePayslipsZipName(month)),
      },
    });
  }, "Payroll export error");
}

function xlsxResponse(file: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": attachmentHeader(fileName),
    },
  });
}
