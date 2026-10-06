import { isUniqueViolation, query, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, requireEmployee } from "@/lib/auth-guard";
import { getMonthRange, isValidDateKey, isValidMonth, monthKeyVN } from "@/lib/datetime";
import {
  OVERTIME_CONTENT_MAX,
  OVERTIME_CONTENT_MIN,
  OVERTIME_PLACE_MAX,
  validatePlannedTimes,
} from "@/lib/overtime";
import {
  buildOvertimeViews,
  OVERTIME_SELECT,
  OvertimeRow,
} from "@/lib/overtime-service";

/// Phiếu OT của chính nhân viên trong một tháng, mới nhất lên đầu.
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const { searchParams } = new URL(req.url);
    const requested = searchParams.get("month");
    if (requested && !isValidMonth(requested)) badRequest("Tháng không hợp lệ");
    const month = requested || monthKeyVN();
    const { startDate, endDate } = getMonthRange(month);

    const rows = await query<OvertimeRow>(
      `${OVERTIME_SELECT}
        WHERE o."userId" = $1 AND o."date" BETWEEN $2 AND $3
        ORDER BY o."date" DESC, o."createdAt" DESC`,
      [session.userId, startDate, endDate]
    );
    return { month, requests: await buildOvertimeViews(rows) };
  }, "Overtime list error");
}

/// Nhân viên làm phiếu OT cho một ngày. Ngày đó đã có phiếu đang chờ thì ghi
/// đè nội dung; đã có phiếu được duyệt thì không cho làm phiếu thứ hai.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const body = await req.json().catch(() => ({}));
    const date = String(body?.date || "");
    const plannedStart = String(body?.plannedStart || "").trim();
    const plannedEnd = String(body?.plannedEnd || "").trim();
    const place = String(body?.place ?? "").trim() || null;
    const content = String(body?.content ?? "").trim();

    if (!isValidDateKey(date)) badRequest("Ngày không hợp lệ");
    const timeError = validatePlannedTimes(plannedStart, plannedEnd);
    if (timeError) badRequest(timeError);
    if (place && place.length > OVERTIME_PLACE_MAX) {
      badRequest(`Nơi đi / đến tối đa ${OVERTIME_PLACE_MAX} ký tự`);
    }
    if (content.length < OVERTIME_CONTENT_MIN || content.length > OVERTIME_CONTENT_MAX) {
      badRequest(
        `Nội dung công việc cần từ ${OVERTIME_CONTENT_MIN} đến ${OVERTIME_CONTENT_MAX} ký tự`
      );
    }

    const existing = await queryOne<{ id: string; status: string }>(
      `SELECT "id", "status" FROM "OvertimeRequest"
        WHERE "userId" = $1 AND "date" = $2 AND "status" <> 'rejected'`,
      [session.userId, date]
    );
    if (existing?.status === "approved") {
      conflict("Ngày này đã có phiếu OT được duyệt");
    }

    let id: string;
    try {
      const saved = existing
        ? await queryOne<{ id: string }>(
            `UPDATE "OvertimeRequest"
                SET "plannedStart" = $2, "plannedEnd" = $3, "place" = $4,
                    "content" = $5, "updatedAt" = now()
              WHERE "id" = $1 AND "status" = 'pending'
              RETURNING "id"`,
            [existing.id, plannedStart, plannedEnd, place, content]
          )
        : await queryOne<{ id: string }>(
            `INSERT INTO "OvertimeRequest"
               ("userId", "date", "plannedStart", "plannedEnd", "place", "content")
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING "id"`,
            [session.userId, date, plannedStart, plannedEnd, place, content]
          );
      // Phiếu vừa được duyệt giữa lúc đọc và lúc ghi.
      if (!saved) conflict("Ngày này đã có phiếu OT được duyệt");
      id = saved!.id;
    } catch (error) {
      // Bấm gửi hai lần cùng lúc: lần sau đụng chỉ mục một phiếu mỗi ngày.
      if (isUniqueViolation(error)) conflict("Ngày này đã có phiếu OT");
      throw error;
    }

    const row = await queryOne<OvertimeRow>(`${OVERTIME_SELECT} WHERE o."id" = $1`, [id]);
    const [request] = await buildOvertimeViews([row!]);
    return { request };
  }, "Overtime create error");
}
