"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, MonitorSmartphone, Plus, Save, Trash2 } from "lucide-react";
import PageHeader from "../_components/page-header";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Message,
  Select,
  TableSkeleton,
} from "@/app/_components/ui";
import { dateKeyVN, formatTimeVN } from "@/lib/datetime";
import {
  LOGIN_EVENT_LABELS,
  LoginEventType,
  PUNCH_FLAG_LABELS,
  PUNCH_REASON_LABELS,
  PunchFlag,
  summarizeUserAgent,
} from "@/lib/security-labels";

type Policy = { outsideRadius: "reject" | "flag"; presenceCode: boolean };

type Device = {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
};

type PunchRow = {
  id: string;
  type: string;
  result: "accepted" | "rejected";
  reason: string | null;
  accuracy: number | null;
  distance: number | null;
  ip: string | null;
  userAgent: string | null;
  flags: PunchFlag[];
  createdAt: string;
  userName: string;
  userEmail: string;
  locationName: string | null;
};

type LoginRow = {
  id: string;
  accountType: "admin" | "employee" | "unknown";
  identifier: string | null;
  event: LoginEventType;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  userName: string | null;
};

type Feedback = { type: "success" | "error"; text: string };

const BAD_LOGIN_EVENTS: LoginEventType[] = ["login_failed", "2fa_failed"];

function stamp(value: string) {
  const at = new Date(value);
  const key = dateKeyVN(at);
  return `${key.slice(8, 10)}/${key.slice(5, 7)} ${formatTimeVN(at)}`;
}

function meters(value: number | null) {
  if (value === null) return "—";
  return value >= 1000
    ? `${(value / 1000).toFixed(1)} km`
    : `${Math.round(value)} m`;
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Không thực hiện được");
  return payload;
}

