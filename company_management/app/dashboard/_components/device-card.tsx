"use client";

import { useCallback, useEffect, useState } from "react";
import { Smartphone, Trash2, Wifi } from "lucide-react";
import { Button, Card, Message } from "@/app/_components/ui";
import { dateKeyVN, formatTimeVN } from "@/lib/datetime";

type Device = {
  id: string;
  mac: string;
  label: string;
  createdAt: string;
  lastSeenAt: string | null;
};

type Feedback = { type: "success" | "error"; text: string };

function stamp(value: string | null) {
  if (!value) return "chưa thấy";
  const at = new Date(value);
  const key = dateKeyVN(at);
  return `${key.slice(8, 10)}/${key.slice(5, 7)} ${formatTimeVN(at)}`;
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Không thực hiện được");
  return payload;
}

/// Máy của nhân viên dùng để chấm công tự động qua wifi văn phòng (trang Cài đặt).
export default function DeviceCard({ className = "" }: { className?: string }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await requestJson("/api/devices");
      setDevices(payload.devices);
      setEnabled(payload.enabled);
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Không tải được" });
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function register() {
    setBusy(true);
    setFeedback(null);
    try {
      const payload = await requestJson("/api/devices", { method: "POST" });
      setDevices(payload.devices);
      setFeedback({
        type: "success",
        text: payload.alreadyRegistered ? "Máy này đã đăng ký rồi." : "Đã đăng ký.",
      });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Không đăng ký được" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(device: Device) {
    if (!window.confirm(`Bỏ đăng ký máy "${device.label || device.mac}"?`)) return;
    setBusy(true);
    try {
      await requestJson(`/api/devices/${device.id}`, { method: "DELETE" });
      setDevices((current) => current.filter((item) => item.id !== device.id));
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Không xoá được" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={className}>
      <div className="space-y-4 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Wifi size={18} aria-hidden="true" className="text-sky-600" />
            Chấm công tự động qua wifi
          </h2>
        </div>

        {feedback && (
          <Message type={feedback.type} onDismiss={() => setFeedback(null)}>
            {feedback.text}
          </Message>
        )}
        {loaded && !enabled && (
          <Message type="info">Chấm công tự động đang tắt</Message>
        )}

        {!loaded ? (
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        ) : devices.length === 0 ? null : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center gap-3 px-4 py-3">
                <Smartphone size={18} aria-hidden="true" className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {device.label || "Thiết bị"}
                  </div>
                  <div className="text-xs text-slate-500">
                    <span className="font-mono">{device.mac}</span> · đăng ký {stamp(device.createdAt)} ·
                    lần cuối thấy {stamp(device.lastSeenAt)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(device)}
                  disabled={busy}
                  aria-label="Bỏ đăng ký"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button type="button" onClick={register} disabled={busy || !loaded}>
            <Wifi size={16} aria-hidden="true" />
            Đăng ký máy này
          </Button>
        </div>
      </div>
    </Card>
  );
}
