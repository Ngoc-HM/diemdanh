"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarSearch, KeyRound, Pencil, Plus, UserMinus } from "lucide-react";
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
  Select,
  TableSkeleton,
} from "@/app/_components/ui";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EmploymentType,
} from "@/lib/schedule";

type Employee = {
  id: string;
  employeeCode: string | null;
  name: string;
  email: string;
  employmentType: EmploymentType;
  phone: string | null;
  department: string | null;
  position: string | null;
  startDate: string | null;
  isActive: boolean;
};

const EMPTY_FORM = {
  employeeCode: "",
  name: "",
  email: "",
  password: "",
  employmentType: "full_time" as EmploymentType,
  phone: "",
  department: "",
  position: "",
  startDate: "",
  isActive: true,
};

export default function UsersPage() {
  const [users, setUsers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/users?includeInactive=${includeInactive}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUsers(data.users);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(user: Employee) {
    setEditing(user);
    setForm({
      employeeCode: user.employeeCode ?? "",
      name: user.name,
      email: user.email,
      password: "",
      employmentType: user.employmentType,
      phone: user.phone ?? "",
      department: user.department ?? "",
      position: user.position ?? "",
      startDate: user.startDate ? user.startDate.slice(0, 10) : "",
      isActive: user.isActive,
    });
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        editing ? `/api/users/${editing.id}` : "/api/users",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể lưu");

      setOpen(false);
      setMessage({
        type: "success",
        text: editing ? "Đã cập nhật nhân viên" : "Đã thêm nhân viên",
      });
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

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!resetting) return;
    try {
      const response = await fetch(`/api/users/${resetting.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể đặt lại");

      setResetting(null);
      setNewPassword("");
      setMessage({
        type: "success",
        text: `Đã đặt lại mật khẩu cho ${resetting.name}`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể đặt lại",
      });
    }
  }

  async function deactivate(user: Employee) {
    if (
      !confirm(
        `Ngừng hoạt động tài khoản của ${user.name}? Lịch sử chấm công vẫn được giữ lại.`
      )
    ) {
      return;
    }
    const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage({ type: "error", text: data.error || "Không thể thực hiện" });
      return;
    }
    setMessage({ type: "success", text: `Đã ngừng hoạt động ${user.name}` });
    load();
  }

  return (
    <>
      <PageHeader
        title="Nhân viên"
        description="Hồ sơ nhân viên và loại hợp đồng. Loại hợp đồng quyết định cách đăng ký lịch làm việc."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} aria-hidden="true" />
            Thêm nhân viên
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

      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={(event) => setIncludeInactive(event.target.checked)}
          className="h-4 w-4 rounded-sm border-slate-300 text-sky-600"
        />
        Hiện cả nhân viên đã ngừng hoạt động
      </label>

      {loading ? (
        <TableSkeleton />
      ) : users.length === 0 ? (
        <EmptyState
          title="Chưa có nhân viên"
          description="Thêm nhân viên để họ có thể đăng nhập và chấm công."
          action={
            <Button onClick={openCreate}>
              <Plus size={16} aria-hidden="true" />
              Thêm nhân viên
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-900">Mã</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Nhân viên</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Hợp đồng</th>
                <th className="px-4 py-3 font-semibold text-slate-900">
                  Phòng ban / Chức vụ
                </th>
                <th className="px-4 py-3 font-semibold text-slate-900">Liên hệ</th>
                <th className="w-44 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {user.employeeCode || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                    {!user.isActive && (
                      <div className="mt-1">
                        <Badge tone="danger">Đã ngừng</Badge>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={user.employmentType === "full_time" ? "brand" : "neutral"}
                    >
                      {EMPLOYMENT_TYPE_LABELS[user.employmentType]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{user.department || "—"}</div>
                    <div className="text-xs text-slate-500">
                      {user.position || ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/attendance/user/${user.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        aria-label={`Xem chấm công của ${user.name}`}
                      >
                        <CalendarSearch size={14} aria-hidden="true" />
                      </Link>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(user)}
                        aria-label={`Sửa ${user.name}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setResetting(user)}
                        aria-label={`Đặt lại mật khẩu cho ${user.name}`}
                      >
                        <KeyRound size={14} aria-hidden="true" />
                      </Button>
                      {user.isActive && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deactivate(user)}
                          aria-label={`Ngừng hoạt động ${user.name}`}
                        >
                          <UserMinus size={14} aria-hidden="true" />
                        </Button>
                      )}
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
        title={editing ? "Sửa hồ sơ nhân viên" : "Thêm nhân viên"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mã nhân viên">
              <Input
                value={form.employeeCode}
                onChange={(event) =>
                  setForm({ ...form, employeeCode: event.target.value })
                }
                placeholder="NV001"
              />
            </Field>
            <Field label="Loại hợp đồng" required>
              <Select
                value={form.employmentType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    employmentType: event.target.value as EmploymentType,
                  })
                }
              >
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EMPLOYMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Họ và tên" required>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </Field>

          <Field label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </Field>

          {!editing && (
            <Field label="Mật khẩu" required hint="Ít nhất 6 ký tự">
              <Input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                minLength={6}
                required
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phòng ban">
              <Input
                value={form.department}
                onChange={(event) =>
                  setForm({ ...form, department: event.target.value })
                }
                placeholder="Kỹ thuật"
              />
            </Field>
            <Field label="Chức vụ">
              <Input
                value={form.position}
                onChange={(event) =>
                  setForm({ ...form, position: event.target.value })
                }
                placeholder="Lập trình viên"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Số điện thoại">
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
            <Field label="Ngày vào làm">
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm({ ...form, startDate: event.target.value })
                }
              />
            </Field>
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
                className="h-4 w-4 rounded-sm border-slate-300 text-sky-600"
              />
              Đang làm việc
            </label>
          )}

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

      <Modal
        open={resetting !== null}
        title={`Đặt lại mật khẩu — ${resetting?.name ?? ""}`}
        onClose={() => setResetting(null)}
      >
        <form onSubmit={resetPassword} className="space-y-4">
          <Field label="Mật khẩu mới" required hint="Ít nhất 6 ký tự">
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResetting(null)}
            >
              Huỷ
            </Button>
            <Button type="submit">Đặt lại</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
