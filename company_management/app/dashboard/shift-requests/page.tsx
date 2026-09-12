"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Message,
  TableSkeleton,
  Textarea,
} from "@/app/_components/ui";
import {
  dateKeyVN,
  formatMonthLabel,
  isValidDateKey,
  monthKeyVN,
  weekdayLabel,
} from "@/lib/datetime";
import { toggleSessionSelection } from "@/lib/schedule";
import DashboardPageHeader from "@/app/dashboard/_components/page-header";
import MonthNav from "@/app/dashboard/_components/month-nav";

type SessionRule = {
  id: string;
  code: string;
  name: string;
  workStart: string;
  workEnd: string;
  minHours: number;
};

/// Phần cần dùng của GET /api/schedule: ca hiện có của ngày đã chọn (sau khi
/// admin sửa, nếu có) và danh mục ca để bày nút "Đổi sang".
type SchedulePayload = {
  month: string;
  sessions: SessionRule[];
  days: Record<string, string[]>;
  offDays: string[];
};

type RequestStatus = "pending" | "approved" | "rejected";

/// Một yêu cầu đổi ca như API /api/shift-requests trả về.
type RequestView = {
  id: string;
  date: string;
  leaveCode: "N" | null;
  sessionIds: string[] | null;
  /// Mã ca xin đổi sang, hoặc ["N"] khi xin nghỉ.
  requestedCodes: string[];
  /// Mã ca hiện có của ngày đó; rỗng = không có lịch.
  currentCodes: string[];
  reason: string;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type Feedback = { type: "success" | "error"; text: string };

const STATUS_BADGE: Record<
  RequestStatus,
  { tone: "warning" | "success" | "danger"; label: string }
> = {
  pending: { tone: "warning", label: "Chờ duyệt" },
  approved: { tone: "success", label: "Đã duyệt" },
  rejected: { tone: "danger", label: "Từ chối" },
};

/// Giới hạn lý do trùng với API để chặn ngay ở nút Gửi thay vì đợi 400.
const REASON_MIN = 3;
const REASON_MAX = 500;

function formatDayVN(dateKey: string) {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

/// Nút chọn ca trong khối "Đổi sang", cùng bảng màu với ô đang chọn trong lưới
/// đăng ký: ca = sky, nghỉ N = slate, để nhân viên nhìn quen mắt.
function optionClass(active: boolean, tone: "sky" | "slate") {
  const base =
    "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors";
  if (!active) {
    return `${base} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
  }
  return tone === "sky"
    ? `${base} border-sky-600 bg-sky-600 text-white hover:bg-sky-700`
    : `${base} border-slate-700 bg-slate-700 text-white hover:bg-slate-800`;
}

/// Mã nghỉ (N nhân viên xin, O admin chấm ốm) không phải ca làm.
const LEAVE_CODES: readonly string[] = ["N", "O"];

/// Mã ca dạng Badge: mã nghỉ tone xám, ca làm tone brand; nhiều ca nối bằng
/// "+" như cột "Ca" ở trang Lịch sử.
function CodeBadge({ codes }: { codes: string[] }) {
  if (codes.length === 0) return <span className="text-slate-400">—</span>;
  const isLeave = codes.length === 1 && LEAVE_CODES.includes(codes[0]);
  return <Badge tone={isLeave ? "neutral" : "brand"}>{codes.join("+")}</Badge>;
}

export default function ShiftRequestsPage() {
  const [month, setMonth] = useState(() => monthKeyVN());

  // Form gửi yêu cầu
  const [date, setDate] = useState(() => dateKeyVN());
  const [schedule, setSchedule] = useState<SchedulePayload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [leave, setLeave] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Danh sách yêu cầu của tháng đang chọn
  const [requests, setRequests] = useState<RequestView[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  /// Tháng chứa ngày đã chọn; null khi ô ngày đang trống hoặc không hợp lệ.
  const scheduleMonth = isValidDateKey(date) ? date.slice(0, 7) : null;

  const loadSchedule = useCallback(async (target: string) => {
    try {
      const response = await fetch(`/api/schedule?month=${target}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Không tải được lịch");
      setSchedule(payload);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không tải được lịch",
      });
    }
  }, []);

  const loadRequests = useCallback(async (target: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await fetch(`/api/shift-requests?month=${target}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Không tải được danh sách yêu cầu");
      }
      setRequests(payload.requests ?? []);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Lỗi không xác định");
    } finally {
      setListLoading(false);
    }
  }, []);

  /// Đổi sang ngày ở tháng khác thì tải lại lịch của tháng đó.
  useEffect(() => {
    if (scheduleMonth) loadSchedule(scheduleMonth);
  }, [scheduleMonth, loadSchedule]);

  useEffect(() => {
    loadRequests(month);
  }, [month, loadRequests]);

  // Phản hồi của tháng cũ có thể về sau khi đã đổi ngày; chỉ dùng payload
  // đúng tháng đang chọn, còn danh mục ca thì tháng nào cũng như nhau.
  const current =
    schedule && schedule.month === scheduleMonth ? schedule : null;
  const sessions = schedule?.sessions ?? [];
  const codeById = new Map(sessions.map((rule) => [rule.id, rule.code]));

  /// Mô tả lịch hiện tại của ngày đã chọn để nhân viên đối chiếu trước khi gửi.
  function describeCurrent(): string {
    if (!scheduleMonth) return "Chọn một ngày hợp lệ";
    if (!current) return "Đang tải...";
    if (current.offDays.includes(date)) return "Nghỉ (N)";
    const ids = current.days[date] ?? [];
    if (ids.length === 0) return "Không có lịch";
    return ids
      .map((id) => {
        const rule = current.sessions.find((item) => item.id === id);
        return rule ? `${rule.code} · ${rule.name}` : id;
      })
      .join(", ");
  }

  /// Chọn ca theo quy tắc chung của lưới đăng ký (CN loại trừ S/C); chọn ca
  /// thì bỏ N vì hai thứ loại trừ nhau.
  function toggleSession(rule: SessionRule) {
    setLeave(false);
    setSelected((items) => toggleSessionSelection(items, rule.id, codeById));
  }

  function toggleLeave() {
    setLeave((value) => !value);
    setSelected([]);
  }

  const trimmedReason = reason.trim();
  const hasTarget = leave || selected.length > 0;
  const canSubmit =
    scheduleMonth !== null &&
    hasTarget &&
    trimmedReason.length >= REASON_MIN &&
    trimmedReason.length <= REASON_MAX &&
    !submitting;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      // Đúng một trong hai: xin nghỉ N hoặc danh sách ca muốn đổi sang.
      const body = leave
        ? { date, leaveCode: "N", reason: trimmedReason }
        : { date, sessionIds: selected, reason: trimmedReason };
      const response = await fetch("/api/shift-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Không gửi được yêu cầu");

      setFeedback({ type: "success", text: "Đã gửi, chờ admin duyệt" });
      setReason("");
      setSelected([]);
      setLeave(false);

      // Chuyển danh sách sang tháng của ngày vừa gửi để yêu cầu mới hiện ngay.
      const target = date.slice(0, 7);
      if (target === month) await loadRequests(month);
      else setMonth(target);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không gửi được yêu cầu",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(request: RequestView) {
    if (!confirm(`Huỷ yêu cầu ngày ${formatDayVN(request.date)}?`)) return;
    setFeedback(null);
    try {
      const response = await fetch(`/api/shift-requests/${request.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Không huỷ được yêu cầu");
      setFeedback({ type: "success", text: "Đã huỷ yêu cầu" });
      await loadRequests(month);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không huỷ được yêu cầu",
      });
    }
  }

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Chỉnh sửa ca"
        actions={<MonthNav month={month} onChange={setMonth} />}
      />

      <Message type="info">
        Quên đăng ký mà vẫn đi làm thì hệ thống vẫn tính công và tô vàng. Chỉ
        cần gửi yêu cầu khi muốn đổi ca đã đăng ký, hoặc xin nghỉ một ngày đã
        có lịch.
      </Message>

      {feedback && (
        <Message type={feedback.type} onDismiss={() => setFeedback(null)}>
          {feedback.text}
        </Message>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Gửi yêu cầu</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ngày" required>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Lịch hiện tại
              </span>
              <p className="flex h-11 items-center text-sm text-slate-900">
                {describeCurrent()}
              </p>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Đổi sang<span className="ml-0.5 text-rose-600">*</span>
            </span>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500">Đang tải danh mục ca...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sessions.map((rule) => {
                  const active = selected.includes(rule.id);
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => toggleSession(rule)}
                      aria-pressed={active}
                      className={optionClass(active, "sky")}
                    >
                      <span className="font-semibold">{rule.code}</span>
                      <span>· {rule.name}</span>
                      <span className="text-xs opacity-75">
                        {rule.workStart}–{rule.workEnd}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={toggleLeave}
                  aria-pressed={leave}
                  className={optionClass(leave, "slate")}
                >
                  <span className="font-semibold">N</span>
                  <span>· Nghỉ</span>
                </button>
              </div>
            )}
          </div>

          <Field label="Lý do" required hint={`${REASON_MIN}–${REASON_MAX} ký tự`}>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={REASON_MIN}
              maxLength={REASON_MAX}
              required
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit}>
              <Send size={16} aria-hidden="true" />
              {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Yêu cầu {formatMonthLabel(month)}
          </h2>
        </div>

        {listError && (
          <div className="p-5">
            <Message type="error">{listError}</Message>
          </div>
        )}

        {listLoading ? (
          <div className="p-5">
            <TableSkeleton rows={3} />
          </div>
        ) : requests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-2 font-semibold text-slate-900">Ngày</th>
                  <th className="px-4 py-2 font-semibold text-slate-900">
                    Từ → Sang
                  </th>
                  <th className="px-4 py-2 font-semibold text-slate-900">Lý do</th>
                  <th className="px-4 py-2 font-semibold text-slate-900">
                    Trạng thái
                  </th>
                  <th className="hidden px-4 py-2 font-semibold text-slate-900 md:table-cell">
                    Gửi lúc
                  </th>
                  <th className="px-4 py-2">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatDayVN(request.date)}
                      </span>{" "}
                      <span className="text-slate-400">
                        {weekdayLabel(request.date)}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <CodeBadge codes={request.currentCodes} />
                        <ArrowRight
                          size={14}
                          className="text-slate-400"
                          aria-hidden="true"
                        />
                        <CodeBadge codes={request.requestedCodes} />
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-2 text-slate-700">
                      <span className="line-clamp-2" title={request.reason}>
                        {request.reason}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={STATUS_BADGE[request.status].tone}>
                        {STATUS_BADGE[request.status].label}
                      </Badge>
                      {request.adminNote && (
                        <div className="mt-1 text-xs text-slate-500">
                          Admin: {request.adminNote}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-4 py-2 whitespace-nowrap text-slate-500 md:table-cell">
                      {new Date(request.createdAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {request.status === "pending" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => cancel(request)}
                        >
                          Huỷ
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState title="Chưa có yêu cầu nào trong tháng này" />
          </div>
        )}
      </Card>
    </div>
  );
}
