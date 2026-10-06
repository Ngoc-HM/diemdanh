"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { addMonths, formatMonthLabel, monthKeyVN, weekdayLabel } from "@/lib/datetime";
import { formatOvertimeHours } from "@/lib/overtime";

type RequestStatus = "pending" | "approved" | "rejected";
type Filter = "pending" | "approved" | "all";

/// Hợp đồng với GET /api/admin/overtime.
type OvertimeView = {
  id: string;
  date: string;
  plannedStart: string;
  plannedEnd: string;
  place: string | null;
  content: string;
  status: RequestStatus;
  adminNote: string | null;
  code: string;
  rate: number;
  computedMinutes: number;
  computedSource: "punches" | "planned";
  approvedMinutes: number | null;
  minutes: number;
  user: { id: string; name: string; employeeCode: string | null; employmentLabel: string };
};

type Payload = { month: string; requests: OvertimeView[]; pendingTotal: number };

type ConfigForm = {
  weekdayRate: string;
  weeklyOffRate: string;
  holidayRate: string;
  hoursPerDay: string;
};

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

export default function AdminOvertimePage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [month, setMonth] = useState(() => monthKeyVN());
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [config, setConfig] = useState<ConfigForm | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  /// Phiếu đang mở modal: duyệt / sửa giờ (approve) hoặc từ chối (reject).
  const [editing, setEditing] = useState<{ request: OvertimeView; action: "approve" | "reject" } | null>(
    null
  );
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async (target: Filter, targetMonth: string) => {
    setLoading(true);
    try {
      const status = target === "all" ? "" : `&status=${target}`;
      const response = await fetch(`/api/admin/overtime?month=${targetMonth}${status}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được phiếu OT");
      setData(payload);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không tải được phiếu OT",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter, month);
  }, [filter, month, load]);

  useEffect(() => {
    fetch("/api/settings/overtime")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload?.config) return;
        const value = payload.config;
        setConfig({
          weekdayRate: String(value.weekdayRate),
          weeklyOffRate: String(value.weeklyOffRate),
          holidayRate: String(value.holidayRate),
          hoursPerDay: String(value.hoursPerDay),
        });
      })
      .catch(() => undefined);
  }, []);

  async function saveConfig(event: React.FormEvent) {
    event.preventDefault();
    if (!config) return;
    setSavingConfig(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/overtime", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      setMessage({ type: "success", text: "Đã lưu hệ số OT" });
      load(filter, month);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không lưu được",
      });
    } finally {
      setSavingConfig(false);
    }
  }

  function open(request: OvertimeView, action: "approve" | "reject") {
    setEditing({ request, action });
    setHours(
      request.approvedMinutes !== null
        ? String(Math.round((request.approvedMinutes / 60) * 100) / 100)
        : ""
    );
    setNote(request.adminNote ?? "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const { request, action } = editing;
    setActing(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/overtime/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "reject" ? "reject" : request.status === "approved" ? "update" : "approve",
          approvedHours: hours.trim() === "" ? null : hours,
          adminNote: note,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      setEditing(null);
      setMessage({
        type: "success",
        text:
          action === "reject"
            ? `Đã từ chối phiếu OT của ${request.user.name}`
            : `Đã duyệt ${formatOvertimeHours(payload.request.minutes)}h ${payload.request.code} cho ${request.user.name}`,
      });
      load(filter, month);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không lưu được",
      });
    } finally {
      setActing(false);
    }
  }

  const pendingTotal = data?.pendingTotal ?? 0;
  const configField = (key: keyof ConfigForm, label: string, unit: string) => (
    <Field label={label} required>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step={key === "hoursPerDay" ? "0.5" : "10"}
          min={key === "hoursPerDay" ? 1 : 100}
          max={key === "hoursPerDay" ? 24 : 1000}
          className="w-24"
          value={config?.[key] ?? ""}
          onChange={(event) =>
            setConfig((current) => (current ? { ...current, [key]: event.target.value } : current))
          }
          required
        />
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
    </Field>
  );

  return (
    <>
      <PageHeader
        title="Làm thêm giờ (OT)"
        description="Nhân viên làm phiếu OT, admin duyệt mới được trả. Ký hiệu tự gắn theo ngày; số giờ lấy từ chấm công (thiếu giờ vào/ra thì theo giờ dự kiến), admin chốt tay được khi duyệt."
      />

      <Card className="mb-6 p-5">
        <form onSubmit={saveConfig} className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1">
            <h3 className="text-base font-semibold text-slate-900">Hệ số OT</h3>
            <p className="mt-1 max-w-md text-sm text-slate-600">
              Lương OT = lương ngày ÷ số giờ chuẩn × số giờ OT × hệ số. Mặc định
              theo Bộ luật Lao động: 150% / 200% / 300%.
            </p>
          </div>
          {configField("weekdayRate", "T · ngày thường", "%")}
          {configField("weeklyOffRate", "T1 · ngày nghỉ tuần", "%")}
          {configField("holidayRate", "T2 · ngày lễ", "%")}
          {configField("hoursPerDay", "Giờ chuẩn / ngày", "giờ")}
          <Button type="submit" disabled={!config || savingConfig}>
            {savingConfig ? "Đang lưu..." : "Lưu hệ số"}
          </Button>
        </form>
      </Card>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Lọc phiếu OT"
          className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5"
        >
          <FilterTab active={filter === "pending"} onClick={() => setFilter("pending")}>
            Chờ duyệt
            {pendingTotal > 0 && (
              <span
                className={`rounded-full px-1.5 text-[11px] font-semibold ${
                  filter === "pending" ? "bg-white/20 text-white" : "bg-rose-600 text-white"
                }`}
              >
                {pendingTotal}
              </span>
            )}
          </FilterTab>
          <FilterTab active={filter === "approved"} onClick={() => setFilter("approved")}>
            Đã duyệt
          </FilterTab>
          <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
            Tất cả
          </FilterTab>
        </div>

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
                <th className="px-4 py-3 font-semibold text-slate-900">Loại</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Dự kiến</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Số giờ</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Nội dung</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Trạng thái</th>
                <th className="w-44 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.requests.map((request) => (
                <tr key={request.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{request.user.name}</div>
                    <div className="text-xs text-slate-500">
                      {[request.user.employeeCode, request.user.employmentLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium tabular-nums text-slate-900">
                      {formatDayVN(request.date)}
                    </span>{" "}
                    <span className="text-slate-400">{weekdayLabel(request.date)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge tone="brand">{request.code}</Badge>
                    <span className="ml-1.5 text-xs text-slate-500">{request.rate}%</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-700">
                    {request.plannedStart}–{request.plannedEnd}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    <span className="font-semibold text-slate-900">
                      {formatOvertimeHours(request.minutes)}h
                    </span>
                    <div className="text-xs text-slate-500">
                      {request.approvedMinutes !== null
                        ? `admin chốt (chấm công ${formatOvertimeHours(request.computedMinutes)}h)`
                        : request.computedSource === "punches"
                          ? "theo chấm công"
                          : "theo dự kiến"}
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-700">
                    <span className="line-clamp-2" title={request.content}>
                      {request.content}
                    </span>
                    {request.place && (
                      <div className="text-xs text-slate-500">{request.place}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_BADGE[request.status].tone}>
                      {STATUS_BADGE[request.status].label}
                    </Badge>
                    {request.adminNote && (
                      <div className="mt-1 text-xs text-slate-500">{request.adminNote}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      {request.status !== "rejected" && (
                        <Button size="sm" onClick={() => open(request, "approve")}>
                          {request.status === "approved" ? "Sửa giờ" : "Duyệt"}
                        </Button>
                      )}
                      {request.status !== "rejected" && (
                        <Button variant="secondary" size="sm" onClick={() => open(request, "reject")}>
                          Từ chối
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title={
            filter === "pending"
              ? `Không có phiếu OT nào chờ duyệt trong ${formatMonthLabel(month)}`
              : `Chưa có phiếu OT nào trong ${formatMonthLabel(month)}`
          }
        />
      )}

      <Modal
        open={editing !== null}
        title={
          editing
            ? `${editing.action === "reject" ? "Từ chối" : editing.request.status === "approved" ? "Sửa giờ" : "Duyệt"} phiếu OT ngày ${formatDayVN(editing.request.date)}`
            : "Phiếu OT"
        }
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{editing.request.user.name}</span>{" "}
              · {editing.request.code} ({editing.request.rate}%) · dự kiến{" "}
              {editing.request.plannedStart}–{editing.request.plannedEnd}. Chấm công
              tính được{" "}
              <span className="font-medium text-slate-900">
                {formatOvertimeHours(editing.request.computedMinutes)}h
              </span>
              {editing.request.computedSource === "planned" &&
                " (thiếu giờ vào/ra nên lấy theo giờ dự kiến)"}
              .
            </p>
            {editing.action === "approve" && (
              <Field
                label="Số giờ chốt"
                hint="Bỏ trống = theo chấm công. Nhập số giờ (vd 2,5) nếu muốn chốt tay."
              >
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  placeholder={formatOvertimeHours(editing.request.computedMinutes)}
                  autoFocus
                />
              </Field>
            )}
            <Field
              label="Ghi chú cho nhân viên"
              hint="Không bắt buộc. Nhân viên thấy ghi chú này bên cạnh phiếu."
            >
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Huỷ
              </Button>
              <Button
                type="submit"
                variant={editing.action === "reject" ? "danger" : "primary"}
                disabled={acting}
              >
                {acting ? "Đang lưu..." : editing.action === "reject" ? "Từ chối" : "Lưu"}
              </Button>
            </div>
          </form>
        )}
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
        active ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}
