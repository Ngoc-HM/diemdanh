import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import {
  formatTimeVN,
  getMonthRange,
  isValidDateKey,
  isValidMonth,
  monthKeyVN,
  weekdayLabel,
} from "@/lib/datetime";
import { entryDurationMinutes } from "@/lib/work-reports";
import { WorkReportEntryRow } from "@/lib/types";

type EntryWithUser = WorkReportEntryRow & {
  userName: string;
  userEmployeeCode: string | null;
  userDepartment: string | null;
};

/// Nội dung công việc của cả công ty trong một tháng, lọc thêm được theo nhân
/// viên và theo một ngày cụ thể. `export=csv` trả file cho bảng lương / báo cáo.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);

    const month = searchParams.get("month") ?? monthKeyVN();
    if (!isValidMonth(month)) badRequest("Tháng không hợp lệ");

    const date = searchParams.get("date") || null;
    if (date && !isValidDateKey(date)) badRequest("Ngày không hợp lệ");
    if (date && date.slice(0, 7) !== month) {
      badRequest("Ngày phải nằm trong tháng đang xem");
    }

    const userId = searchParams.get("userId") || null;
    const wantsCsv = searchParams.get("export") === "csv";
    const { startDate, endDate } = getMonthRange(month);

    const rows = await query<EntryWithUser>(
      `SELECT e."id", e."userId", e."date", e."startAt", e."endAt", e."content",
              e."createdAt", e."updatedAt",
              u."name" AS "userName",
              u."employeeCode" AS "userEmployeeCode",
              u."department" AS "userDepartment"
         FROM "WorkReportEntry" e
         JOIN "User" u ON u."id" = e."userId"
        WHERE e."date" BETWEEN $1 AND $2
          AND ($3::text IS NULL OR e."date" = $3)
          AND ($4::text IS NULL OR e."userId" = $4)
        ORDER BY e."date" DESC, u."name" ASC, e."startAt" ASC`,
      [startDate, endDate, date, userId]
    );

    const entries = rows.map((row) => ({
      id: row.id,
      date: row.date,
      weekday: weekdayLabel(row.date),
      start: formatTimeVN(row.startAt),
      end: formatTimeVN(row.endAt),
      minutes: entryDurationMinutes(row.startAt, row.endAt),
      content: row.content,
      user: {
        id: row.userId,
        name: row.userName,
        employeeCode: row.userEmployeeCode,
        department: row.userDepartment,
      },
    }));

    if (wantsCsv) {
      const header = [
        "Mã NV",
        "Nhân viên",
        "Bộ phận",
        "Ngày",
        "Thứ",
        "Bắt đầu",
        "Kết thúc",
        "Số phút",
        "Nội dung công việc",
      ];
      const csvRows = entries.map((entry) => [
        entry.user.employeeCode ?? "",
        entry.user.name,
        entry.user.department ?? "",
        entry.date,
        entry.weekday,
        entry.start,
        entry.end,
        entry.minutes,
        entry.content,
      ]);

      // BOM để Excel đọc đúng tiếng Việt, giống bảng chấm công tháng.
      const csv =
        "﻿" +
        [header, ...csvRows]
          .map((row) => row.map(escapeCsvCell).join(","))
          .join("\n") +
        "\n";

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="noi-dung-cong-viec-${date ?? month}.csv"`,
        },
      });
    }

    return {
      month,
      date,
      userId,
      entries,
      totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
    };
  }, "Admin work report list error");
}

function escapeCsvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
