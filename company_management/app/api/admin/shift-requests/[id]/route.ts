import { execute, queryOne, transaction } from "@/lib/db";
import {
  badRequest,
  conflict,
  handle,
  notFound,
  requireAdmin,
} from "@/lib/auth-guard";
import { getAllSessionRules } from "@/lib/attendance-service";
import {
  ADMIN_NOTE_MAX_LENGTH,
  buildAdminRequestViews,
  REQUEST_SELECT,
  RequestWithUserRow,
} from "@/lib/shift-requests";
import { ShiftChangeRequestRow } from "@/lib/types";
import { shiftRequestNotice } from "@/lib/employee-notice";
import { notifyEmployee } from "@/lib/notify";

/// Admin duyệt hoặc từ chối một yêu cầu đang chờ.
/// Duyệt = ghi một DayMark y như admin tự chấm lại ô đó (isAdminEdit = true),
/// nên lịch và bảng công đổi theo ngay. Từ chối thì lịch giữ nguyên.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action !== "approve" && action !== "reject") {
      badRequest("Hành động phải là approve hoặc reject");
    }
    const rawNote = body?.note == null ? "" : String(body.note).trim();
    if (rawNote.length > ADMIN_NOTE_MAX_LENGTH) {
      badRequest(`Ghi chú tối đa ${ADMIN_NOTE_MAX_LENGTH} ký tự`);
    }
    const note = rawNote || null;

    const request = await queryOne<ShiftChangeRequestRow>(
      `SELECT * FROM "ShiftChangeRequest" WHERE "id" = $1`,
      [id]
    );
    if (!request) notFound("Không tìm thấy yêu cầu");
    if (request!.status !== "pending") conflict("Yêu cầu này đã được xử lý rồi");

    // Điều kiện "status = 'pending'" trong UPDATE là chốt chặn cuối: hai admin
    // bấm cùng lúc thì người sau không ghi đè được kết quả của người trước.
    const reviewSql = `
      UPDATE "ShiftChangeRequest"
         SET "status" = $2, "reviewedBy" = $3, "reviewedAt" = now(),
             "adminNote" = $4, "updatedAt" = now()
       WHERE "id" = $1 AND "status" = 'pending'`;

    if (action === "approve") {
      // Ca đã bị xoá khỏi danh mục thì bỏ qua; ca chỉ bị tắt vẫn ghi được vì
      // DayMark tra mã từ toàn bộ danh mục. Lọc xong không còn ca nào thì
      // không có gì để duyệt.
      let sessionIds: string[] | null = null;
      if (!request!.leaveCode) {
        const knownIds = new Set(
          (await getAllSessionRules()).map((rule) => rule.id)
        );
        sessionIds = (request!.sessionIds ?? []).filter((sessionId) =>
          knownIds.has(sessionId)
        );
        if (sessionIds.length === 0) {
          badRequest("Các ca trong yêu cầu đã bị xoá khỏi danh mục, không duyệt được");
        }
      }

      await transaction(async (client) => {
        await client.query(
          `INSERT INTO "DayMark"
             ("userId", "date", "leaveCode", "sessionIds", "isAdminEdit",
              "editedBy", "editedAt")
           VALUES ($1, $2, $3, $4, true, $5, now())
           ON CONFLICT ("userId", "date")
           DO UPDATE SET "leaveCode" = $3, "sessionIds" = $4, "isAdminEdit" = true,
                         "editedBy" = $5, "editedAt" = now(), "updatedAt" = now()`,
          [request!.userId, request!.date, request!.leaveCode, sessionIds, admin.userId]
        );
        const reviewed = await client.query(reviewSql, [
          id,
          "approved",
          admin.userId,
          note,
        ]);
        // Ném lỗi trong transaction để DayMark vừa ghi được rollback theo.
        if (reviewed.rowCount === 0) conflict("Yêu cầu vừa được người khác xử lý");
      });
    } else {
      const changed = await execute(reviewSql, [id, "rejected", admin.userId, note]);
      if (changed === 0) conflict("Yêu cầu vừa được người khác xử lý");
    }

    const row = await queryOne<RequestWithUserRow>(
      `${REQUEST_SELECT} WHERE r."id" = $1`,
      [id]
    );
    const [view] = await buildAdminRequestViews([row!]);
    notifyEmployee(
      request!.userId,
      shiftRequestNotice({
        date: view.date,
        approved: action === "approve",
        requestedCodes: view.requestedCodes,
        adminNote: view.adminNote,
      })
    );
    return { request: view };
  }, "Shift request review error");
}
