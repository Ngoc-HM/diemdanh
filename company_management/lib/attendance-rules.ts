import {
  formatMinutes,
  minutesOfDayVN,
  parseTimeToMinutes,
} from "@/lib/datetime";

export { ATTENDANCE_TIME_ZONE } from "@/lib/datetime";

/// Số phút được châm chước trước khi tính là đi muộn.
export const LATE_GRACE_MINUTES = 5;

export type SessionRule = {
  id: string;
  code: string;
  name: string;
  workStart: string;
  workEnd: string;
  minHours: number;
  sortOrder: number;
  isDefaultFull: boolean;
};

export type PunchInput = {
  type: string;
  at: Date;
  withinRadius: boolean;
};

/// Giờ nghỉ trưa chung của công ty, tính bằng phút từ 00:00 giờ VN. Nhân viên
/// chỉ bấm vào một lần buổi sáng và ra một lần buổi chiều, không bấm giờ cho
/// bữa trưa; phần thời gian rơi vào khoảng này được trừ khỏi giờ công.
export type LunchBreak = { start: number; end: number };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/// Đọc chuỗi lưu trong Settings, dạng "12:00-13:30". Rỗng hoặc sai dạng thì
/// coi như công ty không đặt giờ nghỉ trưa.
export function parseLunchBreak(
  value: string | null | undefined
): LunchBreak | null {
  if (!value) return null;
  const parts = value.trim().split("-");
  if (parts.length !== 2) return null;
  const [startText, endText] = parts;
  if (!TIME_PATTERN.test(startText) || !TIME_PATTERN.test(endText)) return null;
  const start = parseTimeToMinutes(startText);
  const end = parseTimeToMinutes(endText);
  return start < end ? { start, end } : null;
}

export function formatLunchBreak(lunch: LunchBreak | null): string {
  return lunch
    ? `${formatMinutes(lunch.start)}-${formatMinutes(lunch.end)}`
    : "";
}

/// Số phút của khoảng vào–ra rơi vào giờ nghỉ trưa. Tính theo phút trong ngày
/// VN của giờ vào; ca kéo qua nửa đêm chỉ trừ bữa trưa của ngày vào ca.
export function lunchOverlapMinutes(
  firstIn: Date,
  lastOut: Date,
  lunch: LunchBreak | null
): number {
  if (!lunch) return 0;
  const inMinute = minutesOfDayVN(firstIn);
  const outMinute =
    inMinute + (lastOut.getTime() - firstIn.getTime()) / 60_000;
  return Math.max(
    0,
    Math.min(outMinute, lunch.end) - Math.max(inMinute, lunch.start)
  );
}

export type DayStatus =
  | "passed"
  | "late"
  | "insufficient"
  | "open"
  | "missed_out"
  | "leave"
  | "sick"
  | "absent"
  | "unscheduled"
  | "holiday"
  | "off";

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  passed: "Đủ công",
  late: "Đi muộn",
  insufficient: "Thiếu giờ",
  open: "Đang làm",
  missed_out: "Quên checkout",
  leave: "Nghỉ",
  sick: "Ốm",
  absent: "Vắng",
  unscheduled: "Ngoài lịch",
  holiday: "Nghỉ lễ",
  off: "Không có lịch",
};

/// Trạng thái luôn được tính là một ngày công hợp lệ. Ngoài ra, ngày "ngoài
/// lịch" (quên đăng ký nhưng vẫn đi làm, có đủ giờ vào và giờ ra) cũng được
/// tính đủ ngày công — xem `countsAsWorkDay` trong DayEvaluation.
export const PASSING_STATUSES: DayStatus[] = ["passed", "late"];

export type PairedPunches = {
  workedMinutes: number;
  /// Số phút nghỉ trưa đã trừ khỏi workedMinutes.
  lunchMinutes: number;
  firstIn: Date | null;
  lastOut: Date | null;
  /// Đã check-in nhưng chưa có lần check-out nào sau đó.
  openSince: Date | null;
};

