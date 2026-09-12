"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
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
  formatMonthLabel,
  monthKeyVN,
  weekdayLabel,
} from "@/lib/datetime";
import {
  DEFAULT_REGISTRATION_WINDOW,
  MAX_REGISTRATION_DAY,
  RegistrationWindowConfig,
  toggleSessionSelection,
  validateRegistrationWindow,
} from "@/lib/schedule";

type SessionRule = {
  id: string;
  code: string;
  name: string;
  workStart: string;
  workEnd: string;
  minHours: number;
};

type LeaveCode = "N" | "O";

type Row = {
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    employmentType: string;
  };
  selfScheduled: boolean;
  /// part-time/intern: đã nộp lịch; full-time: admin đã xếp riêng tháng này.
  registered: boolean;
  days: Record<string, string[]>;
  leaves: Record<string, LeaveCode>;
  /// Ngày đang có yêu cầu đổi ca chờ duyệt.
  pendingDates: string[];
  /// Ngày đã qua, có ca mà không bấm giờ.
  absentDates: string[];
  /// Ngày không có ca nhưng có bấm giờ — vẫn tính công.
  unscheduledDates: string[];
  totalShifts: number;
  plannedHours: number;
};

const LEAVE_LABELS: Record<LeaveCode, string> = { N: "Nghỉ", O: "Ốm" };

/// Mô tả cách vẽ một ô ngày trong lưới lịch. Thứ tự ưu tiên: vắng (lỗi thật)
/// > chờ duyệt (đang treo) > làm ngoài lịch > có ca > nghỉ/ốm > trống.
function scheduleCell(
  row: Row,
  date: string
): { text: string; className: string; title: string | undefined } {
  const codes = row.days[date];
  const leave = row.leaves[date];
  const text = codes ? codes.join("+") : (leave ?? "");

  if (row.absentDates.includes(date)) {
    return {
      text,
      className: "bg-rose-100 text-rose-700",
      title: "Có lịch nhưng không chấm công",
    };
  }
  if (row.pendingDates.includes(date)) {
    return {
      text,
      className: "bg-amber-100 text-amber-800",
      title: "Đang chờ duyệt đổi ca",
    };
  }
  if (!codes && row.unscheduledDates.includes(date)) {
    return {
      text: "NL",
      className: "bg-amber-100 text-amber-800",
      title: "Đi làm không đăng ký lịch, vẫn tính công",
    };
  }
  if (codes) return { text, className: "bg-sky-50 text-sky-700", title: undefined };
  if (leave) {
    return {
      text,
      className: "bg-amber-50 text-amber-700",
      title: LEAVE_LABELS[leave],
    };
  }
  return { text, className: "text-slate-300", title: undefined };
}

const SCHEDULE_LEGEND = [
  { className: "bg-sky-50 ring-1 ring-sky-200", label: "Có ca" },
  { className: "bg-amber-50 ring-1 ring-amber-200", label: "Nghỉ / ốm đã đánh dấu" },
  { className: "bg-amber-100", label: "Chờ duyệt đổi ca hoặc làm ngoài lịch (NL)" },
  { className: "bg-rose-100", label: "Có lịch mà không đi" },
];

type Payload = {
  month: string;
  dates: string[];
  sessions: SessionRule[];
  holidays: Record<string, string>;
  rows: Row[];
};

