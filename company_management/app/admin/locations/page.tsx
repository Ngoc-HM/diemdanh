"use client";

import { useEffect, useState } from "react";
import { Crosshair, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
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

type Location = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
};

const EMPTY_FORM = {
  name: "",
  latitude: "",
  longitude: "",
  radius: "100",
  isActive: true,
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Location | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/locations");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLocations(data.locations);
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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(location: Location) {
    setEditing(location);
    setForm({
      name: location.name,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      radius: String(location.radius),
      isActive: location.isActive,
    });
    setOpen(true);
  }

  function useCurrentPosition() {
    if (!navigator.geolocation) {
      setMessage({ type: "error", text: "Trình duyệt không hỗ trợ định vị" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      (error) => {
        setMessage({ type: "error", text: `Không lấy được vị trí: ${error.message}` });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        editing ? `/api/locations/${editing.id}` : "/api/locations",
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
        text: editing ? "Đã cập nhật vị trí" : "Đã thêm vị trí",
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

  async function remove(location: Location) {
    if (!confirm(`Xoá vị trí "${location.name}"?`)) return;
    const response = await fetch(`/api/locations/${location.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setLocations((current) => current.filter((item) => item.id !== location.id));
    } else {
      const data = await response.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Không thể xoá" });
    }
  }

  return (
    <>
      <PageHeader
        title="Vị trí làm việc"
        description="Nhân viên chỉ chấm công được khi đứng trong bán kính của một vị trí đang bật."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} aria-hidden="true" />
            Thêm vị trí
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
      ) : locations.length === 0 ? (
        <EmptyState
          title="Chưa có vị trí làm việc"
          description="Nhân viên chưa thể chấm công cho tới khi có ít nhất một vị trí đang hoạt động."
          action={
            <Button onClick={openCreate}>
              <MapPin size={16} aria-hidden="true" />
              Thêm vị trí đầu tiên
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-900">Tên</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Toạ độ</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Bán kính</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Trạng thái</th>
                <th className="w-32 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {location.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{location.radius} m</td>
                  <td className="px-4 py-3">
                    {location.isActive ? (
                      <Badge tone="success">Đang bật</Badge>
                    ) : (
                      <Badge>Đã tắt</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(location)}
                        aria-label={`Sửa ${location.name}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => remove(location)}
                        aria-label={`Xoá ${location.name}`}
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
        title={editing ? "Sửa vị trí" : "Thêm vị trí"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Tên vị trí" required>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Văn phòng Hà Nội"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vĩ độ" required>
              <Input
                value={form.latitude}
                onChange={(event) =>
                  setForm({ ...form, latitude: event.target.value })
                }
                placeholder="21.028511"
                required
              />
            </Field>
            <Field label="Kinh độ" required>
              <Input
                value={form.longitude}
                onChange={(event) =>
                  setForm({ ...form, longitude: event.target.value })
                }
                placeholder="105.804817"
                required
              />
            </Field>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={useCurrentPosition}
            disabled={locating}
          >
            <Crosshair size={16} aria-hidden="true" />
            {locating ? "Đang lấy vị trí..." : "Lấy toạ độ hiện tại"}
          </Button>

          <Field label="Bán kính cho phép (m)" required hint="Từ 10m đến 5000m">
            <Input
              type="number"
              min={10}
              max={5000}
              value={form.radius}
              onChange={(event) => setForm({ ...form, radius: event.target.value })}
              required
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm({ ...form, isActive: event.target.checked })
              }
              className="h-4 w-4 rounded-sm border-slate-300 text-sky-600"
            />
            Đang hoạt động
          </label>

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
