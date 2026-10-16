"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import PageHeader from "../_components/page-header";
import { Badge, Button, Card, Message } from "@/app/_components/ui";
import { dateKeyVN, formatTimeVN } from "@/lib/datetime";

type Feedback = { type: "success" | "error"; text: string };

function stamp(value: string) {
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

type WifiDevice = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  mac: string;
  label: string;
  createdAt: string;
  lastSeenAt: string | null;
};

/// Chấm công tự động qua wifi: công tắc chung, tình trạng máy quét và mọi máy
/// nhân viên đã tự đăng ký (admin xoá được).
function WifiCard({ onFeedback }: { onFeedback: (feedback: Feedback) => void }) {
  const [enabled, setEnabled] = useState(true);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [devices, setDevices] = useState<WifiDevice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((payload: { enabled: boolean; lastScanAt: string | null; devices: WifiDevice[] }) => {
    setEnabled(payload.enabled);
    setLastScan(payload.lastScanAt);
    setDevices(payload.devices);
  }, []);

  useEffect(() => {
    requestJson("/api/admin/security/wifi")
      .then((payload) => {
        apply(payload);
        setLoaded(true);
      })
      .catch((error) => onFeedback({ type: "error", text: error.message }));
  }, [apply, onFeedback]);

  async function toggle(next: boolean) {
    setEnabled(next);
    setBusy(true);
    try {
      apply(
        await requestJson("/api/admin/security/wifi", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        })
      );
      onFeedback({ type: "success", text: next ? "Đã bật chấm công qua wifi" : "Đã tắt chấm công qua wifi" });
    } catch (error) {
      setEnabled(!next);
      onFeedback({ type: "error", text: error instanceof Error ? error.message : "Không lưu được" });
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    try {
      const result = await requestJson("/api/admin/security/wifi/run", { method: "POST" });
      apply(await requestJson("/api/admin/security/wifi"));
      onFeedback({
        type: "success",
        text: result.punches > 0
          ? `Đã ghi ${result.punches} lần vào / ra cho ${result.users} người`
          : "Không có gì mới để ghi",
      });
    } catch (error) {
      onFeedback({ type: "error", text: error instanceof Error ? error.message : "Không đối chiếu được" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(device: WifiDevice) {
    if (!window.confirm(`Xoá máy "${device.label || device.mac}" của ${device.userName}?`)) return;
    setBusy(true);
    try {
      await requestJson(`/api/admin/security/wifi/devices/${device.id}`, { method: "DELETE" });
      setDevices((current) => current.filter((item) => item.id !== device.id));
    } catch (error) {
      onFeedback({ type: "error", text: error instanceof Error ? error.message : "Không xoá được" });
    } finally {
      setBusy(false);
    }
  }

  const scannerStale = !lastScan || Date.now() - new Date(lastScan).getTime() > 5 * 60 * 1000;

  return (
    <Card>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Chấm công tự động qua wifi</h3>
            <p className="text-sm text-slate-600">
              Nhân viên tự đăng ký máy ở mục "Đăng ký thiết bị". Máy nối wifi văn phòng là hệ thống ghi giờ vào;
              giờ ra lấy theo lần cuối còn thấy máy hoặc lúc bấm ra ca, tuỳ cái nào muộn hơn.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={runNow} disabled={busy || !loaded}>
            Đối chiếu ngay
          </Button>
        </div>
        {!loaded ? (
          <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600"
                checked={enabled}
                disabled={busy}
                onChange={(event) => toggle(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">
                  Tự ghi giờ vào / ra khi máy đã đăng ký nối wifi văn phòng
                </span>
                <span className="block text-sm text-slate-600">
                  Máy quét lần cuối: {lastScan ? stamp(lastScan) : "chưa có"}
                  {scannerStale && (
                    <>
                      {" "}
                      <Badge tone="warning">Máy quét không chạy</Badge>
                    </>
                  )}
                </span>
              </span>
            </label>
            {devices.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có nhân viên nào đăng ký máy.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Nhân viên</th>
                      <th className="px-3 py-2">Thiết bị</th>
                      <th className="px-3 py-2">MAC</th>
                      <th className="px-3 py-2">Đăng ký</th>
                      <th className="px-3 py-2">Lần cuối thấy</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {devices.map((device) => (
                      <tr key={device.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{device.userName}</div>
                          <div className="text-xs text-slate-500">{device.userEmail}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{device.label || "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{device.mac}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{stamp(device.createdAt)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                          {device.lastSeenAt ? stamp(device.lastSeenAt) : "chưa thấy"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(device)}
                            disabled={busy}
                            aria-label="Xoá máy"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default function DevicesPage() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  return (
    <>
      <PageHeader
        title="Thiết bị chấm công"
        description="Máy nhân viên đã đăng ký để chấm công tự động qua wifi văn phòng."
      />
      {feedback && (
        <div className="mb-4">
          <Message type={feedback.type} onDismiss={() => setFeedback(null)}>
            {feedback.text}
          </Message>
        </div>
      )}
      <WifiCard onFeedback={setFeedback} />
    </>
  );
}