export default function AdminSchedulesPage() {
  const [month, setMonth] = useState(() => addMonths(monthKeyVN(), 1));
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  // Cửa sổ đăng ký lịch tháng sau (Settings schedule_registration_window).
  const [registrationWindow, setRegistrationWindow] =
    useState<RegistrationWindowConfig>(DEFAULT_REGISTRATION_WINDOW);
  const [windowDraft, setWindowDraft] = useState({ openDay: "", closeDay: "" });
  const [savingWindow, setSavingWindow] = useState(false);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/schedules?month=${target}`);
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
    load(month);
  }, [month, load]);

  useEffect(() => {
    fetch("/api/settings/schedule-window")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload) return;
        setRegistrationWindow(payload);
        setWindowDraft({
          openDay: String(payload.openDay),
          closeDay: String(payload.closeDay),
        });
      })
      .catch(() => undefined);
  }, []);

  /// Lưu cửa sổ đăng ký. Kiểm tra ngay ở client bằng đúng hàm API dùng, để
  /// nhập sai thì báo liền thay vì đợi 400.
  async function saveWindow(event: React.FormEvent) {
    event.preventDefault();
    const config = {
      openDay: Number(windowDraft.openDay),
      closeDay: Number(windowDraft.closeDay),
    };
    const invalid = validateRegistrationWindow(config);
    if (invalid) {
      setMessage({ type: "error", text: invalid });
      return;
    }

    setSavingWindow(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/schedule-window", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      setRegistrationWindow(payload);
      setMessage({
        type: "success",
        text: `Đã lưu: nhân viên đăng ký lịch tháng sau từ ngày ${payload.openDay} đến hết ngày ${payload.closeDay}`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không lưu được",
      });
    } finally {
      setSavingWindow(false);
    }
  }

  function openEdit(row: Row) {
    if (!data) return;
    setEditingRow(row);
    // days đang lưu theo mã ca, đổi lại thành id để form thao tác.
    const codeToId = new Map(data.sessions.map((rule) => [rule.code, rule.id]));
    const next: Record<string, string[]> = {};
    for (const [date, codes] of Object.entries(row.days)) {
      next[date] = codes
        .map((code) => codeToId.get(code))
        .filter((id): id is string => Boolean(id));
    }
    setDraft(next);
  }

  /// Cùng quy tắc với lưới của nhân viên: CN loại trừ S/C, T cộng thêm.
  function toggle(date: string, sessionId: string) {
    if (!data) return;
    const codeById = new Map(data.sessions.map((rule) => [rule.id, rule.code]));
    setDraft((current) => {
      const next = toggleSessionSelection(current[date] ?? [], sessionId, codeById);
      const copy = { ...current };
      if (next.length === 0) delete copy[date];
      else copy[date] = next;
      return copy;
    });
  }

  async function save() {
    if (!editingRow) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingRow.user.id, month, days: draft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể lưu");

      setEditingRow(null);
      setMessage({
        type: "success",
        text: `Đã lưu lịch cho ${editingRow.user.name}`,
      });
      load(month);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    } finally {
      setSaving(false);
    }
  }

  const pending = data?.rows.filter(
    (row) => row.selfScheduled && !row.registered
  );

  return (
    <>
      <PageHeader
        title="Lịch làm việc"
        description={`Nhân viên bán thời gian và thực tập đăng ký lịch tháng sau từ ngày ${registrationWindow.openDay} đến hết ngày ${registrationWindow.closeDay} của tháng trước đó. Nhân viên toàn thời gian dùng lịch cố định theo ngày làm việc trong tuần. Admin sửa được lịch của mọi nhân viên bất cứ lúc nào.`}
      />

      <Card className="mb-6 p-5">
        <form onSubmit={saveWindow} className="flex flex-wrap items-end gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Cửa sổ đăng ký lịch tháng sau
            </h3>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Tính theo ngày của tháng trước đó. Ngày {MAX_REGISTRATION_DAY} nghĩa
              là hết tháng; tháng ngắn hơn thì hệ thống tự lùi về ngày cuối tháng.
              Chỉ áp cho bán thời gian và thực tập — toàn thời gian không đăng ký.
            </p>
          </div>
          <Field label="Mở từ ngày" required>
            <Input
              type="number"
              min={1}
              max={MAX_REGISTRATION_DAY}
              className="w-24"
              value={windowDraft.openDay}
              onChange={(event) =>
                setWindowDraft({ ...windowDraft, openDay: event.target.value })
              }
              required
            />
          </Field>
          <Field label="Đến hết ngày" required>
            <Input
              type="number"
              min={1}
              max={MAX_REGISTRATION_DAY}
              className="w-24"
              value={windowDraft.closeDay}
              onChange={(event) =>
                setWindowDraft({ ...windowDraft, closeDay: event.target.value })
              }
              required
            />
          </Field>
          <Button type="submit" disabled={savingWindow}>
            {savingWindow ? "Đang lưu..." : "Lưu cửa sổ"}
          </Button>
        </form>
      </Card>

      <div className="mb-6 flex items-center justify-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Tháng trước"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Button>
        <span className="min-w-40 text-center text-base font-semibold text-slate-900">
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

      {message && (
        <div className="mb-4">
          <Message type={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </Message>
        </div>
      )}

      {pending && pending.length > 0 && (
        <div className="mb-4">
          <Message type="info">
            {pending.length} nhân viên chưa đăng ký lịch tháng này:{" "}
            {pending.map((row) => row.user.name).join(", ")}
          </Message>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {SCHEDULE_LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={`h-3.5 w-3.5 rounded-sm ${item.className}`} />
            <span className="text-slate-600">{item.label}</span>
          </span>
        ))}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          title="Chưa có nhân viên đang hoạt động"
          description="Thêm nhân viên ở mục Nhân viên trước khi xếp lịch."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 z-10 min-w-[190px] bg-slate-50 px-3 py-2 text-left font-semibold text-slate-900">
                  Nhân viên
                </th>
                {data.dates.map((date) => (
                  <th
                    key={date}
                    title={data.holidays[date]}
                    className={`min-w-[30px] px-1 py-2 text-center font-medium ${
                      date in data.holidays ? "text-sky-700" : "text-slate-500"
                    }`}
                  >
                    <div>{date.slice(8, 10)}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      {weekdayLabel(date)}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold text-slate-900">
                  Ca
                </th>
                <th className="px-2 py-2 text-center font-semibold text-slate-900">
                  Giờ dự kiến
                </th>
                <th className="w-14 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.user.id} className="border-b border-slate-100 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2">
                    <div className="font-medium text-slate-900">{row.user.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {row.selfScheduled ? (
                        row.registered ? (
                          <Badge tone="success">Đã đăng ký</Badge>
                        ) : (
                          <Badge tone="warning">Chưa đăng ký</Badge>
                        )
                      ) : row.registered ? (
                        <Badge tone="warning">Admin xếp riêng</Badge>
                      ) : (
                        <Badge tone="brand">Cố định</Badge>
                      )}
                    </div>
                  </td>
                  {data.dates.map((date) => {
                    const cell = scheduleCell(row, date);
                    return (
                      <td
                        key={date}
                        title={cell.title}
                        className={`px-1 py-2 text-center font-medium ${cell.className}`}
                      >
                        {cell.text}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-semibold text-slate-900">
                    {row.totalShifts}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-700">
                    {row.plannedHours}h
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(row)}
                      aria-label={`Sửa lịch của ${row.user.name}`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={editingRow !== null}
        title={`Lịch ${formatMonthLabel(month)} — ${editingRow?.user.name ?? ""}`}
        onClose={() => setEditingRow(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingRow(null)}>
              Huỷ
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu lịch"}
            </Button>
          </>
        }
      >
        {data && editingRow && (
          <div className="space-y-1">
            <p className="mb-3 flex items-start gap-2 text-sm text-slate-600">
              <CalendarClock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                Admin sửa được lịch bất cứ lúc nào, không phụ thuộc cửa sổ đăng ký.
                {!editingRow.selfScheduled &&
                  " Với nhân viên toàn thời gian, lịch lưu ở đây thay cho lịch cố định của tháng này."}{" "}
                Ngày đang nghỉ/ốm mà được gán ca thì đánh dấu nghỉ sẽ được gỡ.
              </span>
            </p>
            {data.dates.map((date) => {
              const leave = editingRow.leaves[date];
              const hasSessions = (draft[date] ?? []).length > 0;
              return (
                <div
                  key={date}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 odd:bg-slate-50"
                >
                  <span className="flex w-32 shrink-0 items-center gap-2 text-sm text-slate-700">
                    <span>
                      {date.slice(8, 10)}/{date.slice(5, 7)}{" "}
                      <span className="text-slate-400">{weekdayLabel(date)}</span>
                    </span>
                    {leave && !hasSessions && (
                      <Badge tone="warning">{leave}</Badge>
                    )}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {data.sessions.map((rule) => {
                      const active = (draft[date] ?? []).includes(rule.id);
                      return (
                        <button
                          key={rule.id}
                          type="button"
                          onClick={() => toggle(date, rule.id)}
                          aria-pressed={active}
                          title={`${rule.name} ${rule.workStart}–${rule.workEnd}`}
                          className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                            active
                              ? "bg-sky-600 text-white"
                              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {rule.code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
