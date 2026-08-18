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
import { weekdayLabel } from "@/lib/datetime";

type Holiday = { id: string; date: string; name: string };

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/holidays");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
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
        body: JSON.stringify({ date, name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể thêm");

      setHolidays((current) =>
        [...current, data.holiday].sort((a, b) => a.date.localeCompare(b.date))
      );
      setCreating(false);
      setDate("");
      setName("");
      setMessage({ type: "success", text: "Đã thêm ngày lễ" });
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
    if (!confirm(`Xoá "${holiday.name}" ngày ${holiday.date}?`)) return;
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
                    {holiday.date}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {weekdayLabel(holiday.date)}
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
          <Field label="Ngày" required>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </Field>
          <Field label="Tên ngày lễ" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Quốc khánh"
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
