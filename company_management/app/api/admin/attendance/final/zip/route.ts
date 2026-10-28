import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { query, queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { formatTimeVN, getMonthRange, isValidMonth, monthKeyVN } from "@/lib/datetime";
import { computeMonthAttendance } from "@/lib/attendance-month";
import { DAY_STATUS_LABELS, type DayStatus } from "@/lib/attendance-rules";
import { buildEmployeeBundleWorkbook } from "@/lib/attendance-export";
import { listApprovedOvertimeTickets } from "@/lib/overtime-service";

/// Tên file trong zip: "Mã NV - Họ tên.xlsx", bỏ ký tự không hợp lệ trên Windows.
function entryName(name: string, code: string | null, used: Set<string>) {
  const base = [code, name].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]+/g, " ").trim() || "nhan-vien";
  let file = `${base}.xlsx`;
  for (let i = 2; used.has(file); i++) file = `${base} (${i}).xlsx`;
  used.add(file);
  return file;
}

/// File zip chấm công từng người theo bảng công chốt: mỗi người một file Excel
/// gồm bảng chính (giờ vào / ra từng ngày, tổng hợp ở cuối) và bảng OT.
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
    const userIds = result.summary.map((row) => row.user.id);
    const { startDate, endDate } = getMonthRange(month);

    const [companyName, punchRows, tickets] = await Promise.all([
      queryOne<{ value: string }>(`SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`),
      query<{ userId: string; date: string; note: string | null; type: string | null; at: Date | null }>(
        `SELECT a."userId", a."date", a."note", p."type", p."at"
           FROM "Attendance" a
           LEFT JOIN "AttendancePunch" p ON p."attendanceId" = a."id"
          WHERE a."userId" = ANY($1::text[]) AND a."date" BETWEEN $2 AND $3
          ORDER BY p."at" ASC`,
        [userIds, startDate, endDate]
      ),
      listApprovedOvertimeTickets(userIds, month),
    ]);

    // Giờ vào sớm nhất / ra muộn nhất và ghi chú của từng ngày.
    const dayInfo = new Map<string, { firstIn: string | null; lastOut: string | null; note: string | null }>();
    for (const row of punchRows) {
      const key = `${row.userId}|${row.date}`;
      const info = dayInfo.get(key) ?? { firstIn: null, lastOut: null, note: row.note };
      if (row.at && row.type === "in" && !info.firstIn) info.firstIn = formatTimeVN(row.at);
      if (row.at && row.type === "out") info.lastOut = formatTimeVN(row.at);
      dayInfo.set(key, info);
    }

    const holidays = Object.fromEntries(result.holidays);
    const company = companyName?.value ?? "";
    const files: Record<string, Uint8Array> = {};
    const used = new Set<string>();

    for (const row of result.summary) {
      const userId = row.user.id;
      const days = result.dates.map((date) => {
        const cell = row.days[date];
        const info = dayInfo.get(`${userId}|${date}`);
        const status = cell ? (DAY_STATUS_LABELS[cell.status as DayStatus] ?? cell.status) : "";
        return {
          date,
          holidayName: holidays[date] ?? null,
          scheduledCodes: cell?.codes ?? [],
          firstIn: info?.firstIn ?? null,
          lastOut: info?.lastOut ?? null,
          workedHours: cell?.workedHours ?? 0,
          workdayValue: cell?.workdayValue ?? 0,
          overtime: cell?.overtime ? { ...cell.overtime, place: null } : null,
          statusLabel: cell?.finalEdited ? `${status} (đã chốt)` : cell?.projected ? "Tạm tính" : status,
          note: info?.note ?? null,
        };
      });

      const file = await buildEmployeeBundleWorkbook({
        summary: row,
        sessionCodes: result.rules.map((rule) => rule.code),
        detail: {
          month,
          companyName: company,
          user: row.user,
          days,
          workdays: row.workdays,
          standardWorkdays: result.standardWorkdays,
          weeklyOffDays: result.weeklyOffDays,
          exportedOn: result.today,
        },
        overtime: {
          month,
          user: row.user,
          tickets: tickets.filter((ticket) => ticket.user.id === userId),
        },
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
