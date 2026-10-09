import { query, queryOne } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { isValidDateKey } from "@/lib/datetime";
import { dayReviewNotice } from "@/lib/employee-notice";
import { notifyEmployee } from "@/lib/notify";

/// Admin xem lại một ngày làm thiếu giờ: "count" = vẫn tính đủ công,
/// "exclude" = không tính công, null = bỏ quyết định (quay về mặc định: chưa
/// xem thì vẫn tính đủ công khi chốt tháng).
export async function PUT(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "");
    const date = String(body?.date || "");
    const decision = body?.decision ?? null;

    if (!userId) badRequest("Thiếu nhân viên");
    if (!isValidDateKey(date)) badRequest("Ngày không hợp lệ");
    if (decision !== null && decision !== "count" && decision !== "exclude") {
      badRequest("Quyết định phải là tính công hoặc không tính");
    }

    const user = await queryOne<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "id" = $1`,
      [userId]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

    const previous = await queryOne<{ decision: string }>(
      `SELECT "decision" FROM "DayReview" WHERE "userId" = $1 AND "date" = $2`,
      [userId, date]
    );
    // Gửi sau khi đã ghi xong; quyết định y như cũ thì không báo lại.
    const notify = () => {
      if ((previous?.decision ?? null) !== decision) {
        notifyEmployee(userId, dayReviewNotice({ date, decision }));
      }
    };

    if (decision === null) {
      await query(`DELETE FROM "DayReview" WHERE "userId" = $1 AND "date" = $2`, [
        userId,
        date,
      ]);
      notify();
      return { userId, date, decision: null };
    }

    await query(
      `INSERT INTO "DayReview" ("userId", "date", "decision", "reviewedBy", "reviewedAt")
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT ("userId", "date") DO UPDATE SET
         "decision" = EXCLUDED."decision",
         "reviewedBy" = EXCLUDED."reviewedBy",
         "reviewedAt" = now()`,
      [userId, date, decision, admin.userId]
    );
    notify();
    return { userId, date, decision };
  }, "Day review error");
}
