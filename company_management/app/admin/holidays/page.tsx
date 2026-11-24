"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
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
  swapOffDate: string | null;
  swapWorkDate: string | null;
};

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [swapOffDate, setSwapOffDate] = useState("");
  const [swapWorkDate, setSwapWorkDate] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const holidayRes = await fetch("/api/holidays");
      const data = await holidayRes.json();
      if (!holidayRes.ok) throw new Error(data.error);
      setHolidays(data.holidays);
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

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate: endDate || startDate,
          name,
          swapOffDate: swapOffDate || null,
          swapWorkDate: swapWorkDate || null,
        }),
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
      setSwapOffDate("");
      setSwapWorkDate("");
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

      {loading ? (
        <TableSkeleton />
      ) : holidays.length === 0 ? (
        <EmptyState title="Chưa có ngày lễ" />
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
                  <td className="px-4 py-3 text-slate-700">
                    {holiday.name}
                    {holiday.swapOffDate && holiday.swapWorkDate && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <ArrowLeftRight size={12} aria-hidden="true" />
                        Nghỉ {weekdayLabel(holiday.swapOffDate)} {holiday.swapOffDate}, làm bù{" "}
                        {weekdayLabel(holiday.swapWorkDate)} {holiday.swapWorkDate}
                      </div>
                    )}
                  </td>
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
              required
            />
          </Field>
          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-900">
              Hoán đổi ngày làm
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày nghỉ" required={Boolean(swapWorkDate)}>
                <Input
                  type="date"
                  value={swapOffDate}
                  onChange={(event) => setSwapOffDate(event.target.value)}
                  required={Boolean(swapWorkDate)}
                />
              </Field>
              <Field label="Ngày làm bù" required={Boolean(swapOffDate)}>
                <Input
                  type="date"
                  value={swapWorkDate}
                  onChange={(event) => setSwapWorkDate(event.target.value)}
                  required={Boolean(swapOffDate)}
                />
              </Field>
            </div>
          </fieldset>
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
