/// Bảng công chốt: ô admin chấm tay đè lên ô máy chấm. Ô không sửa thì lấy
/// theo máy (vẫn là số chính thức), ô đã sửa thì theo admin — dùng cho file
/// Excel gửi kế toán và bảng lương. Phần thuần logic ở lib/final-rules.ts.
import { query } from "@/lib/db";
import type { FinalDay, FinalStatus } from "@/lib/final-rules";

export * from "@/lib/final-rules";

export async function getFinalDays(
  userIds: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, FinalDay>> {
  if (userIds.length === 0) return new Map();
  const rows = await query<{ userId: string; date: string; status: FinalStatus; codes: string[]; workday: string }>(
    `SELECT "userId", "date", "status", "codes", "workday" FROM "FinalTimesheetDay"
      WHERE "userId" = ANY($1::text[]) AND "date" BETWEEN $2 AND $3`,
    [userIds, startDate, endDate]
  );
  return new Map(
    rows.map((row) => [
      `${row.userId}|${row.date}`,
      { status: row.status, codes: row.codes ?? [], workday: Number(row.workday) },
    ])
  );
}
