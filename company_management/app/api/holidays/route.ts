import { query, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, requireAdmin } from "@/lib/auth-guard";
import { isValidDateKey, listDateRange } from "@/lib/datetime";
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
              WHERE "startDate" <= $2 AND "endDate" >= $1
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

    const overlapping = await queryOne(
      `SELECT 1 FROM "Holiday" WHERE "startDate" <= $2 AND "endDate" >= $1 LIMIT 1`,
      [startDate, endDate]
    );
    if (overlapping) conflict("Khoảng ngày này trùng với một đợt nghỉ đã có");

    const holiday = await queryOne<HolidayRow>(
      `INSERT INTO "Holiday" ("date", "startDate", "endDate", "name")
       VALUES ($1, $1, $2, $3) RETURNING *`,
      [startDate, endDate, name]
    );
    return { holiday, days: days.length };
  }, "Holiday create error");
}
