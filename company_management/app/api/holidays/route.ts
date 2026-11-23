import { query, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, requireAdmin } from "@/lib/auth-guard";
import { isValidDateKey, listDateRange } from "@/lib/datetime";
import { getWeeklyOffDays } from "@/lib/attendance-service";
import { isOffDate } from "@/lib/schedule";
import { HolidayRow } from "@/lib/types";

/// Độ dài tối đa của một đợt nghỉ — chặn nhầm tay nhập cả năm.
const MAX_RANGE_DAYS = 62;

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    const holidays =
      year && /^\d{4}$/.test(year)
        ? await query<HolidayRow>(
            `SELECT * FROM "Holiday"
              WHERE ("startDate" <= $2 AND "endDate" >= $1)
                 OR "swapOffDate" BETWEEN $1 AND $2
                 OR "swapWorkDate" BETWEEN $1 AND $2
              ORDER BY "startDate" ASC`,
            [`${year}-01-01`, `${year}-12-31`]
          )
        : await query<HolidayRow>(
            `SELECT * FROM "Holiday" ORDER BY "startDate" ASC`
          );

    return { holidays };
  }, "Holiday list error");
}

/// Thêm một đợt nghỉ lễ. Nhận `date` (một ngày) hoặc `startDate` + `endDate`
/// (khoảng nghỉ, vd Tết). Mọi ngày trong khoảng đều không bị tính vắng.
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const startDate = String(body?.startDate || body?.date || "");
    const endDate = String(body?.endDate || body?.date || startDate);

    if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) {
      badRequest("Ngày không hợp lệ");
    }
    if (endDate < startDate) badRequest("Ngày kết thúc phải sau ngày bắt đầu");
    if (!name) badRequest("Vui lòng nhập tên ngày lễ");

    const days = listDateRange(startDate, endDate);
    if (days.length > MAX_RANGE_DAYS) {
      badRequest(`Một đợt nghỉ tối đa ${MAX_RANGE_DAYS} ngày`);
    }

    // Hoán đổi (tuỳ chọn): nghỉ bù một ngày vốn đi làm, làm bù một ngày vốn
    // nghỉ tuần. Phải khai đủ cả hai ngày.
    const swapOffDate = String(body?.swapOffDate || "") || null;
    const swapWorkDate = String(body?.swapWorkDate || "") || null;
    if (swapOffDate || swapWorkDate) {
      if (!swapOffDate || !swapWorkDate) {
        badRequest("Hoán đổi cần chọn đủ ngày được nghỉ và ngày làm bù");
      }
      if (!isValidDateKey(swapOffDate!) || !isValidDateKey(swapWorkDate!)) {
        badRequest("Ngày hoán đổi không hợp lệ");
      }
      const weeklyOffDays = await getWeeklyOffDays();
      if (isOffDate(swapOffDate!, weeklyOffDays)) {
        badRequest("Ngày được nghỉ (hoán đổi) phải là ngày làm việc bình thường");
      }
      if (!isOffDate(swapWorkDate!, weeklyOffDays)) {
        badRequest("Ngày làm bù phải là ngày nghỉ hằng tuần (vd Thứ 7)");
      }
      for (const date of [swapOffDate!, swapWorkDate!]) {
        if (date >= startDate && date <= endDate) {
          badRequest("Ngày hoán đổi không được nằm trong đợt lễ");
        }
      }
      const clash = await queryOne(
        `SELECT 1 FROM "Holiday"
          WHERE ("startDate" <= $1 AND "endDate" >= $1)
             OR ("startDate" <= $2 AND "endDate" >= $2)
             OR "swapOffDate" IN ($1, $2) OR "swapWorkDate" IN ($1, $2)
          LIMIT 1`,
        [swapOffDate, swapWorkDate]
      );
      if (clash) conflict("Ngày hoán đổi trùng với một ngày lễ hoặc hoán đổi đã có");
    }

    const overlapping = await queryOne(
      `SELECT 1 FROM "Holiday" WHERE "startDate" <= $2 AND "endDate" >= $1 LIMIT 1`,
      [startDate, endDate]
    );
    if (overlapping) conflict("Khoảng ngày này trùng với một đợt nghỉ đã có");

    const holiday = await queryOne<HolidayRow>(
      `INSERT INTO "Holiday" ("date", "startDate", "endDate", "name", "swapOffDate", "swapWorkDate")
       VALUES ($1, $1, $2, $3, $4, $5) RETURNING *`,
      [startDate, endDate, name, swapOffDate, swapWorkDate]
    );
    return { holiday, days: days.length };
  }, "Holiday create error");
}
