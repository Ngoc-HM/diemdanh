"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Message,
  Select,
  TableSkeleton,
  Textarea,
} from "@/app/_components/ui";
import { dateKeyVN, formatMonthLabel, monthKeyVN, weekdayLabel } from "@/lib/datetime";
import {
  formatOvertimeHours,
  OVERTIME_CONTENT_MAX,
  OVERTIME_CONTENT_MIN,
  OVERTIME_PLACE_MAX,
  validatePlannedTimes,
} from "@/lib/overtime";
import DashboardPageHeader from "@/app/dashboard/_components/page-header";
import MonthNav from "@/app/dashboard/_components/month-nav";

type RequestStatus = "pending" | "approved" | "rejected";

/// Một phiếu OT như API /api/overtime trả về.
type OvertimeView = {
  id: string;
  date: string;
  plannedStart: string;
  plannedEnd: string;
  place: string | null;
  content: string;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
  code: string;
  rate: number;
  computedSource: "ticket";
  minutes: number;
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

function formatDayVN(dateKey: string) {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

/// Chọn giờ dạng 24h (00–23 : 00–59). Không dùng ô giờ của trình duyệt vì
/// máy cài định dạng 12 giờ sẽ hiện SA/CH, nửa đêm thành "12:00 SA".
function TimeSelect24({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [hour, minute] = value.split(":");
  return (
    <div className="flex items-center gap-1.5">
      <Select
        aria-label={`${label} (giờ)`}
        value={hour}
        onChange={(event) => onChange(`${event.target.value}:${minute}`)}
      >
        {HOURS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <span className="font-semibold text-slate-500">:</span>
      <Select
        aria-label={`${label} (phút)`}
        value={minute}
        onChange={(event) => onChange(`${hour}:${event.target.value}`)}
      >
        {MINUTES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </div>
  );
}

export default function OvertimePage() {
  const [month, setMonth] = useState(() => monthKeyVN());
  const [requests, setRequests] = useState<OvertimeView[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [date, setDate] = useState(() => dateKeyVN());
  const [plannedStart, setPlannedStart] = useState("18:00");
  const [plannedEnd, setPlannedEnd] = useState("21:00");
  const [place, setPlace] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (target: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await fetch(`/api/overtime?month=${target}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không tải được phiếu OT");
      setRequests(data.requests);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Không tải được phiếu OT");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const timeError = validatePlannedTimes(plannedStart, plannedEnd);
  const trimmed = content.trim();
  const canSubmit =
    !submitting &&
    Boolean(date) &&
    !timeError &&
    trimmed.length >= OVERTIME_CONTENT_MIN &&
    trimmed.length <= OVERTIME_CONTENT_MAX;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, plannedStart, plannedEnd, place, content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không gửi được phiếu");
      setFeedback({
        type: "success",
        text: `Đã gửi phiếu OT ngày ${formatDayVN(date)} (${data.request.code}), chờ admin duyệt.`,
      });
      setContent("");
      setPlace("");
      if (date.slice(0, 7) === month) load(month);
      else setMonth(date.slice(0, 7));
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không gửi được phiếu",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(request: OvertimeView) {
    if (!confirm(`Huỷ phiếu OT ngày ${formatDayVN(request.date)}?`)) return;
    try {
      const response = await fetch(`/api/overtime/${request.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không huỷ được phiếu");
      load(month);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không huỷ được phiếu",
      });
    }
  }

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Làm thêm giờ (OT)"
        actions={<MonthNav month={month} onChange={setMonth} />}
      />

      <Message type="info">
        OT cần admin duyệt mới được trả. T: ngày thường · T1: ngày nghỉ · T2: ngày lễ.
      </Message>

      {feedback && (
        <Message type={feedback.type} onDismiss={() => setFeedback(null)}>
          {feedback.text}
        </Message>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Làm phiếu OT</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ngày" required>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Từ giờ" required>
              <TimeSelect24 label="Từ giờ" value={plannedStart} onChange={setPlannedStart} />
            </Field>
            <Field label="Đến giờ" required>
              <TimeSelect24 label="Đến giờ" value={plannedEnd} onChange={setPlannedEnd} />
            </Field>
          </div>
          {timeError && plannedStart && plannedEnd && (
            <p className="text-sm text-rose-700">{timeError}</p>
          )}

          <Field
            label="Nơi đi / nơi đến"
            hint="Bỏ trống nếu làm tại văn phòng"
          >
            <Input
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              maxLength={OVERTIME_PLACE_MAX}
              placeholder="Vd: Văn phòng → khách hàng ABC, Hà Đông"
            />
          </Field>

          <Field
            label="Nội dung công việc"
            required
            hint={`${OVERTIME_CONTENT_MIN}–${OVERTIME_CONTENT_MAX} ký tự`}
          >
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              minLength={OVERTIME_CONTENT_MIN}
              maxLength={OVERTIME_CONTENT_MAX}
              required
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit}>
              <Send size={16} aria-hidden="true" />
              {submitting ? "Đang gửi..." : "Gửi phiếu"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Phiếu OT {formatMonthLabel(month)}
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
                  <th className="px-4 py-2 font-semibold text-slate-900">Loại</th>
                  <th className="px-4 py-2 font-semibold text-slate-900">Thời gian</th>
                  <th className="px-4 py-2 font-semibold text-slate-900">Số giờ</th>
                  <th className="px-4 py-2 font-semibold text-slate-900">Nội dung</th>
                  <th className="px-4 py-2 font-semibold text-slate-900">Trạng thái</th>
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
                      <span className="text-slate-400">{weekdayLabel(request.date)}</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Badge tone="brand">{request.code}</Badge>
                      <span className="ml-1.5 text-xs text-slate-500">{request.rate}%</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-700">
                      {request.plannedStart}–{request.plannedEnd}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-900">
                      {formatOvertimeHours(request.minutes)}h
                    </td>
                    <td className="max-w-xs px-4 py-2 text-slate-700">
                      <span className="line-clamp-2" title={request.content}>
                        {request.content}
                      </span>
                      {request.place && (
                        <div className="text-xs text-slate-500">{request.place}</div>
                      )}
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
                    <td className="px-4 py-2 text-right">
                      {request.status === "pending" && (
                        <Button variant="secondary" size="sm" onClick={() => cancel(request)}>
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
            <EmptyState title="Chưa có phiếu OT nào trong tháng này" />
          </div>
        )}
      </Card>
    </div>
  );
}
