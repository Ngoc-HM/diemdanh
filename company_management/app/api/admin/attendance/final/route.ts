import { query, queryOne } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { isValidDateKey, isValidMonth, monthKeyVN } from "@/lib/datetime";
import { computeMonthAttendance, MonthDayCell } from "@/lib/attendance-month";
import { accountingCellLabel } from "@/lib/attendance-export";
import { FinalDay, validateFinalDay } from "@/lib/final-timesheet";

function accountingOf(cell: Omit<MonthDayCell, "machine"> | null | undefined, employmentType: string) {
  return cell ? accountingCellLabel(cell, employmentType) : "";
}

/// Bảng công chốt của tháng: mỗi ô ghi đúng ký hiệu sẽ ra file Excel (theo
/// admin nếu đã chấm tay, không thì theo máy), kèm ký hiệu máy để đối chiếu.
/// Tháng chưa hết: hôm nay tới cuối tháng tạm tính đủ công theo lịch.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const month = new URL(req.url).searchParams.get("month") ?? monthKeyVN();
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const result = await computeMonthAttendance(month, {
      applyFinal: true,
      projectRemaining: month >= monthKeyVN(),
    });

    return {
      month,
      today: result.today,
      dates: result.dates,
      holidays: Object.fromEntries(result.holidays),
      weeklyOffDays: result.weeklyOffDays,
      standardWorkdays: result.standardWorkdays,
      sessions: result.rules.map((rule) => ({
        id: rule.id,
        code: rule.code,
        name: rule.name,
        workdayValue: rule.workdayValue ?? 1,
      })),
      rows: result.summary.map((row) => ({
        user: {
          id: row.user.id,
          name: row.user.name,
          employeeCode: row.user.employeeCode,
          employmentType: row.user.employmentType,
          employmentLabel: row.user.employmentLabel,
        },
        workdays: row.workdays,
        leaveDays: row.leaveDays,
        sickDays: row.sickDays,
        absentDays: row.absentDays,
        overtimeMinutes: row.overtimeMinutes,
        days: Object.fromEntries(
          Object.entries(row.days).map(([date, cell]) => [
            date,
            {
              label: accountingOf(cell, row.user.employmentType),
              machineLabel: accountingOf(cell.machine ?? cell, row.user.employmentType),
              machineDetail: (cell.machine ?? cell).label,
              edited: Boolean(cell.finalEdited),
              projected: cell.projected,
              workdayValue: cell.workdayValue,
              overtime: cell.overtime,
            },
          ])
        ),
      })),
    };
  }, "Final timesheet read error");
}

/// Admin chấm tay một ô. `value: null` = bỏ, ô quay về theo máy.
export async function PUT(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "");
    const date = String(body?.date || "");
    if (!userId) badRequest("Thiếu nhân viên");
    if (!isValidDateKey(date)) badRequest("Ngày không hợp lệ");

    const user = await queryOne<{ id: string }>(`SELECT "id" FROM "User" WHERE "id" = $1`, [userId]);
    if (!user) notFound("Không tìm thấy nhân viên");

    if (body?.value === null || body?.value === undefined) {
      await query(`DELETE FROM "FinalTimesheetDay" WHERE "userId" = $1 AND "date" = $2`, [userId, date]);
      return { userId, date, value: null };
    }

    const value: FinalDay = {
      status: body.value.status,
      codes: Array.isArray(body.value.codes) ? body.value.codes.map(String) : [],
      workday: Number(body.value.workday),
    };
    const error = validateFinalDay(value);
    if (error) badRequest(error);
    if (value.status !== "work") value.codes = [];

    await query(
      `INSERT INTO "FinalTimesheetDay" ("userId", "date", "status", "codes", "workday", "editedBy", "editedAt")
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT ("userId", "date") DO UPDATE SET
         "status" = EXCLUDED."status", "codes" = EXCLUDED."codes", "workday" = EXCLUDED."workday",
         "editedBy" = EXCLUDED."editedBy", "editedAt" = now()`,
      [userId, date, value.status, value.codes, value.workday, admin.userId]
    );
    return { userId, date, value };
  }, "Final timesheet write error");
}
