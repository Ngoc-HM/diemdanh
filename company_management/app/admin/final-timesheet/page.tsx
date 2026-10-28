"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, RotateCcw } from "lucide-react";
import PageHeader from "../_components/page-header";
import { Button, Card, EmptyState, Message, TableSkeleton } from "@/app/_components/ui";
import { addMonths, formatMonthLabel, monthKeyVN, weekdayLabel } from "@/lib/datetime";
import { formatWorkdays } from "@/lib/attendance-rules";
import { formatOvertimeHours } from "@/lib/overtime";
import type { FinalDay } from "@/lib/final-rules";

type Cell = {
  label: string;
  machineLabel: string;
  machineDetail: string;
  edited: boolean;
  projected: boolean;
  workdayValue: number;
  /// Phiếu OT đã duyệt của ngày (ở mục Duyệt OT).
  overtime: { code: string; minutes: number } | null;
};

type Row = {
  user: {
    id: string;
    name: string;
    employeeCode: string | null;
    employmentType: string;
    employmentLabel: string;
  };
  workdays: number;
  leaveDays: number;
  sickDays: number;
  absentDays: number;
  overtimeMinutes: Record<string, number>;
  days: Record<string, Cell>;
};

const OT_CODES = ["T", "T1", "T2"] as const;
const OT_TONE: Record<string, string> = {
  T: "bg-amber-50 text-amber-800",
  T1: "bg-orange-100 text-orange-800",
  T2: "bg-rose-100 text-rose-800",
};

type Sheet = {
  month: string;
  today: string;
  dates: string[];
  holidays: Record<string, string>;
  weeklyOffDays: number[];
  standardWorkdays: number;
  sessions: { id: string; code: string; name: string; workdayValue: number }[];
  rows: Row[];
};

type Editing = { userId: string; date: string; anchor: HTMLElement };

const MENU_WIDTH = 200;

/// Menu chấm tay một ô. Vẽ vào <body> và định vị theo ô được bấm để không bị
/// khung cuộn ngang của bảng cắt mất.
function CellMenu({
  anchor,
  sessions,
  cell,
  saving,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  sessions: Sheet["sessions"];
  cell: Cell | undefined;
  saving: boolean;
  onPick: (value: FinalDay | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const menu = ref.current;
    if (!menu) return;
    const rect = anchor.getBoundingClientRect();
    const below = rect.bottom + 4;
    const top =
      below + menu.offsetHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, rect.top - 4 - menu.offsetHeight);
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - MENU_WIDTH / 2),
      window.innerWidth - MENU_WIDTH - 8
    );
    setPosition({ top, left });
  }, [anchor]);

  useLayoutEffect(() => {
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [place]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose, anchor]);

  const item =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  const option = (key: string, code: string, label: string, value: FinalDay) => (
    <button key={key} type="button" role="menuitem" disabled={saving} onClick={() => onPick(value)} className={item}>
      <span className="w-9 shrink-0 font-semibold text-slate-900">{code}</span>
      {label}
    </button>
  );

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width: MENU_WIDTH,
        visibility: position ? "visible" : "hidden",
      }}
      className="z-50 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-md"
    >
      {sessions.map((session) =>
        option(session.id, session.code, session.name, {
          status: "work",
          codes: [session.code],
          workday: session.workdayValue,
        })
      )}
      <div className="my-1 border-t border-slate-200" />
      {option("N", "N", "Nghỉ", { status: "leave", codes: [], workday: 0 })}
      {option("O", "O", "Ốm", { status: "sick", codes: [], workday: 0 })}
      {option("V", "V", "Vắng", { status: "absent", codes: [], workday: 0 })}
      {option("L", "L", "Nghỉ lễ", { status: "holiday", codes: [], workday: 1 })}
      {option("off", "—", "Để trống", { status: "off", codes: [], workday: 0 })}
      {cell?.edited && (
        <>
          <div className="my-1 border-t border-slate-200" />
          <button type="button" role="menuitem" disabled={saving} onClick={() => onPick(null)} className={`${item} text-sky-700`}>
            <RotateCcw size={14} className="w-9 shrink-0" aria-hidden="true" />
            Theo máy ({cell.machineLabel || "trống"})
          </button>
        </>
      )}
    </div>,
    document.body
  );
}

