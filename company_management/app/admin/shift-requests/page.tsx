"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "../_components/page-header";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Message,
  Modal,
  TableSkeleton,
} from "@/app/_components/ui";
import {
  addMonths,
  dateKeyVN,
  formatMonthLabel,
  formatTimeVN,
  monthKeyVN,
  weekdayLabel,
} from "@/lib/datetime";

type RequestStatus = "pending" | "approved" | "rejected";

/// Hợp đồng với GET /api/admin/shift-requests: mỗi dòng đã kèm sẵn mã ca
/// hiện có và mã ca xin đổi, nên trang không phải tra danh mục ca.
type AdminRequestView = {
  id: string;
  date: string;
  leaveCode: "N" | null;
  sessionIds: string[] | null;
  requestedCodes: string[];
  currentCodes: string[];
  reason: string;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    employmentLabel: string;
  };
};

type Payload = { requests: AdminRequestView[]; pendingCount: number };

/// "Chờ duyệt" liệt kê mọi yêu cầu đang treo bất kể tháng, vì admin cần thấy
/// hết việc phải làm; "Tất cả" mới cần điều hướng theo tháng.
type Filter = "pending" | "all";

const STATUS_BADGE: Record<
  RequestStatus,
  { tone: "warning" | "success" | "danger"; label: string }
> = {
  pending: { tone: "warning", label: "Chờ duyệt" },
  approved: { tone: "success", label: "Đã duyệt" },
  rejected: { tone: "danger", label: "Từ chối" },
};