/// Mỗi ngày chỉ có một lần check-in; nhân viên được bấm check-out nhiều lần và
/// hệ thống lấy lần muộn nhất làm giờ ra. Giờ công là khoảng từ lúc vào tới
/// lần ra muộn nhất, trừ đi phần rơi vào giờ nghỉ trưa (nếu công ty có đặt).
/// Không giới hạn giờ được bấm: vào lúc nào cũng được, ra lúc nào cũng được.
export function pairPunches(
  punches: PunchInput[],
  lunch: LunchBreak | null = null
): PairedPunches {
  const sorted = [...punches].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Vào nhiều lần (do admin nhập tay) thì lấy lần sớm nhất.
  const firstIn = sorted.find((punch) => punch.type === "in")?.at ?? null;

  // Chỉ những lần ra sau giờ vào mới hợp lệ; lấy lần muộn nhất.
  const lastOut = firstIn
    ? (sorted
        .filter(
          (punch) =>
            punch.type === "out" && punch.at.getTime() > firstIn.getTime()
        )
        .at(-1)?.at ?? null)
    : null;

  const lunchMinutes =
    firstIn && lastOut ? lunchOverlapMinutes(firstIn, lastOut, lunch) : 0;
  const workedMinutes =
    firstIn && lastOut
      ? Math.max(
          0,
          (lastOut.getTime() - firstIn.getTime()) / 60_000 - lunchMinutes
        )
      : 0;

  return {
    workedMinutes,
    lunchMinutes,
    firstIn,
    lastOut,
    openSince: firstIn && !lastOut ? firstIn : null,
  };
}

export type DayEvaluation = {
  status: DayStatus;
  /// Ngày này được tính là một ngày công: đủ công, đi muộn, hoặc làm ngoài
  /// lịch mà có đủ giờ vào lẫn giờ ra. Mọi chỗ đếm "ngày công" phải dùng cờ
  /// này thay vì so sánh status.
  countsAsWorkDay: boolean;
  /// Mã các ca đã đăng ký cho ngày này.
  codes: string[];
  workedMinutes: number;
  /// Số phút nghỉ trưa đã trừ khỏi workedMinutes.
  lunchMinutes: number;
  requiredMinutes: number;
  missingMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  firstIn: Date | null;
  lastOut: Date | null;
  openSince: Date | null;
  /// Có ít nhất một lần bấm giờ nằm ngoài bán kính cho phép.
  outsideRadius: boolean;
};

export type LeaveCode = "N" | "O";

/// Gắn cờ ngày công vào kết quả xếp loại. Ngoài lịch chỉ được tính khi có cả
/// giờ vào lẫn giờ ra — chỉ có một lần ra mồ côi thì không phải đi làm.
function withWorkDayFlag(
  evaluation: Omit<DayEvaluation, "countsAsWorkDay">
): DayEvaluation {
  const countsAsWorkDay =
    PASSING_STATUSES.includes(evaluation.status) ||
    (evaluation.status === "unscheduled" &&
      evaluation.firstIn !== null &&
      evaluation.lastOut !== null);
  return { ...evaluation, countsAsWorkDay };
}

