"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Wand2 } from "lucide-react";
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

type WorkSession = {
  id: string;
  code: string;
  name: string;
  checkInStart: string;
  checkInEnd: string;
  workStart: string;
  workEnd: string;
  minHours: number;
  sortOrder: number;
  isActive: boolean;
  isDefaultFull: boolean;
};

const EMPTY_FORM = {
  code: "",
  name: "",
  checkInStart: "07:00",
  checkInEnd: "09:00",
  workStart: "08:00",
  workEnd: "17:00",
  minHours: "8",
  sortOrder: "1",
  isActive: true,
  isDefaultFull: false,
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkSession | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/work-sessions");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSessions(data.sessions);
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

  async function seedDefaults() {
    const response = await fetch("/api/admin/work-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage({ type: "error", text: data.error || "Không thể tạo" });
      return;
    }
    setSessions(data.sessions);
    setMessage({ type: "success", text: "Đã tạo bộ ca mặc định" });
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sortOrder: String(sessions.length + 1) });
    setOpen(true);
  }

  function openEdit(session: WorkSession) {
    setEditing(session);
    setForm({
      code: session.code,
      name: session.name,
      checkInStart: session.checkInStart,
      checkInEnd: session.checkInEnd,
      workStart: session.workStart,
      workEnd: session.workEnd,
      minHours: String(session.minHours),
      sortOrder: String(session.sortOrder),
      isActive: session.isActive,
      isDefaultFull: session.isDefaultFull,
    });
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        editing
          ? `/api/admin/work-sessions/${editing.id}`
          : "/api/admin/work-sessions",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể lưu");

      setOpen(false);
      setMessage({ type: "success", text: editing ? "Đã cập nhật ca" : "Đã thêm ca" });
      load();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(session: WorkSession) {
    if (!confirm(`Xoá ca "${session.name}"?`)) return;
    const response = await fetch(`/api/admin/work-sessions/${session.id}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setSessions((current) => current.filter((item) => item.id !== session.id));
    } else {
      setMessage({ type: "error", text: data.error || "Không thể xoá" });
    }
  }

  return (
    <>
      <PageHeader
        title="Ca làm việc"
        description="Ca là đơn vị để nhân viên đăng ký lịch và để hệ thống tính đủ công."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} aria-hidden="true" />
            Thêm ca
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
      ) : sessions.length === 0 ? (
        <EmptyState
          title="Chưa có ca làm việc"
          description="Tạo bộ ca mặc định (Sáng, Chiều, Tăng ca, Hành chính) rồi chỉnh lại cho đúng công ty."
          action={
            <Button onClick={seedDefaults}>
              <Wand2 size={16} aria-hidden="true" />
              Tạo bộ ca mặc định
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-900">Mã</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Tên ca</th>
                <th className="px-4 py-3 font-semibold text-slate-900">
                  Nhận check-in
                </th>
                <th className="px-4 py-3 font-semibold text-slate-900">Giờ làm</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Tối thiểu</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Trạng thái</th>
                <th className="w-32 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <Badge tone="brand">{session.code}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {session.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {session.checkInStart}–{session.checkInEnd}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {session.workStart}–{session.workEnd}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{session.minHours}h</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {session.isActive ? (
                        <Badge tone="success">Đang dùng</Badge>
                      ) : (
                        <Badge>Đã tắt</Badge>
                      )}
                      {session.isDefaultFull && (
                        <Badge tone="brand">Mặc định full-time</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(session)}
                        aria-label={`Sửa ${session.name}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => remove(session)}
                        aria-label={`Xoá ${session.name}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={open}
        title={editing ? "Sửa ca làm việc" : "Thêm ca làm việc"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mã ca" required hint="Tối đa 8 ký tự, hiện trên bảng công">
              <Input
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value.toUpperCase() })
                }
                maxLength={8}
                placeholder="S"
                required
              />
            </Field>
            <Field label="Thứ tự" required>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm({ ...form, sortOrder: event.target.value })
                }
                required
              />
            </Field>
          </div>

          <Field label="Tên ca" required>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ca sáng"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nhận check-in từ" required>
              <Input
                type="time"
                value={form.checkInStart}
                onChange={(event) =>
                  setForm({ ...form, checkInStart: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Đến" required>
              <Input
                type="time"
                value={form.checkInEnd}
                onChange={(event) =>
                  setForm({ ...form, checkInEnd: event.target.value })
                }
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Giờ vào ca" required hint="Dùng để tính đi muộn">
              <Input
                type="time"
                value={form.workStart}
                onChange={(event) =>
                  setForm({ ...form, workStart: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Giờ tan ca" required>
              <Input
                type="time"
                value={form.workEnd}
                onChange={(event) =>
                  setForm({ ...form, workEnd: event.target.value })
                }
                required
              />
            </Field>
          </div>

          <Field label="Số giờ tối thiểu để tính đủ công" required>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={form.minHours}
              onChange={(event) => setForm({ ...form, minHours: event.target.value })}
              required
            />
          </Field>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
                className="h-4 w-4 rounded-sm border-slate-300 text-sky-600"
              />
              Đang dùng
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isDefaultFull}
                onChange={(event) =>
                  setForm({ ...form, isDefaultFull: event.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-sky-600"
              />
              <span>
                Ca mặc định cho nhân viên toàn thời gian
                <span className="mt-0.5 block text-xs text-slate-500">
                  Hệ thống gán ca này cho mọi ngày T2–T6. Chỉ một ca được đánh dấu.
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
