import { query, queryOne, transaction } from "@/lib/db";
import { badRequest, handle, notFound, requireEmployee } from "@/lib/auth-guard";
import {
  dateKeyVN,
  formatMinutes,
  minutesOfDayVN,
  vnDateTimeToUtc,
} from "@/lib/datetime";
import {
  parseEntryTime,
  toEntryView,
  validateBoundary,
  validateContent,
  WORK_REPORT_COLUMNS,
} from "@/lib/work-reports";
import { WorkReportEntryRow } from "@/lib/types";

/// Khoảng công việc của chính nhân viên, kèm hai khoảng liền kề. Khoảng của
/// người khác trả về null để route trả 404 như không tồn tại.
async function loadEntry(userId: string, id: string) {
  const entry = await queryOne<WorkReportEntryRow>(
    `SELECT ${WORK_REPORT_COLUMNS} FROM "WorkReportEntry"
      WHERE "id" = $1 AND "userId" = $2`,
    [id, userId]
  );
  if (!entry) return null;

  const [previous, next] = await Promise.all([
    queryOne<WorkReportEntryRow>(
      `SELECT ${WORK_REPORT_COLUMNS} FROM "WorkReportEntry"
        WHERE "userId" = $1 AND "date" = $2 AND "startAt" < $3
        ORDER BY "startAt" DESC LIMIT 1`,
      [userId, entry.date, entry.startAt]
    ),
    queryOne<WorkReportEntryRow>(
      `SELECT ${WORK_REPORT_COLUMNS} FROM "WorkReportEntry"
        WHERE "userId" = $1 AND "date" = $2 AND "startAt" > $3
        ORDER BY "startAt" ASC LIMIT 1`,
      [userId, entry.date, entry.startAt]
    ),
  ]);

  return { entry, previous, next };
}

async function listDay(userId: string, date: string) {
  const rows = await query<WorkReportEntryRow>(
    `SELECT ${WORK_REPORT_COLUMNS} FROM "WorkReportEntry"
      WHERE "userId" = $1 AND "date" = $2 ORDER BY "startAt" ASC`,
    [userId, date]
  );
  return rows.map(toEntryView);
}

/// Sửa một khoảng của ngày hôm nay: nội dung, giờ kết thúc, và giờ bắt đầu
/// (chỉ với khoảng đầu tiên trong ngày — các khoảng sau luôn bắt đầu đúng lúc
/// khoảng trước kết thúc).
///
/// Dời giờ kết thúc cũng là dời giờ bắt đầu của khoảng kế tiếp, nên khoảng kế
/// tiếp được cập nhật trong cùng một transaction. Nếu giờ mới nuốt trọn khoảng
/// kế tiếp thì từ chối và nói rõ, thay vì âm thầm xoá việc đã khai.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const session = await requireEmployee();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const loaded = await loadEntry(session.userId, id);
    if (!loaded) notFound("Không tìm thấy khoảng công việc");
    const { entry, previous, next } = loaded!;

    if (entry.date !== dateKeyVN()) {
      badRequest("Chỉ sửa được nội dung công việc của ngày hôm nay");
    }

    let content = entry.content;
    if (body?.content !== undefined) {
      content = String(body.content ?? "").trim();
      const contentError = validateContent(content);
      if (contentError) badRequest(contentError);
    }

    let startMinutes = minutesOfDayVN(entry.startAt);
    if (body?.startTime !== undefined) {
      if (previous) {
        badRequest(
          "Giờ bắt đầu của khoảng này luôn bằng giờ kết thúc của khoảng trước"
        );
      }
      const parsed = parseEntryTime(body.startTime);
      if (parsed === null) badRequest("Giờ bắt đầu không hợp lệ, cần dạng HH:MM");
      startMinutes = parsed!;
    }

    let endMinutes = minutesOfDayVN(entry.endAt);
    if (body?.endTime !== undefined) {
      const parsed = parseEntryTime(body.endTime);
      if (parsed === null) badRequest("Giờ kết thúc không hợp lệ, cần dạng HH:MM");
      endMinutes = parsed!;
    }

    const error = validateBoundary({
      startMinutes,
      endMinutes,
      nextEndMinutes: next ? minutesOfDayVN(next.endAt) : null,
      nowMinutes: minutesOfDayVN(new Date()),
    });
    if (error) badRequest(error);

    const startAt = vnDateTimeToUtc(entry.date, formatMinutes(startMinutes));
    const endAt = vnDateTimeToUtc(entry.date, formatMinutes(endMinutes));

    await transaction(async (client) => {
      await client.query(
        `UPDATE "WorkReportEntry"
            SET "startAt" = $2, "endAt" = $3, "content" = $4, "updatedAt" = now()
          WHERE "id" = $1`,
        [entry.id, startAt, endAt, content]
      );
      // Chuỗi phải liền mạch: khoảng kế tiếp bắt đầu đúng lúc khoảng này kết thúc.
      if (next && next.startAt.getTime() !== endAt.getTime()) {
        await client.query(
          `UPDATE "WorkReportEntry"
              SET "startAt" = $2, "updatedAt" = now()
            WHERE "id" = $1`,
          [next.id, endAt]
        );
      }
    });

    return {
      date: entry.date,
      entries: await listDay(session.userId, entry.date),
    };
  }, "Work report update error");
}

/// Xoá một khoảng của ngày hôm nay. Xoá khoảng ở giữa thì khoảng kế tiếp hút
/// phần thời gian đó (bắt đầu sớm lên), để ngày vẫn là một chuỗi liền mạch.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const session = await requireEmployee();
    const { id } = await params;

    const loaded = await loadEntry(session.userId, id);
    if (!loaded) notFound("Không tìm thấy khoảng công việc");
    const { entry, next } = loaded!;

    if (entry.date !== dateKeyVN()) {
      badRequest("Chỉ xoá được nội dung công việc của ngày hôm nay");
    }

    await transaction(async (client) => {
      // Xoá trước rồi mới dời khoảng kế tiếp: hai dòng không được trùng
      // ("userId", "date", "startAt").
      await client.query(`DELETE FROM "WorkReportEntry" WHERE "id" = $1`, [
        entry.id,
      ]);
      if (next) {
        await client.query(
          `UPDATE "WorkReportEntry"
              SET "startAt" = $2, "updatedAt" = now()
            WHERE "id" = $1`,
          [next.id, entry.startAt]
        );
      }
    });

    return {
      date: entry.date,
      entries: await listDay(session.userId, entry.date),
    };
  }, "Work report delete error");
}