export default function FinalTimesheetPage() {
  const [month, setMonth] = useState(() => monthKeyVN());
  const [data, setData] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const latest = useRef(month);

  const load = useCallback(async (target: string) => {
    latest.current = target;
    setLoading((current) => current || !data);
    try {
      const response = await fetch(`/api/admin/attendance/final?month=${target}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được");
      if (latest.current === target) setData(payload);
    } catch (err) {
      if (latest.current === target) setError(err instanceof Error ? err.message : "Không tải được");
    } finally {
      if (latest.current === target) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    setEditing(null);
    load(month);
  }, [month, load]);

  async function save(userId: string, date: string, value: FinalDay | null) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/attendance/final", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date, value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      setEditing(null);
      await load(month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  const editedCount = data?.rows.reduce(
    (total, row) => total + Object.values(row.days).filter((cell) => cell.edited).length,
    0
  );

  return (
    <>
      <PageHeader
        title="Bảng công chốt"
        actions={
          <Button
            variant="secondary"
            onClick={() => window.open(`/api/admin/attendance/monthly?month=${month}&export=xlsx`, "_blank")}
            disabled={!data || data.rows.length === 0}
          >
            <Download size={16} aria-hidden="true" />
            Xuất Excel
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Message type="error" onDismiss={() => setError(null)}>
            {error}
          </Message>
        </div>
      )}

      <div className="mb-4 flex items-center justify-center gap-4">
        <Button variant="secondary" size="sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Tháng trước">
          <ChevronLeft size={16} />
        </Button>
        <span className="min-w-36 text-center text-base font-semibold text-slate-900">{formatMonthLabel(month)}</span>
        <Button variant="secondary" size="sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Tháng sau">
          <ChevronRight size={16} />
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-sm bg-violet-100 ring-1 ring-violet-300" />
          Admin chấm tay{editedCount ? ` (${editedCount} ô)` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-sm bg-sky-50" />
          Tạm tính đủ công (chưa tới ngày)
        </span>
        <span>Ô còn lại theo máy chấm</span>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState title="Chưa có nhân viên" description="Chưa có nhân viên đang hoạt động." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 z-10 min-w-[200px] bg-slate-50 px-3 py-2 text-left font-semibold text-slate-900">
                  Nhân viên
                </th>
                {data.dates.map((date) => (
                  <th
                    key={date}
                    title={data.holidays[date]}
                    className={`min-w-[34px] px-1 py-2 text-center font-medium ${
                      date in data.holidays ? "text-sky-700" : date === data.today ? "text-slate-900" : "text-slate-500"
                    }`}
                  >
                    <div>{date.slice(8, 10)}</div>
                    <div className="text-[10px] font-normal text-slate-400">{weekdayLabel(date)}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold text-slate-900">
                  Công
                  <div className="text-xs font-normal text-slate-500">/ {data.standardWorkdays}</div>
                </th>
                <th className="px-2 py-2 text-center font-semibold text-slate-900">N</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-900">O</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-900">V</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.user.id} className="border-b border-slate-100 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2">
                    <div className="font-medium text-slate-900">{row.user.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {[row.user.employeeCode, row.user.employmentLabel].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  {data.dates.map((date) => {
                    const cell = row.days[date];
                    const open = editing?.userId === row.user.id && editing.date === date;
                    const tone = cell?.edited
                      ? "bg-violet-100 text-violet-900 font-semibold"
                      : cell?.projected
                        ? "bg-sky-50 text-slate-700"
                        : "text-slate-800";
                    return (
                      <td key={date} className={`relative p-0 text-center ${tone}`}>
                        <button
                          type="button"
                          onClick={(event) =>
                            setEditing(open ? null : { userId: row.user.id, date, anchor: event.currentTarget })
                          }
                          aria-haspopup="menu"
                          aria-expanded={open}
                          title={
                            cell?.edited
                              ? `Máy: ${cell.machineLabel || "trống"}${cell.machineDetail ? ` (${cell.machineDetail})` : ""}`
                              : cell?.machineDetail
                                ? `Máy: ${cell.machineDetail}`
                                : date
                          }
                          className={`h-full min-h-9 w-full px-1 py-2 hover:ring-2 hover:ring-inset hover:ring-sky-500 ${
                            open ? "ring-2 ring-inset ring-sky-600" : ""
                          }`}
                        >
                          {cell?.label ?? ""}
                        </button>
                        {open && editing && (
                          <CellMenu
                            anchor={editing.anchor}
                            sessions={data.sessions}
                            cell={cell}
                            saving={saving}
                            onPick={(value) => save(row.user.id, date, value)}
                            onClose={() => setEditing(null)}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-semibold text-emerald-700">{formatWorkdays(row.workdays)}</td>
                  <td className="px-2 py-2 text-center text-slate-700">{row.leaveDays}</td>
                  <td className="px-2 py-2 text-center text-slate-700">{row.sickDays}</td>
                  <td className="px-2 py-2 text-center text-rose-700">{row.absentDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {!loading && data && data.rows.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex flex-wrap items-center gap-x-5 gap-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Làm thêm giờ (OT)</h2>
            {OT_CODES.map((code) => (
              <span key={code} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`rounded px-1.5 py-0.5 font-semibold ${OT_TONE[code]}`}>{code}</span>
                {code === "T" ? "ngày thường" : code === "T1" ? "ngày nghỉ" : "ngày lễ"}
              </span>
            ))}
            <span className="text-xs text-slate-500">Số giờ đã duyệt, sửa ở mục Duyệt OT</span>
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 min-w-[200px] bg-slate-50 px-3 py-2 text-left font-semibold text-slate-900">
                    Nhân viên
                  </th>
                  {data.dates.map((date) => (
                    <th key={date} className="min-w-[34px] px-1 py-2 text-center font-medium text-slate-500">
                      <div>{date.slice(8, 10)}</div>
                      <div className="text-[10px] font-normal text-slate-400">{weekdayLabel(date)}</div>
                    </th>
                  ))}
                  {OT_CODES.map((code) => (
                    <th key={code} className="px-2 py-2 text-center font-semibold text-slate-900">
                      {code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.user.id} className="border-b border-slate-100 last:border-0">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2">
                      <div className="font-medium text-slate-900">{row.user.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {[row.user.employeeCode, row.user.employmentLabel].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    {data.dates.map((date) => {
                      const ot = row.days[date]?.overtime;
                      return (
                        <td
                          key={date}
                          title={ot ? `${ot.code} · ${formatOvertimeHours(ot.minutes)} giờ` : undefined}
                          className={`px-1 py-2 text-center font-medium ${ot ? OT_TONE[ot.code] ?? "" : ""}`}
                        >
                          {ot ? formatOvertimeHours(ot.minutes) : ""}
                        </td>
                      );
                    })}
                    {OT_CODES.map((code) => (
                      <td key={code} className="px-2 py-2 text-center font-semibold text-slate-800">
                        {row.overtimeMinutes[code] ? formatOvertimeHours(row.overtimeMinutes[code]) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
