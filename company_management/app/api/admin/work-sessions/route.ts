import { execute, query, queryOne, transaction } from "@/lib/db";
import { badRequest, conflict, handle, requireAdmin } from "@/lib/auth-guard";
import {
  DEFAULT_WORK_SESSIONS,
  normalizeSession,
  validateSession,
} from "@/lib/validation";
import { WorkSessionRow } from "@/lib/types";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const sessions = await query<WorkSessionRow>(
      `SELECT * FROM "WorkSession" ORDER BY "sortOrder" ASC`
    );
    return { sessions };
  }, "Work session list error");
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Body rỗng = yêu cầu tạo bộ ca mặc định cho lần cấu hình đầu tiên.
    if (Object.keys(body).length === 0) {
      const counted = await queryOne<{ n: number }>(
        `SELECT count(*)::int AS n FROM "WorkSession"`
      );
      if ((counted?.n ?? 0) > 0) badRequest("Đã có danh mục ca làm việc");

      for (const preset of DEFAULT_WORK_SESSIONS) {
        await execute(
          `INSERT INTO "WorkSession"
             ("code", "name", "workStart", "workEnd",
              "minHours", "workdayValue", "sortOrder", "isDefaultFull")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            preset.code,
            preset.name,
            preset.workStart,
            preset.workEnd,
            preset.minHours,
            preset.workdayValue,
            preset.sortOrder,
            preset.isDefaultFull,
          ]
        );
      }

      const sessions = await query<WorkSessionRow>(
        `SELECT * FROM "WorkSession" ORDER BY "sortOrder" ASC`
      );
      return { sessions };
    }

    const session = normalizeSession(body);
    const validationError = validateSession(session);
    if (validationError) badRequest(validationError);

    const existing = await queryOne(
      `SELECT 1 FROM "WorkSession" WHERE "code" = $1`,
      [session.code]
    );
    if (existing) conflict("Mã ca đã tồn tại");

    const created = await transaction(async (client) => {
      // Chỉ một ca được là mặc định cho full-time.
      if (session.isDefaultFull) {
        await client.query(`UPDATE "WorkSession" SET "isDefaultFull" = false`);
      }
      const result = await client.query<WorkSessionRow>(
        `INSERT INTO "WorkSession"
           ("code", "name", "workStart", "workEnd",
            "minHours", "workdayValue", "sortOrder", "isActive", "isDefaultFull")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          session.code,
          session.name,
          session.workStart,
          session.workEnd,
          session.minHours,
          session.workdayValue,
          session.sortOrder,
          session.isActive,
          session.isDefaultFull,
        ]
      );
      return result.rows[0];
    });

    return { session: created };
  }, "Work session create error");
}