function formatDayMonth(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/// Mốc gửi hiển thị theo giờ VN, không theo giờ trình duyệt, để khớp với mọi
/// khoá ngày khác trong hệ thống.
function formatSentAt(iso: string) {
  const at = new Date(iso);
  return `${formatDayMonth(dateKeyVN(at))} ${formatTimeVN(at)}`;
}

/// N là xin nghỉ nên tô trung tính; mã ca thật tô màu thương hiệu như ở các
/// bảng lịch khác.
function CodeBadges({ codes }: { codes: string[] }) {
  if (codes.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {codes.map((code) => (
        <Badge key={code} tone={code === "N" ? "neutral" : "brand"}>
          {code}
        </Badge>
      ))}
    </span>
  );
}

export default function ShiftRequestsPage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [month, setMonth] = useState(() => monthKeyVN());
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  /// id yêu cầu đang gửi thao tác, để khoá nút của đúng dòng đó.
  const [acting, setActing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminRequestView | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async (target: Filter, targetMonth: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: target });
      if (target === "all") params.set("month", targetMonth);
      const response = await fetch(`/api/admin/shift-requests?${params}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được dữ liệu");
      setData(payload);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Lỗi không xác định",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter, month);
  }, [filter, month, load]);

  async function review(
    request: AdminRequestView,
    action: "approve" | "reject",
    note?: string
  ) {
    setActing(request.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/shift-requests/${request.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note ? { action, note } : { action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể lưu");

      setRejecting(null);
      setRejectNote("");
      setMessage({
        type: "success",
        text:
          action === "approve"
            ? `Đã duyệt yêu cầu ngày ${formatDayMonth(request.date)} của ${request.user.name}; lịch ngày đó đã đổi theo.`
            : `Đã từ chối yêu cầu ngày ${formatDayMonth(request.date)} của ${request.user.name}.`,
      });
      await load(filter, month);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    } finally {
      setActing(null);
    }
  }

  function approve(request: AdminRequestView) {
    const target =
      request.requestedCodes.join("+") || (request.leaveCode ?? "");
    const ok = window.confirm(
      `Duyệt cho ${request.user.name} đổi ngày ${formatDayMonth(request.date)} sang ${target}?\nLịch ngày đó sẽ đổi ngay và ô được đánh dấu admin đã sửa.`
    );
    if (ok) review(request, "approve");
  }

  function openReject(request: AdminRequestView) {
    setRejecting(request);
    setRejectNote("");
  }

  function submitReject(event: React.FormEvent) {
    event.preventDefault();
    if (!rejecting) return;
    review(rejecting, "reject", rejectNote.trim() || undefined);
  }

  const pendingCount = data?.pendingCount ?? 0;

  return (
    <>
      <PageHeader
        title="Duyệt đổi ca"
        description="Nhân viên gửi yêu cầu đổi ca hoặc xin nghỉ cho một ngày cụ thể; duyệt thì lịch ngày đó đổi theo và ô được đánh dấu admin đã sửa."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Lọc yêu cầu"
          className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5"
        >
          <FilterTab
            active={filter === "pending"}
            onClick={() => setFilter("pending")}
          >
            Chờ duyệt
            {pendingCount > 0 && (
              <span
                className={`rounded-full px-1.5 text-[11px] font-semibold ${
                  filter === "pending"
                    ? "bg-white/20 text-white"
                    : "bg-rose-600 text-white"
                }`}
              >
                {pendingCount}
              </span>
            )}
          </FilterTab>
          <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
            Tất cả
          </FilterTab>
        </div>

        {filter === "all" && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label="Tháng trước"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold text-slate-900">
              {formatMonthLabel(month)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label="Tháng sau"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {message && (
        <div className="mb-4">
          <Message type={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </Message>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : data && data.requests.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-900">Nhân viên</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Ngày</th>
                <th className="px-4 py-3 font-semibold text-slate-900">
                  Lịch hiện tại → Yêu cầu
                </th>
                <th className="px-4 py-3 font-semibold text-slate-900">Lý do</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Gửi lúc</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Trạng thái</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-900">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.requests.map((request) => {
                const status = STATUS_BADGE[request.status];
                const busy = acting === request.id;
                return (
                  <tr key={request.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/attendance/user/${request.user.id}?month=${request.date.slice(0, 7)}`}
                        className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
                      >
                        {request.user.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {request.user.employeeCode
                          ? `${request.user.employeeCode} · `
                          : ""}
                        {request.user.employmentLabel}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatDayMonth(request.date)}
                      </span>{" "}
                      <span className="text-slate-400">
                        {weekdayLabel(request.date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <CodeBadges codes={request.currentCodes} />
                        <ArrowRight
                          size={14}
                          aria-label="đổi sang"
                          className="shrink-0 text-slate-400"
                        />
                        <CodeBadges codes={request.requestedCodes} />
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">
                      {request.reason}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatSentAt(request.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {request.adminNote && (
                        <div className="mt-1 max-w-xs text-xs text-slate-500">
                          {request.adminNote}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {request.status === "pending" ? (
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approve(request)}
                            disabled={busy}
                          >
                            {busy ? "Đang lưu..." : "Duyệt"}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openReject(request)}
                            disabled={busy}
                          >
                            Từ chối
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {request.reviewedAt
                            ? formatSentAt(request.reviewedAt)
                            : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title="Không có yêu cầu nào"
          description={
            filter === "pending"
              ? "Mọi yêu cầu đổi ca đã được xử lý."
              : `Không có yêu cầu đổi ca nào trong ${formatMonthLabel(month)}.`
          }
        />
      )}

      <Modal
        open={rejecting !== null}
        title={
          rejecting
            ? `Từ chối yêu cầu ngày ${formatDayMonth(rejecting.date)}`
            : "Từ chối yêu cầu"
        }
        onClose={() => setRejecting(null)}
      >
        <form onSubmit={submitReject} className="space-y-4">
          {rejecting && (
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">
                {rejecting.user.name}
              </span>{" "}
              xin đổi{" "}
              <CodeBadges codes={rejecting.currentCodes} /> →{" "}
              <CodeBadges codes={rejecting.requestedCodes} /> với lý do: “
              {rejecting.reason}”. Lịch ngày đó sẽ giữ nguyên.
            </p>
          )}
          <Field
            label="Ghi chú cho nhân viên"
            hint="Không bắt buộc. Nhân viên sẽ thấy ghi chú này bên cạnh yêu cầu bị từ chối."
          >
            <Input
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRejecting(null)}
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={rejecting !== null && acting === rejecting.id}
            >
              {rejecting !== null && acting === rejecting.id
                ? "Đang lưu..."
                : "Từ chối"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
        active
          ? "bg-sky-600 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}
