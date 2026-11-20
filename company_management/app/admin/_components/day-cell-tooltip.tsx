"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type DayCellTooltipInfo = {
  /// Tiêu đề, vd "T4 · 19/11".
  title: string;
  /// Ký hiệu của ô (CN, S*, V…), hiện bên phải tiêu đề.
  label: string;
  firstIn: string | null;
  lastOut: string | null;
  workedHours: number | null;
  lateMinutes: number;
  /// Ghi chú trạng thái: "Thiếu giờ, chờ xem lại", "Đã chốt"…
  notes: string[];
};

const WIDTH = 216;
const GAP = 6;
const EDGE = 8;

/// Bảng nhỏ hiện cạnh ô ngày (rê chuột 0,3 giây hoặc bấm chuột phải): giờ vào
/// đầu tiên, giờ ra cuối cùng, giờ làm, phút muộn. Vẽ vào <body> và định vị
/// `fixed` như DayMarkMenu, vì bảng nằm trong khung cuộn ngang.
export default function DayCellTooltip({
  anchor,
  info,
}: {
  anchor: HTMLElement;
  info: DayCellTooltipInfo;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const box = ref.current;
    if (!box) return;
    const cell = anchor.getBoundingClientRect();
    const below = cell.bottom + GAP;
    const top =
      below + box.offsetHeight <= window.innerHeight - EDGE
        ? below
        : Math.max(EDGE, cell.top - GAP - box.offsetHeight);
    const left = Math.min(
      Math.max(EDGE, cell.left + cell.width / 2 - WIDTH / 2),
      window.innerWidth - WIDTH - EDGE,
    );
    setPosition({ top, left });
  }, [anchor]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  const row = (name: string, value: string, tone = "text-slate-900") => (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{name}</dt>
      <dd className={`font-medium tabular-nums ${tone}`}>{value}</dd>
    </div>
  );

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width: WIDTH,
        visibility: position ? "visible" : "hidden",
      }}
      className="pointer-events-none z-50 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-md"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-semibold text-slate-900">{info.title}</span>
        {info.label && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
            {info.label}
          </span>
        )}
      </div>
      <dl className="space-y-1">
        {row("Vào", info.firstIn ?? "—")}
        {row("Ra", info.lastOut ?? (info.firstIn ? "Chưa có" : "—"))}
        {info.workedHours !== null && row("Giờ làm", `${info.workedHours}h`)}
        {info.lateMinutes > 0 && row("Muộn", `${info.lateMinutes} phút`, "text-amber-700")}
      </dl>
      {info.notes.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-xs text-slate-600">
          {info.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}
