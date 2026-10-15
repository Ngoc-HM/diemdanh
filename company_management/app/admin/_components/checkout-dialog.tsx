"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Message, Modal } from "@/app/_components/ui";

export type CheckoutTarget = {
  userId: string;
  userName: string;
  /// "YYYY-MM-DD"
  date: string;
  /// Giờ vào đang mở, "HH:MM" — để hiện cho admin đối chiếu, có thể không biết.
  checkInAt: string | null;
};

function shortDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/// Hộp bổ sung giờ ra cho một ngày quên checkout, mở ngay tại trang admin đang
/// xem (trang Quên checkout, bảng chấm công tháng, chi tiết nhân viên).
export default function CheckoutDialog({
  target,
  onClose,
  onSaved,
}: {
  target: CheckoutTarget | null;
  onClose: () => void;
  onSaved: (target: CheckoutTarget, time: string) => void;
}) {
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setTime("");
    setNote("Quên checkout");
    setError(null);
  }, [target]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/attendance/missed-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: target.userId,
          date: target.date,
          time,
          note,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      onSaved(target, time);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={target !== null} title="Bổ sung giờ ra" onClose={onClose}>
      {target && (
        <form onSubmit={save} className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Nhân viên</dt>
            <dd className="font-medium text-slate-900">{target.userName}</dd>
            <dt className="text-slate-500">Ngày</dt>
            <dd className="font-medium tabular-nums text-slate-900">
              {shortDate(target.date)}
            </dd>
            {target.checkInAt && (
              <>
                <dt className="text-slate-500">Giờ vào</dt>
                <dd className="font-medium tabular-nums text-slate-900">
                  {target.checkInAt}
                </dd>
              </>
            )}
          </dl>
          <Field label="Giờ ra" required>
            <Input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field label="Ghi chú">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
            />
          </Field>
          {error && <Message type="error">{error}</Message>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" disabled={saving || !time}>
              {saving ? "Đang lưu..." : "Lưu giờ ra"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
