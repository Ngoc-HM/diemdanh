import { query, queryOne } from "@/lib/db";
import { badRequest, handle, requireEmployee } from "@/lib/auth-guard";
import {
  getMonthRange,
  isValidDateKey,
  isValidMonth,
  monthKeyVN,
} from "@/lib/datetime";
import { getActiveSessionRules } from "@/lib/attendance-service";
import {
  buildEmployeeRequestViews,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  REQUEST_SELECT,
  RequestWithUserRow,
} from "@/lib/shift-requests";

/// Yêu cầu đổi ca / xin nghỉ của chính nhân viên trong một tháng, mọi trạng
/// thái, mới gửi nhất lên đầu.
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const { searchParams } = new URL(req.url);
    const requestedMonth = searchParams.get("month");
    if (requestedMonth && !isValidMonth(requestedMonth)) {
      badRequest("Tháng không hợp lệ");
    }
    const month = requestedMonth || monthKeyVN();
    const { startDate, endDate } = getMonthRange(month);

    const rows = await query<RequestWithUserRow>(
      `${REQUEST_SELECT}
        WHERE r."userId" = $1 AND r."date" BETWEEN $2 AND $3
        ORDER BY r."createdAt" DESC, r."id" ASC`,
      [session.userId, startDate, endDate]
    );

    return { month, requests: await buildEmployeeRequestViews(rows) };
  }, "Shift request list error");
}

/// Nhân viên gửi yêu cầu cho một ngày: hoặc xin nghỉ N, hoặc đổi sang bộ ca
/// mới. Mỗi ngày chỉ có một yêu cầu đang chờ; gửi lại thì ghi đè yêu cầu đó.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const body = await req.json().catch(() => ({}));
    const date = String(body?.date || "");
    const reason = String(body?.reason ?? "").trim();
    // Chuỗi rỗng coi như không xin nghỉ, để form gửi leaveCode: "" không bị 400.
    const leaveCode = body?.leaveCode || null;
    const rawSessionIds = body?.sessionIds ?? null;

    if (!isValidDateKey(date)) badRequest("Ngày không hợp lệ");
    if (reason.length < REASON_MIN_LENGTH || reason.length > REASON_MAX_LENGTH) {
      badRequest(`Lý do cần từ ${REASON_MIN_LENGTH} đến ${REASON_MAX_LENGTH} ký tự`);
    }
    if (leaveCode !== null && leaveCode !== "N") badRequest("Mã nghỉ chỉ nhận N");
    if (rawSessionIds !== null && !Array.isArray(rawSessionIds)) {
      badRequest("Danh sách ca không hợp lệ");
    }

    const sessionIds: string[] = Array.isArray(rawSessionIds)
      ? [...new Set(rawSessionIds.map((id: unknown) => String(id)))]
      : [];

    // Một yêu cầu chỉ nói một điều: hoặc nghỉ, hoặc đổi ca. Có cả hai thì admin
    // không biết duyệt cái nào; không có gì thì không có gì để duyệt.
    if (leaveCode && sessionIds.length > 0) {
      badRequest("Xin nghỉ thì không chọn ca làm việc");
    }
    if (!leaveCode && sessionIds.length === 0) {
      badRequest("Hãy chọn ca muốn đổi sang hoặc xin nghỉ");
    }

    if (!leaveCode) {
      const activeIds = new Set(
        (await getActiveSessionRules()).map((rule) => rule.id)
      );
      if (sessionIds.some((id) => !activeIds.has(id))) {
        badRequest("Ca làm việc không tồn tại hoặc đã ngừng dùng");
      }
    }

    // Unique partial index trên (userId, date) WHERE status = 'pending' cho
    // phép upsert ngay trong một câu: đã có yêu cầu đang chờ thì ghi đè nội
    // dung và giữ nguyên id, để admin đang mở danh sách không bị lạc dòng.
    const saved = await queryOne<{ id: string }>(
      `INSERT INTO "ShiftChangeRequest"
         ("userId", "date", "leaveCode", "sessionIds", "reason")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("userId", "date") WHERE "status" = 'pending'
       DO UPDATE SET "leaveCode" = $3, "sessionIds" = $4, "reason" = $5,
                     "updatedAt" = now()
       RETURNING "id"`,
      [session.userId, date, leaveCode, leaveCode ? null : sessionIds, reason]
    );

    const row = await queryOne<RequestWithUserRow>(
      `${REQUEST_SELECT} WHERE r."id" = $1`,
      [saved!.id]
    );
    const [request] = await buildEmployeeRequestViews([row!]);
    return { request };
  }, "Shift request create error");
}
