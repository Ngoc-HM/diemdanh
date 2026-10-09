"use client";

import { useEffect, useState } from "react";
import PageHeader from "../_components/page-header";
import {
  Badge,
  Card,
  EmptyState,
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
  return (
    <>
      <PageHeader
        title="Bảo mật"
        description="Nhật ký mọi lần chấm công (kể cả bị từ chối) và đăng nhập, kèm IP và trình duyệt."
      />
      <SecurityLog />
    </>
  );
}
