import { isUniqueViolation, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import {
  buildOvertimeViews,
  OVERTIME_SELECT,
  OvertimeRow,
} from "@/lib/overtime-service";
import { formatOvertimeHours } from "@/lib/overtime";
import { overtimeNotice } from "@/lib/employee-notice";
import { notifyEmployee } from "@/lib/notify";

const ADMIN_NOTE_MAX = 500;

/// Admin xử lý phiếu OT:
///  - action "approve" / "reject": duyệt hoặc từ chối (kèm ghi chú);
///  - action "update": sửa số giờ chốt của phiếu đã duyệt.
/// `approvedHours` = số giờ admin chốt tay; null hoặc bỏ trống = tính theo
/// chấm công (hoặc giờ dự kiến nếu thiếu giờ vào/ra).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const adminNote = String(body?.adminNote ?? "").trim() || null;
    const rawHours = body?.approvedHours;

    if (!["approve", "reject", "update"].includes(action)) {
      badRequest("Thao tác không hợp lệ");
    }
    if (adminNote && adminNote.length > ADMIN_NOTE_MAX) {
      badRequest(`Ghi chú tối đa ${ADMIN_NOTE_MAX} ký tự`);
    }
    let approvedMinutes: number | null = null;
    if (rawHours !== undefined && rawHours !== null && rawHours !== "") {
      const hours = Number(rawHours);
      if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
        badRequest("Số giờ OT phải trong khoảng 0 – 24");
      }
      approvedMinutes = Math.round(hours * 60);
    }

    const current = await queryOne<{
      status: string;
      approvedMinutes: number | null;
      adminNote: string | null;
    }>(
      `SELECT "status", "approvedMinutes", "adminNote" FROM "OvertimeRequest" WHERE "id" = $1`,
      [id]
    );
    if (!current) notFound("Không tìm thấy phiếu OT");
    if (action === "update" && current!.status !== "approved") {
      badRequest("Chỉ sửa được số giờ của phiếu đã duyệt");
    }

    if (action === "reject") {
      await queryOne(
        `UPDATE "OvertimeRequest"
            SET "status" = 'rejected', "approvedMinutes" = NULL, "adminNote" = $2,
                "reviewedBy" = $3, "reviewedAt" = now(), "updatedAt" = now()
          WHERE "id" = $1 RETURNING "id"`,
        [id, adminNote, admin.userId]
      );
    } else {
      try {
        await queryOne(
          `UPDATE "OvertimeRequest"
              SET "status" = 'approved', "approvedMinutes" = $2,
                  "adminNote" = COALESCE($3, "adminNote"),
                  "reviewedBy" = $4, "reviewedAt" = now(), "updatedAt" = now()
            WHERE "id" = $1 RETURNING "id"`,
          [id, approvedMinutes, adminNote, admin.userId]
        );
      } catch (error) {
        // Duyệt lại phiếu đã từ chối trong khi nhân viên đã làm phiếu mới
        // cho cùng ngày: mỗi ngày chỉ một phiếu còn hiệu lực.
        if (isUniqueViolation(error)) {
          conflict("Ngày này đã có phiếu OT khác, xử lý phiếu đó thay vì phiếu cũ");
        }
        throw error;
      }
    }

    const row = await queryOne<OvertimeRow>(`${OVERTIME_SELECT} WHERE o."id" = $1`, [id]);
    const [request] = await buildOvertimeViews([row!]);
    // Sửa số giờ mà không đổi gì (bấm lưu lại) thì không báo nhân viên.
    const noop =
      action === "update" &&
      current!.approvedMinutes === request.approvedMinutes &&
      current!.adminNote === request.adminNote;
    if (!noop) {
      notifyEmployee(
        request.user.id,
        overtimeNotice({
          date: request.date,
          action: action as "approve" | "reject" | "update",
          plannedStart: request.plannedStart,
          plannedEnd: request.plannedEnd,
          hours: formatOvertimeHours(request.minutes),
          code: request.code,
          rate: request.rate,
          adminNote: request.adminNote,
        })
      );
    }
    return { request };
  }, "Admin overtime review error");
}
