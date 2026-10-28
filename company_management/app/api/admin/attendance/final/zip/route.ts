import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { isValidMonth, monthKeyVN } from "@/lib/datetime";
import { computeMonthAttendance } from "@/lib/attendance-month";
import { buildEmployeeBundleWorkbook } from "@/lib/attendance-export";

/// Tên file trong zip: "Mã NV - Họ tên.xlsx", bỏ ký tự không hợp lệ trên Windows.
function entryName(name: string, code: string | null, used: Set<string>) {
  const base = [code, name].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]+/g, " ").trim() || "nhan-vien";
  let file = `${base}.xlsx`;
  for (let i = 2; used.has(file); i++) file = `${base} (${i}).xlsx`;
  used.add(file);
  return file;
}

/// File zip chấm công từng người: mỗi người một file Excel giống hệt file toàn
/// công ty nhưng chỉ có dòng của người đó, kèm bảng OT ngang theo ngày.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const month = new URL(req.url).searchParams.get("month") ?? monthKeyVN();
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    // Cùng cách tính với file toàn công ty để hai file khớp nhau.
    const result = await computeMonthAttendance(month, {
      applyFinal: true,
      projectRemaining: month >= monthKeyVN(),
    });
    const companyName = await queryOne<{ value: string }>(
      `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
    );

    const files: Record<string, Uint8Array> = {};
    const used = new Set<string>();
    for (const row of result.summary) {
      const file = await buildEmployeeBundleWorkbook({
        month,
        dates: result.dates,
        sessionCodes: result.rules.map((rule) => rule.code),
        rows: [row],
        companyName: companyName?.value ?? "",
        holidays: Object.fromEntries(result.holidays),
        weeklyOffDays: result.weeklyOffDays,
        standardWorkdays: result.standardWorkdays,
        exportedOn: result.today,
      });
      files[entryName(row.user.name, row.user.employeeCode, used)] = new Uint8Array(file);
    }

    const zip = zipSync(files, { level: 6 });
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="cham-cong-tung-nguoi-${month}.zip"`,
      },
    });
  }, "Final timesheet zip error");
}
