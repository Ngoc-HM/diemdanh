"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Badge, Button, Card, Message } from "@/app/_components/ui";
import {
  addMonths,
  formatMonthLabel,
  monthKeyVN,
  weekdayLabel,
} from "@/lib/datetime";

type SessionRule = {
  id: string;
  code: string;
  name: string;
  workStart: string;
  workEnd: string;
  minHours: number;
};

type Payload = {
  month: string;
  employmentType: string;
  selfScheduled: boolean;
  canEdit: boolean;
  openMonth: string | null;
  window: { opensOn: string; closesOn: string };
  sessions: SessionRule[];
  dates: string[];
  days: Record<string, string[]>;
};

export default function SchedulePage() {
  const [month, setMonth] = useState(() => addMonths(monthKeyVN(), 1));
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/schedule?month=${target}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được lịch");
      setData(payload);
      setDraft(payload.days);
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

  function toggle(date: string, sessionId: string) {
    if (!data?.canEdit) return;
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
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, days: draft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể lưu");

      setMessage({
        type: "success",
        text: `Đã lưu lịch ${formatMonthLabel(month)} — ${result.savedDays} ca`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    } finally {
      setSaving(false);
    }
  }

  const totalShifts = Object.values(draft).reduce(
    (sum, ids) => sum + ids.length,
    0
  );
  const plannedHours =
    data?.sessions && totalShifts > 0
      ? Object.values(draft)
          .flat()
          .reduce((sum, id) => {
            const rule = data.sessions.find((item) => item.id === id);
            return sum + (rule?.minHours ?? 0);
          }, 0)
      : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Đăng ký lịch làm việc</h1>
        <p className="mt-1 text-sm text-slate-600">
          Chọn các ca bạn sẽ làm trong từng ngày của tháng.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
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
        <Message type={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </Message>
      )}

      {loading ? (
        <div className="h-96 animate-pulse rounded-xl bg-slate-200" aria-hidden="true" />
      ) : data ? (
        !data.selfScheduled ? (
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <CalendarDays
                size={20}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-sky-600"
              />
              <div>
                <p className="font-medium text-slate-900">
                  Lịch của bạn là lịch cố định
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Nhân viên toàn thời gian làm từ thứ Hai đến thứ Sáu, hệ thống tự
                  gán ca nên bạn không cần đăng ký. Xem lịch cụ thể ở mục Lịch sử.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {!data.canEdit && (
              <Message type="info">
                Ngoài hạn đăng ký cho {formatMonthLabel(month)}. Lịch tháng này chỉ
                nhận từ {data.window.opensOn} đến {data.window.closesOn}.
                {data.openMonth && (
                  <>
                    {" "}
                    Hiện đang mở đăng ký cho {formatMonthLabel(data.openMonth)}.{" "}
                    <button
                      className="font-medium underline"
                      onClick={() => setMonth(data.openMonth!)}
                    >
                      Chuyển sang tháng đó
                    </button>
                  </>
                )}
              </Message>
            )}

            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  Đã chọn{" "}
                  <span className="font-semibold text-slate-900">{totalShifts}</span> ca
                  {plannedHours > 0 && (
                    <>
                      {" "}
                      · dự kiến{" "}
                      <span className="font-semibold text-slate-900">
                        {Math.round(plannedHours * 10) / 10}h
                      </span>
                    </>
                  )}
                </div>
                <Button onClick={save} disabled={!data.canEdit || saving}>
                  <Save size={16} aria-hidden="true" />
                  {saving ? "Đang lưu..." : "Lưu lịch"}
                </Button>
              </div>
            </Card>

            <Card className="divide-y divide-slate-100">
              {data.dates.map((date) => {
                const selected = draft[date] ?? [];
                const weekend = ["T7", "CN"].includes(weekdayLabel(date));
                return (
                  <div
                    key={date}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="w-24 shrink-0 text-sm">
                      <span className="font-medium text-slate-900">
                        {date.slice(8, 10)}/{date.slice(5, 7)}
                      </span>{" "}
                      <span className={weekend ? "text-rose-600" : "text-slate-400"}>
                        {weekdayLabel(date)}
                      </span>
                    </span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {data.sessions.map((rule) => {
                        const active = selected.includes(rule.id);
                        return (
                          <button
                            key={rule.id}
                            type="button"
                            onClick={() => toggle(date, rule.id)}
                            aria-pressed={active}
                            disabled={!data.canEdit}
                            title={`${rule.name} ${rule.workStart}–${rule.workEnd}`}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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
            </Card>

            <Card className="p-4">
              <p className="mb-2 text-sm font-medium text-slate-900">Chú thích ca</p>
              <div className="flex flex-wrap gap-2">
                {data.sessions.map((rule) => (
                  <Badge key={rule.id}>
                    {rule.code} · {rule.name} {rule.workStart}–{rule.workEnd} (
                    {rule.minHours}h)
                  </Badge>
                ))}
              </div>
            </Card>
          </>
        )
      ) : null}
    </div>
  );
}
