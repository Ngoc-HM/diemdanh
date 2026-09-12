"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import PageHeader from "../_components/page-header";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Message,
  Modal,
  TableSkeleton,
} from "@/app/_components/ui";
import { listDateRange, weekdayLabel } from "@/lib/datetime";

type Holiday = {
  id: string;
  date: string;
  startDate: string;
  endDate: string;
  name: string;
};

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
  { value: 0, label: "Chủ nhật" },
];

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [weeklyOff, setWeeklyOff] = useState<number[]>([0, 6]);
  const [savingWeeklyOff, setSavingWeeklyOff] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [holidayRes, weeklyOffRes] = await Promise.all([
        fetch("/api/holidays"),
        fetch("/api/settings/weekly-off"),
      ]);
      const data = await holidayRes.json();
      if (!holidayRes.ok) throw new Error(data.error);
      setHolidays(data.holidays);

      if (weeklyOffRes.ok) {
        const weekly = await weeklyOffRes.json();
        if (Array.isArray(weekly.days)) setWeeklyOff(weekly.days);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không tải được danh sách",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleWeeklyOff(day: number) {
    setWeeklyOff((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  }

  async function saveWeeklyOff() {
    setSavingWeeklyOff(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/weekly-off", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: weeklyOff }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể lưu");
      setWeeklyOff(data.days);
      setMessage({ type: "success", text: "Đã lưu ngày nghỉ hằng tuần" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    } finally {
      setSavingWeeklyOff(false);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate: endDate || startDate, name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể thêm");

      setHolidays((current) =>
        [...current, data.holiday].sort((a, b) =>
          a.startDate.localeCompare(b.startDate)
        )
      );
      setCreating(false);
      setStartDate("");
      setEndDate("");
      setName("");
      setMessage({
        type: "success",
        text:
          data.days > 1
            ? `Đã thêm "${data.holiday.name}" (${data.days} ngày)`
            : "Đã thêm ngày lễ",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể thêm",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(holiday: Holiday) {
    if (!confirm(`Xoá "${holiday.name}" (${rangeLabel(holiday)})?`)) return;
    const response = await fetch(`/api/holidays/${holiday.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setHolidays((current) => current.filter((item) => item.id !== holiday.id));
    } else {
      const data = await response.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Không thể xoá" });
    }
  }

  function rangeLabel(holiday: Holiday): string {
    return holiday.startDate === holiday.endDate
      ? holiday.startDate
      : `${holiday.startDate} → ${holiday.endDate}`;
  }

  function dayCount(holiday: Holiday): number {
    return listDateRange(holiday.startDate, holiday.endDate).length;
  }

  return (
    <>
      <PageHeader
        title="Ngày lễ"
        description="Ngày trong danh sách này không bị tính vắng dù nhân viên có lịch làm."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            Thêm ngày lễ
          </Button>
        }
      />

      {message && (
        <div className="mb-4">
          <Message type={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </Message>
        </div>
      )}

      <Card className="mb-6">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Ngày nghỉ hằng tuần
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Nhân viên toàn thời gian không bị xếp lịch vào các ngày này
            (mặc định Thứ 7 và Chủ nhật).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {WEEKDAY_OPTIONS.map((option) => {
              const active = weeklyOff.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleWeeklyOff(option.value)}
                  aria-pressed={active}
                  className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
            <Button
              size="sm"
              className="ml-auto"
              onClick={saveWeeklyOff}
              disabled={savingWeeklyOff}
            >
              {savingWeeklyOff ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <TableSkeleton />
      ) : holidays.length === 0 ? (
        <EmptyState
          title="Chưa khai báo ngày lễ nào"
          description="Thêm các ngày nghỉ lễ trong năm để báo cáo chấm công không đánh dấu vắng."
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-900">Ngày</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Thứ</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Tên</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {holidays.map((holiday) => (
                <tr key={holiday.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {rangeLabel(holiday)}
                    {dayCount(holiday) > 1 && (
                      <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {dayCount(holiday)} ngày
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {weekdayLabel(holiday.startDate)}
                    {holiday.startDate !== holiday.endDate &&
                      ` → ${weekdayLabel(holiday.endDate)}`}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{holiday.name}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => remove(holiday)}
                      aria-label={`Xoá ${holiday.name}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={creating}
        title="Thêm ngày lễ"
        onClose={() => setCreating(false)}
      >
        <form id="holiday-form" onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Từ ngày" required>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (!endDate || endDate < event.target.value) {
                    setEndDate(event.target.value);
                  }
                }}
                required
              />
            </Field>
            <Field label="Đến ngày" required>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Tên ngày lễ" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tết Nguyên đán"
              required
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreating(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Thêm"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
