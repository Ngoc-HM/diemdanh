import { minutesOfDayVN, parseTimeToMinutes } from "@/lib/datetime";

export { ATTENDANCE_TIME_ZONE } from "@/lib/datetime";

/// Số phút được châm chước trước khi tính là đi muộn.
export const LATE_GRACE_MINUTES = 5;

export type SessionRule = {
  id: string;
  code: string;
  name: string;
  checkInStart: string;
  checkInEnd: string;
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

export type DayStatus =
  | "passed"
  | "late"
  | "insufficient"
  | "open"
  | "absent"
  | "unscheduled"
  | "holiday"
  | "off";

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  passed: "Đủ công",
  late: "Đi muộn",
  insufficient: "Thiếu giờ",
  open: "Đang làm",
  absent: "Vắng",
  unscheduled: "Ngoài lịch",
  holiday: "Nghỉ lễ",
  off: "Không có lịch",
};

/// Trạng thái được tính là một ngày công hợp lệ.
export const PASSING_STATUSES: DayStatus[] = ["passed", "late"];

export type WorkInterval = { from: Date; to: Date };

export type PairedPunches = {
  intervals: WorkInterval[];
  workedMinutes: number;
  firstIn: Date | null;
  lastOut: Date | null;
  /// Có một lần check-in chưa được đóng bằng check-out.
  openSince: Date | null;
};

/// Ghép các lần bấm giờ thành từng khoảng in -> out theo thứ tự thời gian.
/// Nhờ vậy một ngày có thể gồm nhiều ca rời nhau (sáng 8-12, chiều 13-18)
/// và thời gian ra ngoài giữa hai ca không bị tính vào giờ công.
export function pairPunches(punches: PunchInput[]): PairedPunches {
  const sorted = [...punches].sort((a, b) => a.at.getTime() - b.at.getTime());

  const intervals: WorkInterval[] = [];
  let openIn: Date | null = null;
  let firstIn: Date | null = null;
  let lastOut: Date | null = null;

  for (const punch of sorted) {
    if (punch.type === "in") {
      // Hai lần check-in liên tiếp: giữ lần đầu, bỏ qua lần lặp.
      if (openIn === null) openIn = punch.at;
      if (firstIn === null) firstIn = punch.at;
    } else {
      // Check-out khi chưa check-in thì không tạo được khoảng nào.
      if (openIn !== null) {
        intervals.push({ from: openIn, to: punch.at });
        openIn = null;
      }
      lastOut = punch.at;
    }
  }

  const workedMinutes = intervals.reduce(
    (total, interval) =>
      total + Math.max(0, (interval.to.getTime() - interval.from.getTime()) / 60_000),
    0
  );

  return { intervals, workedMinutes, firstIn, lastOut, openSince: openIn };
}

export type DayEvaluation = {
  status: DayStatus;
  /// Mã các ca đã đăng ký cho ngày này.
  codes: string[];
  workedMinutes: number;
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

export function evaluateDay(input: {
  scheduled: SessionRule[];
  punches: PunchInput[];
  isHoliday?: boolean;
}): DayEvaluation {
  const { scheduled, punches, isHoliday = false } = input;
  const paired = pairPunches(punches);
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
    requiredMinutes,
    firstIn: paired.firstIn,
    lastOut: paired.lastOut,
    openSince: paired.openSince,
    outsideRadius,
  };

  if (punches.length === 0) {
    return {
      ...base,
      status: isHoliday ? "holiday" : scheduled.length > 0 ? "absent" : "off",
      missingMinutes: scheduled.length > 0 && !isHoliday ? requiredMinutes : 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
    };
  }

  if (paired.openSince !== null) {
    return {
      ...base,
      status: "open",
      missingMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
    };
  }

  // Có chấm công nhưng ngày đó không đăng ký ca nào.
  if (scheduled.length === 0) {
    return {
      ...base,
      status: "unscheduled",
      missingMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
    };
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

  return { ...base, status, missingMinutes, lateMinutes, earlyLeaveMinutes };
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
