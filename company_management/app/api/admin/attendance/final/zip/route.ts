import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { query, queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { formatTimeVN, getMonthRange, isValidMonth, monthKeyVN } from "@/lib/datetime";
import { computeMonthAttendance } from "@/lib/attendance-month";
import { buildEmployeeBundleWorkbook, type DayPunchTimes } from "@/lib/attendance-export";

/// Tên file trong zip: "Mã NV - Họ tên.xlsx", bỏ ký tự không hợp lệ trên Windows.
function entryName(name: string, code: string | null, used: Set<string>) {
  const base = [code, name].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]+/g, " ").trim() || "nhan-vien";
  let file = `${base}.xlsx`;
  for (let i = 2; used.has(file); i++) file = `${base} (${i}).xlsx`;
  used.add(file);
  return file;
}

/// File zip chấm công từng người: mỗi người một file Excel giống hệt file toàn
/// công ty nhưng chỉ có dòng của người đó, kèm bảng OT và bảng giờ vào / ra.
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
    const { startDate, endDate } = getMonthRange(month);
    const [companyName, punchRows] = await Promise.all([
      queryOne<{ value: string }>(`SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`),
      query<{ userId: string; date: string; type: string; at: Date; isManual: boolean }>(
        `SELECT a."userId", a."date", p."type", p."at", p."isManual"
           FROM "Attendance" a
           JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
          WHERE a."userId" = ANY($1::text[]) AND a."date" BETWEEN $2 AND $3
          ORDER BY p."at" ASC`,
        [result.summary.map((row) => row.user.id), startDate, endDate]
      ),
    ]);

    // Giờ vào sớm nhất / ra muộn nhất từng ngày; admin sửa giờ thì ghi chú.
    const times = new Map<string, Record<string, DayPunchTimes>>();
    for (const row of punchRows) {
      const byDate = times.get(row.userId) ?? {};
      const day = (byDate[row.date] ??= { firstIn: null, lastOut: null, adminEdited: false });
      if (row.type === "in" && !day.firstIn) {
        day.firstIn = formatTimeVN(row.at);
        day.inByAdmin = row.isManual;
      }
      if (row.type === "out") {
        day.lastOut = formatTimeVN(row.at);
        day.outByAdmin = row.isManual;
      }
      if (row.isManual) day.adminEdited = true;
      times.set(row.userId, byDate);
    }

    const files: Record<string, Uint8Array> = {};
    const used = new Set<string>();
    for (const row of result.summary) {
      // Ô admin chấm tay ở bảng công chốt cũng tính là admin sửa.
      const userTimes = { ...(times.get(row.user.id) ?? {}) };
      for (const [date, cell] of Object.entries(row.days)) {
        if (!cell.finalEdited) continue;
        userTimes[date] = { ...(userTimes[date] ?? { firstIn: null, lastOut: null }), adminEdited: true };
      }
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
      }, userTimes);
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