function PolicyCard({
  devices,
  onFeedback,
}: {
  devices: Device[] | null;
  onFeedback: (f: Feedback) => void;
}) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    requestJson("/api/admin/security/policy")
      .then((payload) => setPolicy(payload.policy))
      .catch((error) => onFeedback({ type: "error", text: error.message }));
  }, [onFeedback]);

  async function save() {
    if (!policy) return;
    setSaving(true);
    try {
      const payload = await requestJson("/api/admin/security/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      setPolicy(payload.policy);
      onFeedback({ type: "success", text: "Đã lưu chính sách chấm công" });
    } catch (error) {
      onFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không lưu được",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="space-y-4 p-5">
        <h3 className="text-lg font-semibold text-slate-900">
          Chính sách chấm công
        </h3>
        {!policy ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600"
                checked={policy.presenceCode}
                onChange={(event) =>
                  setPolicy({ ...policy, presenceCode: event.target.checked })
                }
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">
                  Bắt nhập mã có mặt
                </span>
                <span className="block text-sm text-slate-600">
                  Nhân viên phải nhập mã 6 số đang hiện trên màn hình ở văn
                  phòng. Ngồi nhà không thấy màn hình thì không chấm công được,
                  dù giả được GPS.
                </span>
                {policy.presenceCode && devices?.length === 0 && (
                  <span className="mt-1 block text-sm text-rose-700">
                    Chưa có màn hình nào — thêm màn hình ở bên cạnh trước.
                  </span>
                )}
              </span>
            </label>

            <Field
              label="Vị trí GPS ngoài bán kính"
              hint={
                policy.presenceCode
                  ? "Đã có mã có mặt thì GPS chỉ là tín hiệu phụ: máy bàn hay báo sai vị trí."
                  : "Chưa bắt mã có mặt thì GPS là lớp chặn duy nhất nên luôn từ chối."
              }
            >
              <Select
                value={policy.presenceCode ? policy.outsideRadius : "reject"}
                disabled={!policy.presenceCode}
                onChange={(event) =>
                  setPolicy({
                    ...policy,
                    outsideRadius: event.target
                      .value as Policy["outsideRadius"],
                  })
                }
              >
                <option value="reject">Từ chối chấm công</option>
                <option value="flag">Vẫn nhận, gắn cờ để admin xem lại</option>
              </Select>
            </Field>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                <Save size={16} aria-hidden="true" />
                {saving ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function KioskCard({
  devices,
  reload,
  onFeedback,
}: {
  devices: Device[] | null;
  reload: () => void;
  onFeedback: (f: Feedback) => void;
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<{
    url: string;
    name: string;
    hours: number;
  } | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const payload = await requestJson("/api/admin/security/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setLink({
        url: `${window.location.origin}/kiosk?pair=${payload.pairingToken}`,
        name: payload.device.name,
        hours: payload.expiresInHours,
      });
      setName("");
      reload();
    } catch (error) {
      onFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không tạo được",
      });
    } finally {
      setCreating(false);
    }
  }

  async function revoke(device: Device) {
    if (
      !confirm(
        `Thu hồi màn hình "${device.name}"? Mã có mặt sẽ đổi ngay trên mọi màn hình.`,
      )
    )
      return;
    try {
      await requestJson(`/api/admin/security/kiosks/${device.id}`, {
        method: "DELETE",
      });
      onFeedback({ type: "success", text: `Đã thu hồi ${device.name}` });
      reload();
    } catch (error) {
      onFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không thu hồi được",
      });
    }
  }

  return (
    <Card>
      <div className="space-y-4 p-5">
        <h3 className="text-lg font-semibold text-slate-900">
          Màn hình hiện mã
        </h3>
        <p className="text-sm text-slate-600">
          Một máy (TV, máy tính, máy tính bảng) đặt cố định ở văn phòng, mở
          trang mã có mặt toàn màn hình. Tạo link rồi mở link đó trên chính máy
          ấy — link chỉ dùng được một lần.
        </p>

        {link && (
          <Message type="info" onDismiss={() => setLink(null)}>
            <span className="block">
              Mở link này trên máy <b>{link.name}</b> trong {link.hours} giờ
              tới:
            </span>
            <span className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs text-slate-800">
                {link.url}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  navigator.clipboard?.writeText(link.url).then(
                    () =>
                      onFeedback({
                        type: "success",
                        text: "Đã sao chép link ghép nối",
                      }),
                    () => undefined,
                  )
                }
              >
                <Copy size={14} aria-hidden="true" />
                Sao chép
              </Button>
            </span>
          </Message>
        )}

        {!devices ? (
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        ) : devices.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có màn hình nào.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MonitorSmartphone
                    size={18}
                    className="shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {device.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {device.lastSeenAt
                        ? `Hoạt động lần cuối ${stamp(device.lastSeenAt)}`
                        : "Chưa ghép nối"}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => revoke(device)}
                  aria-label={`Thu hồi ${device.name}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={create} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Tên màn hình mới">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="VD: TV quầy lễ tân"
                maxLength={60}
                required
              />
            </Field>
          </div>
          <Button type="submit" disabled={creating} className="h-11">
            <Plus size={16} aria-hidden="true" />
            Thêm màn hình
          </Button>
        </form>
      </div>
    </Card>
  );
}

function PunchTable({ rows }: { rows: PunchRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-left">
          <th className="px-4 py-2 font-semibold text-slate-900">Thời điểm</th>
          <th className="px-4 py-2 font-semibold text-slate-900">Nhân viên</th>
          <th className="px-4 py-2 font-semibold text-slate-900">Bấm</th>
          <th className="px-4 py-2 font-semibold text-slate-900">Kết quả</th>
          <th className="px-4 py-2 font-semibold text-slate-900">Vị trí</th>
          <th className="px-4 py-2 font-semibold text-slate-900">IP</th>
          <th className="px-4 py-2 font-semibold text-slate-900">
            Trình duyệt
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr
            key={row.id}
            className={row.result === "rejected" ? "bg-rose-50/40" : undefined}
          >
            <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-600">
              {stamp(row.createdAt)}
            </td>
            <td className="px-4 py-2">
              <div className="font-medium text-slate-900">{row.userName}</div>
              <div className="text-xs text-slate-500">{row.userEmail}</div>
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-slate-700">
              {row.type === "in" ? "Vào ca" : "Ra ca"}
            </td>
            <td className="px-4 py-2">
              <div className="flex flex-wrap gap-1">
                {row.result === "accepted" ? (
                  <Badge tone="success">Nhận</Badge>
                ) : (
                  <Badge tone="danger">
                    {row.reason
                      ? (PUNCH_REASON_LABELS[row.reason] ?? row.reason)
                      : "Từ chối"}
                  </Badge>
                )}
                {row.flags.map((flag) => (
                  <Badge key={flag} tone="warning">
                    {PUNCH_FLAG_LABELS[flag] ?? flag}
                  </Badge>
                ))}
              </div>
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-slate-600">
              <div>
                {row.distance === null
                  ? "—"
                  : row.locationName
                    ? `${meters(row.distance)} tới ${row.locationName}`
                    : meters(row.distance)}
              </div>
              <div className="text-xs text-slate-500">
                ±{meters(row.accuracy)}
              </div>
            </td>
            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-700">
              {row.ip ?? "—"}
            </td>
            <td
              className="whitespace-nowrap px-4 py-2 text-slate-600"
              title={row.userAgent ?? undefined}
            >
              {summarizeUserAgent(row.userAgent)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LoginTable({ rows }: { rows: LoginRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-left">
          <th className="px-4 py-2 font-semibold text-slate-900">Thời điểm</th>
          <th className="px-4 py-2 font-semibold text-slate-900">Tài khoản</th>
          <th className="px-4 py-2 font-semibold text-slate-900">Sự kiện</th>
          <th className="px-4 py-2 font-semibold text-slate-900">IP</th>
          <th className="px-4 py-2 font-semibold text-slate-900">
            Trình duyệt
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr
            key={row.id}
            className={
              BAD_LOGIN_EVENTS.includes(row.event) ? "bg-rose-50/40" : undefined
            }
          >
            <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-600">
              {stamp(row.createdAt)}
            </td>
            <td className="px-4 py-2">
              <div className="font-medium text-slate-900">
                {row.userName ?? row.identifier ?? "—"}
              </div>
              <div className="text-xs text-slate-500">
                {row.accountType === "admin"
                  ? "Quản trị"
                  : row.accountType === "employee"
                    ? "Nhân viên"
                    : "Không rõ"}
                {row.userName && row.identifier ? ` · ${row.identifier}` : ""}
              </div>
            </td>
            <td className="px-4 py-2">
              <Badge
                tone={
                  BAD_LOGIN_EVENTS.includes(row.event)
                    ? "danger"
                    : row.event === "login"
                      ? "neutral"
                      : "brand"
                }
              >
                {LOGIN_EVENT_LABELS[row.event] ?? row.event}
              </Badge>
            </td>
            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-700">
              {row.ip ?? "—"}
            </td>
            <td
              className="whitespace-nowrap px-4 py-2 text-slate-600"
              title={row.userAgent ?? undefined}
            >
              {summarizeUserAgent(row.userAgent)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SecurityLog() {
  const [tab, setTab] = useState<"punch" | "login">("punch");
  const [days, setDays] = useState("7");
  const [suspicious, setSuspicious] = useState(false);
  const [rows, setRows] = useState<PunchRow[] | LoginRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    const params = new URLSearchParams({
      tab,
      days,
      ...(suspicious ? { only: "suspicious" } : {}),
    });
    requestJson(`/api/admin/security/log?${params}`)
      .then((payload) => !cancelled && setRows(payload.rows))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [tab, days, suspicious]);

  const tabClass = (active: boolean) =>
    `h-10 rounded-lg px-4 text-sm font-medium ${
      active
        ? "bg-sky-50 text-sky-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex gap-1" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "punch"}
            className={tabClass(tab === "punch")}
            onClick={() => setTab("punch")}
          >
            Chấm công
          </button>
          <button
            role="tab"
            aria-selected={tab === "login"}
            className={tabClass(tab === "login")}
            onClick={() => setTab("login")}
          >
            Đăng nhập
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
              checked={suspicious}
              onChange={(event) => setSuspicious(event.target.checked)}
            />
            Chỉ hiện bất thường
          </label>
          <div className="w-40">
            <Select
              value={days}
              onChange={(event) => setDays(event.target.value)}
              aria-label="Khoảng thời gian"
            >
              <option value="1">24 giờ qua</option>
              <option value="7">7 ngày qua</option>
              <option value="30">30 ngày qua</option>
              <option value="90">90 ngày qua</option>
            </Select>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-4">
          <Message type="error">{error}</Message>
        </div>
      ) : !rows ? (
        <div className="p-4">
          <TableSkeleton rows={6} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Không có bản ghi nào" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          {tab === "punch" ? (
            <PunchTable rows={rows as PunchRow[]} />
          ) : (
            <LoginTable rows={rows as LoginRow[]} />
          )}
        </div>
      )}
    </Card>
  );
}

export default function SecurityPage() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadDevices = useCallback(() => {
    requestJson("/api/admin/security/kiosks")
      .then((payload) => setDevices(payload.devices))
      .catch((error) => setFeedback({ type: "error", text: error.message }));
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  return (
    <>
      <PageHeader
        title="Bảo mật"
        description="Chống chấm công hộ / giả vị trí, và nhật ký mọi lần chấm công, đăng nhập kèm IP."
      />

      {feedback && (
        <div className="mb-4">
          <Message type={feedback.type} onDismiss={() => setFeedback(null)}>
            {feedback.text}
          </Message>
        </div>
      )}

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <PolicyCard devices={devices} onFeedback={setFeedback} />
        <KioskCard
          devices={devices}
          reload={loadDevices}
          onFeedback={setFeedback}
        />
      </div>

      <SecurityLog />
    </>
  );
}
