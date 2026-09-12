import { SessionRule } from "@/lib/attendance-rules";
import {
  applyDayMark,
  getAllSessionRules,
  getDayMarks,
  resolveMonthSchedules,
} from "@/lib/attendance-service";
import { getMonthRange } from "@/lib/datetime";
import { EMPLOYMENT_TYPE_LABELS, EmploymentType } from "@/lib/schedule";
import { ShiftChangeRequestRow, ShiftChangeRequestStatus } from "@/lib/types";

/// Giới hạn độ dài lý do của nhân viên và ghi chú của admin. Lý do tối thiểu
/// 3 ký tự để chặn kiểu gửi "ok" cho có, admin không biết vì sao phải duyệt.
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;
export const ADMIN_NOTE_MAX_LENGTH = 500;

/// Định dạng trả về cho nhân viên. UI hai phía đọc đúng hình dạng này.
export type RequestView = {
  id: string;
  /// "YYYY-MM-DD"
  date: string;
  leaveCode: "N" | null;
  sessionIds: string[] | null;
  /// Mã ca muốn đổi sang, theo sortOrder; ["N"] khi xin nghỉ.
  requestedCodes: string[];
  /// Mã ca hiện có của ngày đó SAU khi áp DayMark: ngày đã đánh dấu nghỉ/ốm
  /// thì là ["N"] hoặc ["O"]; không có lịch thì rỗng.
  currentCodes: string[];
  reason: string;
  status: ShiftChangeRequestStatus;
  adminNote: string | null;
  /// ISO 8601
  createdAt: string;
  reviewedAt: string | null;
};

/// Admin xem danh sách của cả công ty nên cần thêm hồ sơ nhân viên.
export type AdminRequestView = RequestView & {
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    employmentLabel: string;
  };
};

/// Dòng yêu cầu kèm hồ sơ nhân viên, lấy bằng `REQUEST_SELECT`.
export type RequestWithUserRow = ShiftChangeRequestRow & {
  userName: string;
  userEmail: string;
  userEmployeeCode: string | null;
  userEmploymentType: string;
};

/// Câu SELECT chung: route nhân viên và route admin chỉ nối thêm WHERE/ORDER.
/// Luôn JOIN User vì tính `currentCodes` cần employmentType để giải lịch tháng
/// (full-time sinh lịch tự động, part-time/intern lấy lịch đã đăng ký).
export const REQUEST_SELECT = `
  SELECT r."id", r."userId", r."date", r."leaveCode", r."sessionIds", r."reason",
         r."status", r."adminNote", r."reviewedBy", r."reviewedAt",
         r."createdAt", r."updatedAt",
         u."name" AS "userName", u."email" AS "userEmail",
         u."employeeCode" AS "userEmployeeCode",
         u."employmentType" AS "userEmploymentType"
    FROM "ShiftChangeRequest" r
    JOIN "User" u ON u."id" = r."userId"
`;

function sortedCodes(rules: SessionRule[]): string[] {
  return [...rules]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((rule) => rule.code);
}

function markKey(row: Pick<ShiftChangeRequestRow, "userId" | "date">): string {
  return `${row.userId}|${row.date}`;
}

/// Mã ca hiện tại của từng (nhân viên, ngày) trong danh sách. Lịch được giải
/// theo tháng nên gom yêu cầu theo tháng: mỗi tháng chỉ tra lịch và DayMark
/// một lần thay vì mỗi yêu cầu một lượt.
async function resolveCurrentCodes(
  rows: RequestWithUserRow[],
  activeRules: SessionRule[],
  ruleById: Map<string, SessionRule>
): Promise<Map<string, string[]>> {
  const rowsByMonth = new Map<string, RequestWithUserRow[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const list = rowsByMonth.get(month) ?? [];
    list.push(row);
    rowsByMonth.set(month, list);
  }

  const codesByKey = new Map<string, string[]>();
  for (const [month, monthRows] of rowsByMonth) {
    const users = [
      ...new Map(
        monthRows.map((row) => [
          row.userId,
          { id: row.userId, employmentType: row.userEmploymentType },
        ])
      ).values(),
    ];
    const { startDate, endDate } = getMonthRange(month);
    const [schedules, marks] = await Promise.all([
      resolveMonthSchedules(users, month, activeRules),
      getDayMarks(
        users.map((user) => user.id),
        startDate,
        endDate
      ),
    ]);

    for (const row of monthRows) {
      const key = markKey(row);
      if (codesByKey.has(key)) continue;
      const mark = marks.get(key);
      if (mark?.leaveCode) {
        codesByKey.set(key, [mark.leaveCode]);
        continue;
      }
      const scheduled = schedules.get(row.userId)?.get(row.date) ?? [];
      codesByKey.set(key, sortedCodes(applyDayMark(scheduled, mark, ruleById)));
    }
  }
  return codesByKey;
}

type BuiltView = { view: RequestView; row: RequestWithUserRow };

async function buildViews(rows: RequestWithUserRow[]): Promise<BuiltView[]> {
  if (rows.length === 0) return [];

  // Tra mã ca từ toàn bộ danh mục (kể cả ca đã tắt) để yêu cầu cũ vẫn hiện
  // đúng mã; nhưng giải lịch chỉ dùng ca đang bật, giống các trang chấm công.
  const allRules = await getAllSessionRules();
  const activeRules = allRules.filter((rule) => rule.isActive);
  const ruleById = new Map<string, SessionRule>(
    allRules.map((rule) => [rule.id, rule])
  );
  const currentCodes = await resolveCurrentCodes(rows, activeRules, ruleById);

  return rows.map((row) => ({
    row,
    view: {
      id: row.id,
      date: row.date,
      leaveCode: row.leaveCode,
      sessionIds: row.sessionIds,
      requestedCodes: row.leaveCode
        ? [row.leaveCode]
        : sortedCodes(
            (row.sessionIds ?? [])
              .map((id) => ruleById.get(id))
              .filter((rule): rule is SessionRule => Boolean(rule))
          ),
      currentCodes: currentCodes.get(markKey(row)) ?? [],
      reason: row.reason,
      status: row.status,
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    },
  }));
}

/// View cho nhân viên: không kèm hồ sơ vì họ chỉ xem yêu cầu của chính mình.
export async function buildEmployeeRequestViews(
  rows: RequestWithUserRow[]
): Promise<RequestView[]> {
  return (await buildViews(rows)).map((built) => built.view);
}

export async function buildAdminRequestViews(
  rows: RequestWithUserRow[]
): Promise<AdminRequestView[]> {
  return (await buildViews(rows)).map(({ view, row }) => ({
    ...view,
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
      employeeCode: row.userEmployeeCode,
      employmentLabel:
        EMPLOYMENT_TYPE_LABELS[row.userEmploymentType as EmploymentType] ??
        row.userEmploymentType,
    },
  }));
}
