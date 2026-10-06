"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MarkChoice =
  | { kind: "session"; sessionId: string }
  | { kind: "leave"; code: "N" | "O" }
  | { kind: "clear" };

const MENU_WIDTH = 208;
const GAP = 4;
const EDGE = 8;

/// Menu admin chấm lại một ô ngày: đổi ca, đánh dấu nghỉ/ốm, hoặc xoá đánh dấu
/// để ngày trở về đúng lịch nhân viên đã đăng ký.
///
/// Vẽ thẳng vào <body> và định vị `fixed` theo ô được bấm: bảng chấm công nằm
/// trong khung cuộn ngang nên menu đặt bên trong sẽ bị khung cắt mất. Dưới ô
/// không đủ chỗ thì lật lên trên; cuộn trang hay đổi cỡ cửa sổ thì bám theo.
export default function DayMarkMenu({
  anchor,
  sessions,
  saving,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  sessions: { id: string; code: string; name: string }[];
  saving: boolean;
  onPick: (choice: MarkChoice) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const menu = ref.current;
    if (!menu) return;
    const cell = anchor.getBoundingClientRect();
    const height = menu.offsetHeight;
    const below = cell.bottom + GAP;
    const top =
      below + height <= window.innerHeight - EDGE
        ? below
        : Math.max(EDGE, cell.top - GAP - height);
    const left = Math.min(
      Math.max(EDGE, cell.left + cell.width / 2 - MENU_WIDTH / 2),
      window.innerWidth - MENU_WIDTH - EDGE
    );
    setPosition({ top, left });
  }, [anchor]);

  useLayoutEffect(() => {
    place();
    window.addEventListener("resize", place);
    // capture: bắt cả lần cuộn của khung bảng, không chỉ của trang.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [place]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      // Bấm lại chính ô đang mở thì để nút của ô tự đóng menu.
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClickOutside);
    };
  }, [onClose, anchor]);

  const item =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50";

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
      className="z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md"
    >
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          role="menuitem"
          disabled={saving}
          onClick={() => onPick({ kind: "session", sessionId: session.id })}
          className={item}
        >
          <span className="w-7 shrink-0 font-semibold text-slate-900">
            {session.code}
          </span>
          {session.name}
        </button>
      ))}

      <div className="border-t border-slate-200">
        <button
          type="button"
          role="menuitem"
          disabled={saving}
          onClick={() => onPick({ kind: "leave", code: "N" })}
          className={item}
        >
          <span className="w-7 shrink-0 font-semibold text-slate-900">N</span>
          Nghỉ
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={saving}
          onClick={() => onPick({ kind: "leave", code: "O" })}
          className={item}
        >
          <span className="w-7 shrink-0 font-semibold text-slate-900">O</span>
          Ốm
        </button>
      </div>

      <div className="border-t border-slate-200">
        <button
          type="button"
          role="menuitem"
          disabled={saving}
          onClick={() => onPick({ kind: "clear" })}
          className={`${item} text-rose-700 hover:bg-rose-50`}
        >
          <span className="w-7 shrink-0" aria-hidden="true" />
          Xoá đánh dấu
        </button>
      </div>
    </div>,
    document.body
  );
}
