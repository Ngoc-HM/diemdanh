import { query, queryOne } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { isValidDateKey } from "@/lib/datetime";
import { getActiveSessionRules } from "@/lib/attendance-service";

/// Admin chấm lại một ô ngày của một nhân viên trong bảng chấm công:
/// đổi ca (S / C / CN / T), đánh dấu nghỉ N, ốm O, hoặc xoá để trả về lịch gốc.
/// Ô đã sửa mang cờ `isAdminEdit` để cả admin lẫn nhân viên nhìn thấy.
export async function PUT(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "");
    const date = String(body?.date || "");
    const leaveCode = body?.leaveCode ?? null;
    const rawSessionIds = body?.sessionIds ?? null;

    if (!userId) badRequest("Thiếu nhân viên");
    if (!isValidDateKey(date)) badRequest("Ngày không hợp lệ");
    if (leaveCode !== null && leaveCode !== "N" && leaveCode !== "O") {
      badRequest("Mã nghỉ phải là N hoặc O");
    }
    if (rawSessionIds !== null && !Array.isArray(rawSessionIds)) {
      badRequest("Danh sách ca không hợp lệ");
    }
    if (leaveCode && rawSessionIds && rawSessionIds.length > 0) {
      badRequest("Ngày nghỉ thì không gán ca làm việc");
    }

    const user = await queryOne<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "id" = $1`,
      [userId]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

    const sessionIds: string[] | null = Array.isArray(rawSessionIds)
      ? [...new Set(rawSessionIds.map((id: unknown) => String(id)))]
      : null;

    if (sessionIds && sessionIds.length > 0) {
      const rules = await getActiveSessionRules();
      const activeIds = new Set(rules.map((rule) => rule.id));
      for (const id of sessionIds) {
        if (!activeIds.has(id)) badRequest("Ca làm việc không tồn tại");
      }
    }

    // Không chọn gì cả = xoá đánh dấu, ngày trở về lịch nhân viên đã đăng ký.
    if (!leaveCode && (!sessionIds || sessionIds.length === 0)) {
      await query(`DELETE FROM "DayMark" WHERE "userId" = $1 AND "date" = $2`, [
        userId,
        date,
      ]);
      return { userId, date, cleared: true };
    }

    await query(
      `INSERT INTO "DayMark"
         ("userId", "date", "leaveCode", "sessionIds", "isAdminEdit",
          "editedBy", "editedAt")
       VALUES ($1, $2, $3, $4, true, $5, now())
       ON CONFLICT ("userId", "date")
       DO UPDATE SET "leaveCode" = $3, "sessionIds" = $4, "isAdminEdit" = true,
                     "editedBy" = $5, "editedAt" = now(), "updatedAt" = now()`,
      [userId, date, leaveCode, sessionIds, admin.userId]
    );

    return { userId, date, leaveCode, sessionIds, cleared: false };
  }, "Day mark error");
}
