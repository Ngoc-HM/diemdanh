/// Nội dung email báo cho nhân viên khi admin sửa công hoặc xử lý yêu cầu
/// của họ. Thuần logic (không đụng database) để test được; gửi ở lib/notify.ts.
import { weekdayLabel } from "@/lib/datetime";

export type Notice = {
  subject: string;
  /// Các đoạn nội dung, mỗi phần tử một dòng (chuỗi rỗng = dòng trống).
  lines: string[];
  /// Mục trong menu của web để nhân viên tự vào xem lại, vd "Lịch sử chấm
  /// công". Chỉ là chữ: email không chứa đường link nào.
  where: string;
};

export type NoticePunch = { type: string; time: string };

/// "2026-10-08" → "08/10/2026 (T5)"
export function formatDateWithWeekday(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year} (${weekdayLabel(dateKey)})`;
}

function shortDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

/// "Vào 08:00 · Ra 12:00 · Ra 17:30"
export function describePunches(punches: NoticePunch[]): string {
  if (punches.length === 0) return "không có giờ chấm công";
  return [...punches]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((punch) => `${punch.type === "in" ? "Vào" : "Ra"} ${punch.time}`)
    .join(" · ");
}

function noteLines(note: string | null | undefined): string[] {
  return note ? ["", `Ghi chú của quản trị viên: ${note}`] : [];
}

/// Admin sửa / bổ sung giờ vào ra một ngày (kể cả chấm lại ngày quên checkout).
export function attendanceEditNotice(input: {
  date: string;
  before: NoticePunch[];
  after: NoticePunch[];
  note: string | null;
}): Notice {
  return {
    subject: `Giờ chấm công ngày ${shortDate(input.date)} đã được điều chỉnh`,
    lines: [
      `Quản trị viên đã điều chỉnh giờ chấm công ngày ${formatDateWithWeekday(input.date)}.`,
      "",
      `Trước: ${describePunches(input.before)}`,
      `Sau: ${describePunches(input.after)}`,
      ...noteLines(input.note),
    ],
    where: "Lịch sử chấm công",
  };
}

/// Admin chấm lại ô ngày trong bảng chấm công: đổi ca, nghỉ, ốm, hoặc xoá
/// đánh dấu. `sessions` là các ca mới (đã xếp theo thứ tự).
export function dayMarkNotice(input: {
  date: string;
  leaveCode: "N" | "O" | null;
  sessions: { code: string; name: string }[];
}): Notice {
  const day = formatDateWithWeekday(input.date);
  let change: string;
  if (input.leaveCode === "N") change = `Ngày ${day} được ghi là Nghỉ (N).`;
  else if (input.leaveCode === "O") change = `Ngày ${day} được ghi là Ốm (O).`;
  else if (input.sessions.length > 0) {
    const list = input.sessions.map((rule) => `${rule.name} (${rule.code})`).join(" + ");
    change = `Ngày ${day} được xếp ca: ${list}.`;
  } else {
    change = `Đã bỏ đánh dấu của ngày ${day}; ngày này trở về theo lịch bạn đã đăng ký.`;
  }
  return {
    subject: `Bảng chấm công ngày ${shortDate(input.date)} đã được điều chỉnh`,
    lines: ["Quản trị viên đã chấm lại bảng công của bạn.", "", change],
    where: "Lịch sử chấm công",
  };
}

/// Admin quyết định ngày làm thiếu giờ có tính công hay không.
export function dayReviewNotice(input: {
  date: string;
  decision: "count" | "exclude" | null;
}): Notice {
  const day = formatDateWithWeekday(input.date);
  const outcome =
    input.decision === "count"
      ? "vẫn tính đủ công."
      : input.decision === "exclude"
        ? "không tính công."
        : "đã bỏ quyết định trước đó; ngày này tạm vẫn tính đủ công cho tới khi được xem lại.";
  return {
    subject: `Ngày ${shortDate(input.date)} làm thiếu giờ đã được xem lại`,
    lines: [`Ngày ${day} bạn làm chưa đủ giờ tối thiểu của ca. Quản trị viên ${outcome}`],
    where: "Lịch sử chấm công",
  };
}

/// Admin duyệt / từ chối yêu cầu đổi ca hoặc xin nghỉ.
export function shiftRequestNotice(input: {
  date: string;
  approved: boolean;
  requestedCodes: string[];
  adminNote: string | null;
}): Notice {
  const isLeave = input.requestedCodes.length === 1 && input.requestedCodes[0] === "N";
  const what = isLeave
    ? `xin nghỉ ngày ${formatDateWithWeekday(input.date)}`
    : `đổi ca ngày ${formatDateWithWeekday(input.date)} sang ${input.requestedCodes.join(" + ")}`;
  const kind = isLeave ? "xin nghỉ" : "đổi ca";
  return {
    subject: `Yêu cầu ${kind} ngày ${shortDate(input.date)} ${input.approved ? "đã được duyệt" : "bị từ chối"}`,
    lines: [
      input.approved
        ? `Yêu cầu ${what} đã được duyệt. Lịch và bảng công đã cập nhật theo.`
        : `Yêu cầu ${what} bị từ chối. Lịch giữ nguyên như cũ.`,
      ...noteLines(input.adminNote),
    ],
    where: "Chỉnh sửa ca",
  };
}

/// Admin duyệt / từ chối phiếu OT, hoặc sửa số giờ OT đã chốt.
export function overtimeNotice(input: {
  date: string;
  action: "approve" | "reject" | "update";
  plannedStart: string;
  plannedEnd: string;
  /// Số giờ tính lương, đã định dạng ("3", "2,5").
  hours: string;
  code: string;
  rate: number;
  adminNote: string | null;
}): Notice {
  const day = formatDateWithWeekday(input.date);
  const plan = `${input.plannedStart}–${input.plannedEnd}`;
  const pay = `Số giờ tính lương: ${input.hours} giờ, loại ${input.code} hệ số ${input.rate}%.`;
  const short = shortDate(input.date);
  if (input.action === "reject") {
    return {
      subject: `Phiếu OT ngày ${short} bị từ chối`,
      lines: [`Phiếu làm thêm giờ ngày ${day} (${plan}) bị từ chối.`, ...noteLines(input.adminNote)],
      where: "Làm thêm giờ",
    };
  }
  if (input.action === "update") {
    return {
      subject: `Số giờ OT ngày ${short} đã được điều chỉnh`,
      lines: [
        `Quản trị viên đã điều chỉnh số giờ OT ngày ${day} (${plan}).`,
        "",
        pay,
        ...noteLines(input.adminNote),
      ],
      where: "Làm thêm giờ",
    };
  }
  return {
    subject: `Phiếu OT ngày ${short} đã được duyệt`,
    lines: [`Phiếu làm thêm giờ ngày ${day} (${plan}) đã được duyệt.`, "", pay, ...noteLines(input.adminNote)],
    where: "Làm thêm giờ",
  };
}

/// Ghép thành email hoàn chỉnh. Chỉ có nội dung, không có đường link hay nút
/// bấm nào (chủ dự án yêu cầu): nhân viên tự mở web chấm công để xem lại.
export function composeNoticeEmail(
  notice: Notice,
  options: { name: string; companyName: string }
): { subject: string; text: string } {
  const lines = [
    `Chào ${options.name},`,
    "",
    ...notice.lines,
    "",
    `Bạn có thể xem lại ở mục "${notice.where}" trên trang chấm công.`,
    "Nếu có gì chưa đúng, vui lòng liên hệ quản trị viên.",
    "",
    `— Hệ thống chấm công ${options.companyName}`.trimEnd(),
    "(Email tự động, vui lòng không trả lời.)",
  ];
  return { subject: `[Chấm công] ${notice.subject}`, text: lines.join("\n") };
}
