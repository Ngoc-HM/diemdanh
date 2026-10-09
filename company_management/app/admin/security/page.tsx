"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Plus, Save, Trash2 } from "lucide-react";
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
  Textarea,
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
  const query = new URLSearchParams({
    tab,
    days,
    ...(suspicious ? { only: "suspicious" } : {}),
  }).toString();
  /// Kết quả gắn với đúng bộ lọc đã tải nó. Đổi tab thì lần vẽ đầu tiên vẫn
  /// còn dữ liệu của tab cũ (dòng đăng nhập không có `flags`), nên chỉ dùng
  /// dữ liệu khi khớp bộ lọc hiện tại, không thì hiện khung đang tải.
  const [result, setResult] = useState<{
    query: string;
    rows?: PunchRow[] | LoginRow[];
    error?: string;
  } | null>(null);
  const current = result?.query === query ? result : null;
  const rows = current?.rows ?? null;
  const error = current?.error ?? null;

  useEffect(() => {
    let cancelled = false;
    requestJson(`/api/admin/security/log?${query}`)
      .then((payload) => !cancelled && setResult({ query, rows: payload.rows }))
      .catch((err) => !cancelled && setResult({ query, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [query]);

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

type Feedback = { type: "success" | "error"; text: string };

type BlockedIp = {
  id: string;
  cidr: string;
  note: string | null;
  createdAt: string;
};

/// Dải mạng văn phòng được phép chấm công.
function NetworkCard({
  onFeedback,
}: {
  onFeedback: (feedback: Feedback) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [rangesText, setRangesText] = useState("");
  const [currentIp, setCurrentIp] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    requestJson("/api/admin/security/network")
      .then((payload) => {
        setEnabled(payload.network.enabled);
        setRangesText(payload.network.ranges.join("\n"));
        setCurrentIp(payload.currentIp);
        setLoaded(true);
      })
      .catch((error) => onFeedback({ type: "error", text: error.message }));
  }, [onFeedback]);

  async function save() {
    setSaving(true);
    try {
      const payload = await requestJson("/api/admin/security/network", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, ranges: rangesText.split(/[\s,;]+/) }),
      });
      setEnabled(payload.network.enabled);
      setRangesText(payload.network.ranges.join("\n"));
      onFeedback({ type: "success", text: "Đã lưu mạng chấm công" });
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
        <h3 className="text-lg font-semibold text-slate-900">Mạng chấm công</h3>
        {!loaded ? (
          <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">
                  Chỉ cho vào web từ mạng văn phòng
                </span>
                <span className="block text-sm text-slate-600">
                  Máy không nằm trong các dải dưới đây (ở nhà, vào qua
                  Tailscale, VPN…) không mở được web, kể cả trang đăng nhập.
                </span>
              </span>
            </label>
            <Field
              label="Dải IP văn phòng"
              hint={`Mỗi dòng một IP hoặc một dải, vd 192.168.1.0/24.${currentIp ? ` IP của bạn lúc này: ${currentIp}` : ""}`}
            >
              <Textarea
                value={rangesText}
                onChange={(event) => setRangesText(event.target.value)}
                className="font-mono text-sm"
                rows={3}
              />
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

/// Blacklist: IP / dải IP bị chặn khỏi toàn bộ web.
function BlockedIpCard({
  onFeedback,
}: {
  onFeedback: (feedback: Feedback) => void;
}) {
  const [items, setItems] = useState<BlockedIp[] | null>(null);
  const [currentIp, setCurrentIp] = useState<string | null>(null);
  const [cidr, setCidr] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    requestJson("/api/admin/security/blocked-ips")
      .then((payload) => {
        setItems(payload.items);
        setCurrentIp(payload.currentIp);
      })
      .catch((error) => onFeedback({ type: "error", text: error.message }));
  }, [onFeedback]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setAdding(true);
    try {
      const payload = await requestJson("/api/admin/security/blocked-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cidr, note }),
      });
      onFeedback({ type: "success", text: `Đã chặn ${payload.item.cidr}` });
      setCidr("");
      setNote("");
      load();
    } catch (error) {
      onFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không thêm được",
      });
    } finally {
      setAdding(false);
    }
  }

  async function remove(item: BlockedIp) {
    if (
      !confirm(
        `Bỏ chặn ${item.cidr}? Tài khoản đã bị khoá vì IP này vẫn giữ khoá cho tới khi mở ở trang Nhân viên.`,
      )
    )
      return;
    try {
      await requestJson(`/api/admin/security/blocked-ips/${item.id}`, {
        method: "DELETE",
      });
      onFeedback({ type: "success", text: `Đã bỏ chặn ${item.cidr}` });
      load();
    } catch (error) {
      onFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không bỏ chặn được",
      });
    }
  }

  return (
    <Card>
      <div className="space-y-4 p-5">
        <h3 className="text-lg font-semibold text-slate-900">
          IP bị chặn (blacklist)
        </h3>
        <p className="text-sm text-slate-600">
          IP trong danh sách không vào được web nữa (mọi trang). Tài khoản nhân
          viên nào dùng IP đó — đang đăng nhập sẵn hoặc đăng nhập đúng mật khẩu
          — bị <span className="font-medium text-slate-900">khoá ngay</span>, mở
          lại ở trang Nhân viên. Chỉ nên chặn IP cố định (máy chủ, máy trung
          chuyển): IP cấp động có thể trùng máy của người khác.
        </p>

        {!items ? (
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa chặn IP nào.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Ban
                    size={16}
                    className="shrink-0 text-rose-500"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-slate-900">
                      {item.cidr}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {item.note ? `${item.note} · ` : ""}thêm lúc{" "}
                      {stamp(item.createdAt)}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => remove(item)}
                  aria-label={`Bỏ chặn ${item.cidr}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={add}
          className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <Field label="IP hoặc dải IP">
            <Input
              value={cidr}
              onChange={(event) => setCidr(event.target.value)}
              placeholder="192.168.1.26"
              className="font-mono"
              required
            />
          </Field>
          <Field label="Ghi chú">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="VD: VPS dev"
              maxLength={200}
            />
          </Field>
          <Button
            type="submit"
            disabled={adding}
            className="h-11 whitespace-nowrap"
          >
            <Plus size={16} aria-hidden="true" />
            Chặn
          </Button>
        </form>
        {currentIp && (
          <p className="text-xs text-slate-500">
            IP của bạn lúc này: {currentIp}
          </p>
        )}
      </div>
    </Card>
  );
}

export default function SecurityPage() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  return (
    <>
      <PageHeader
        title="Bảo mật"
        description="Chặn theo IP và nhật ký mọi lần chấm công (kể cả bị từ chối), đăng nhập kèm IP và trình duyệt."
      />
      {feedback && (
        <div className="mb-4">
          <Message type={feedback.type} onDismiss={() => setFeedback(null)}>
            {feedback.text}
          </Message>
        </div>
      )}
      <div className="mb-6 grid items-start gap-4 xl:grid-cols-2">
        <NetworkCard onFeedback={setFeedback} />
        <BlockedIpCard onFeedback={setFeedback} />
      </div>
      <SecurityLog />
    </>
  );
}
