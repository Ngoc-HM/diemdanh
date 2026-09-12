/// Luật của "Nội dung công việc hằng ngày". Để ở đây thay vì trong route vì
/// Next.js chỉ cho file route export đúng các HTTP handler — và vì toàn bộ
/// phần này là hàm thuần, test được ở `tests/logic.mjs` mà không cần database.
///
/// Một ngày làm việc là một CHUỖI LIỀN MẠCH các khoảng: `endAt` của khoảng
/// trước chính là `startAt` của khoảng sau, không có kẽ hở. Vì vậy mỗi mốc
/// thời gian là một "ranh giới" dùng chung của hai khoảng liền kề: sửa giờ kết
/// thúc của khoảng i cũng là dời giờ bắt đầu của khoảng i+1.
import { formatMinutes, formatTimeVN, parseTimeToMinutes } from "@/lib/datetime";
import { WorkReportEntryRow } from "@/lib/types";
import { TIME_PATTERN } from "@/lib/validation";

export const CONTENT_MIN_LENGTH = 3;
export const CONTENT_MAX_LENGTH = 1000;

/// Chặn trên cho số khoảng một ngày — đủ rộng cho người khai rất chi tiết,
/// vẫn chặn được kiểu bấm lưu liên tục làm phình bảng.
export const MAX_ENTRIES_PER_DAY = 50;

/// Đồng hồ máy nhân viên lệch vài chục giây so với server là chuyện thường,
/// nên "giờ hiện tại" được nới ra chừng này phút khi kiểm tra giờ tương lai.
export const CLOCK_SKEW_MINUTES = 1;

const MINUTES_PER_DAY = 24 * 60;

/// "08:25" -> 505. Sai định dạng thì trả null để phía gọi báo lỗi 400.
export function parseEntryTime(value: unknown): number | null {
  const text = String(value ?? "");
  if (!TIME_PATTERN.test(text)) return null;
  return parseTimeToMinutes(text);
}

export function validateContent(content: string): string | null {
  if (content.length < CONTENT_MIN_LENGTH) {
    return `Nội dung công việc cần ít nhất ${CONTENT_MIN_LENGTH} ký tự`;
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    return `Nội dung công việc tối đa ${CONTENT_MAX_LENGTH} ký tự`;
  }
  return null;
}

export type BoundaryInput = {
  /// Giờ bắt đầu của khoảng đang xét (phút trong ngày).
  startMinutes: number;
  /// Giờ kết thúc muốn đặt cho khoảng đang xét.
  endMinutes: number;
  /// Giờ kết thúc của khoảng KẾ TIẾP, null khi đây là khoảng cuối cùng.
  nextEndMinutes?: number | null;
  /// Giờ hiện tại theo giờ VN, phút trong ngày.
  nowMinutes: number;
};

/// Kiểm tra một khoảng có hợp lệ trong chuỗi hay không. Trả về thông báo lỗi
/// tiếng Việt, hoặc null nếu hợp lệ.
///
/// Khoảng kế tiếp luôn bắt đầu đúng lúc khoảng này kết thúc, nên kéo giờ kết
/// thúc quá xa sẽ nuốt trọn khoảng kế tiếp — đó là lúc phải từ chối và nói rõ
/// đụng vào đâu, thay vì âm thầm xoá việc nhân viên đã khai.
export function validateBoundary(input: BoundaryInput): string | null {
  const { startMinutes, endMinutes, nextEndMinutes = null, nowMinutes } = input;

  if (startMinutes < 0 || startMinutes >= MINUTES_PER_DAY) {
    return "Giờ bắt đầu không hợp lệ";
  }
  if (endMinutes <= startMinutes) {
    return `Giờ kết thúc phải sau giờ bắt đầu (${formatMinutes(startMinutes)})`;
  }
  if (endMinutes > nowMinutes + CLOCK_SKEW_MINUTES) {
    return "Chưa tới giờ đó — không khai được thời gian trong tương lai";
  }
  if (nextEndMinutes !== null && endMinutes >= nextEndMinutes) {
    return `Giờ kết thúc phải trước giờ kết thúc của khoảng kế tiếp (${formatMinutes(
      nextEndMinutes
    )})`;
  }
  return null;
}

export function entryDurationMinutes(startAt: Date, endAt: Date): number {
  return Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
}

/// 65 -> "1h05", 120 -> "2h", 45 -> "45 phút".
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} phút`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

/// Cột của "WorkReportEntry" dùng chung cho mọi route — route nhân viên và
/// route admin chỉ nối thêm WHERE/ORDER.
export const WORK_REPORT_COLUMNS = `
  "id", "userId", "date", "startAt", "endAt", "content", "createdAt", "updatedAt"
`;

/// Hình dạng một khoảng khi trả về cho giao diện. Giờ đã đổi sẵn sang chuỗi
/// "HH:MM" giờ VN để client không phải tự quy đổi múi giờ.
export type WorkReportEntryView = {
  id: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  content: string;
};

export function toEntryView(row: WorkReportEntryRow): WorkReportEntryView {
  return {
    id: row.id,
    date: row.date,
    start: formatTimeVN(row.startAt),
    end: formatTimeVN(row.endAt),
    minutes: entryDurationMinutes(row.startAt, row.endAt),
    content: row.content,
  };
}
