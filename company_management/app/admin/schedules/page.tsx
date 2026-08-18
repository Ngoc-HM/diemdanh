"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import PageHeader from "../_components/page-header";
import {
  Badge,
  Button,
  Card,
  EmptyState,
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
import { REGISTRATION_OPEN_DAY } from "@/lib/schedule";

type SessionRule = {
  id: string;
  code: string;
  name: string;
  workStart: string;
  workEnd: string;
  minHours: number;
};

type Row = {
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    employmentType: string;
  };
  selfScheduled: boolean;
  registered: boolean;
  days: Record<string, string[]>;
  totalShifts: number;
  plannedHours: number;
};

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

  function toggle(date: string, sessionId: string) {
    setDraft((current) => {
      const existing = current[date] ?? [];
      const next = existing.includes(sessionId)
        ? existing.filter((id) => id !== sessionId)
        : [...existing, sessionId];
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
        description={`Nhân viên bán thời gian và thực tập đăng ký lịch tháng sau từ ngày ${REGISTRATION_OPEN_DAY} đến hết tháng. Nhân viên toàn thời gian dùng lịch cố định T2–T6.`}
      />

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
                      ) : (
                        <Badge tone="brand">Cố định T2–T6</Badge>
                      )}
                    </div>
                  </td>
                  {data.dates.map((date) => {
                    const codes = row.days[date];
                    return (
                      <td
                        key={date}
                        className={`px-1 py-2 text-center font-medium ${
                          codes
                            ? "bg-sky-50 text-sky-700"
                            : "text-slate-300"
                        }`}
                      >
                        {codes ? codes.join("+") : ""}
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
                    {row.selfScheduled && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(row)}
                        aria-label={`Sửa lịch của ${row.user.name}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </Button>
                    )}
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
        {data && (
          <div className="space-y-1">
            <p className="mb-3 flex items-start gap-2 text-sm text-slate-600">
              <CalendarClock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              Admin sửa được lịch kể cả khi đã đóng cửa sổ đăng ký của nhân viên.
            </p>
            {data.dates.map((date) => (
              <div
                key={date}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 odd:bg-slate-50"
              >
                <span className="w-24 shrink-0 text-sm text-slate-700">
                  {date.slice(8, 10)}/{date.slice(5, 7)}{" "}
                  <span className="text-slate-400">{weekdayLabel(date)}</span>
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
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