export function evaluateDay(input: {
  scheduled: SessionRule[];
  punches: PunchInput[];
  isHoliday?: boolean;
  /// Ngày đã kết thúc (trước hôm nay theo giờ VN). Ca còn mở của ngày đã qua
  /// là quên checkout, còn của hôm nay thì vẫn đang làm.
  isPast?: boolean;
  /// N = nhân viên đăng ký nghỉ, O = admin chấm ốm. Cả hai đều không yêu cầu
  /// giờ công và không được tính là một ngày công.
  leaveCode?: LeaveCode | null;
  /// Giờ nghỉ trưa của công ty; null = không trừ gì.
  lunchBreak?: LunchBreak | null;
}): DayEvaluation {
  const {
    scheduled,
    punches,
    isHoliday = false,
    isPast = false,
    leaveCode = null,
    lunchBreak = null,
  } = input;
  const paired = pairPunches(punches, lunchBreak);
  const outsideRadius = punches.some((punch) => !punch.withinRadius);

  const requiredMinutes = Math.round(
    scheduled.reduce((total, rule) => total + rule.minHours * 60, 0)
  );
  const codes = [...scheduled]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((rule) => rule.code);

  const base = {
    codes,
    workedMinutes: Math.round(paired.workedMinutes),
    lunchMinutes: Math.round(paired.lunchMinutes),
    requiredMinutes,
    firstIn: paired.firstIn,
    lastOut: paired.lastOut,
    openSince: paired.openSince,
    outsideRadius,
  };

  // Ngày đã đánh dấu nghỉ/ốm: không tính vắng, không đòi giờ công.
  if (leaveCode) {
    return withWorkDayFlag({
      ...base,
      requiredMinutes: 0,
      status: leaveCode === "O" ? "sick" : "leave",
      missingMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
    });
  }

  if (punches.length === 0) {
    return withWorkDayFlag({
      ...base,
      status: isHoliday ? "holiday" : scheduled.length > 0 ? "absent" : "off",
      missingMinutes: scheduled.length > 0 && !isHoliday ? requiredMinutes : 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
    });
  }

  // Đã vào ca mà không có lần ra nào. Hết ngày vẫn vậy thì là quên checkout:
  // không tính giờ công, chờ admin bổ sung giờ ra thủ công.
  if (paired.openSince !== null) {
    return withWorkDayFlag({
      ...base,
      status: isPast ? "missed_out" : "open",
      missingMinutes:
        isPast && !isHoliday && scheduled.length > 0 ? requiredMinutes : 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
    });
  }

  // Có chấm công nhưng ngày đó không đăng ký ca nào (quên đăng ký). Vẫn tính
  // đủ ngày công theo giờ thực tế, không có ngưỡng để so; lưới tô vàng để
  // admin biết mà gán ca nếu cần mã ca cho bảng lương.
  if (scheduled.length === 0) {
    return withWorkDayFlag({
      ...base,
      status: "unscheduled",
      missingMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
    });
  }

  const earliestStart = Math.min(
    ...scheduled.map((rule) => parseTimeToMinutes(rule.workStart))
  );
  const latestEnd = Math.max(
    ...scheduled.map((rule) => parseTimeToMinutes(rule.workEnd))
  );

  const lateMinutes = paired.firstIn
    ? Math.max(
        0,
        minutesOfDayVN(paired.firstIn) - earliestStart - LATE_GRACE_MINUTES
      )
    : 0;
  const earlyLeaveMinutes = paired.lastOut
    ? Math.max(0, latestEnd - minutesOfDayVN(paired.lastOut))
    : 0;

  const workedMinutes = Math.round(paired.workedMinutes);
  const missingMinutes = Math.max(0, requiredMinutes - workedMinutes);

  let status: DayStatus;
  if (missingMinutes > 0) {
    status = "insufficient";
  } else if (lateMinutes > 0) {
    status = "late";
  } else {
    status = "passed";
  }

  return withWorkDayFlag({
    ...base,
    status,
    missingMinutes,
    lateMinutes,
    earlyLeaveMinutes,
  });
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/// Ký hiệu hiển thị trong lưới tháng.
export function dayCellLabel(evaluation: DayEvaluation): string {
  const code = evaluation.codes.join("+");
  switch (evaluation.status) {
    case "passed":
      return code || "OK";
    case "late":
      return code ? `${code}*` : "*";
    case "insufficient":
      return code ? `${code}!` : "!";
    case "open":
      return "…";
    case "missed_out":
      return "?";
    case "leave":
      return "N";
    case "sick":
      return "O";
    case "absent":
      return "V";
    case "unscheduled":
      return "NL";
    case "holiday":
      return "L";
    case "off":
    default:
      return "";
  }
}
