import { query, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, requireAdmin } from "@/lib/auth-guard";
import { isValidDateKey } from "@/lib/datetime";
import { HolidayRow } from "@/lib/types";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    const holidays =
      year && /^\d{4}$/.test(year)
        ? await query<HolidayRow>(
            `SELECT * FROM "Holiday" WHERE "date" BETWEEN $1 AND $2 ORDER BY "date" ASC`,
            [`${year}-01-01`, `${year}-12-31`]
          )
        : await query<HolidayRow>(`SELECT * FROM "Holiday" ORDER BY "date" ASC`);

    return { holidays };
  }, "Holiday list error");
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const date = String(body?.date || "");
    const name = String(body?.name || "").trim();

    if (!isValidDateKey(date)) badRequest("Ngày không hợp lệ");
    if (!name) badRequest("Vui lòng nhập tên ngày lễ");

    const existing = await queryOne(`SELECT 1 FROM "Holiday" WHERE "date" = $1`, [
      date,
    ]);
    if (existing) conflict("Ngày này đã có trong danh sách");

    const holiday = await queryOne<HolidayRow>(
      `INSERT INTO "Holiday" ("date", "name") VALUES ($1, $2) RETURNING *`,
      [date, name]
    );
    return { holiday };
  }, "Holiday create error");
}
