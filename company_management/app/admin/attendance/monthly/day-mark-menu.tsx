"use client";

import { useEffect, useRef } from "react";

export type MarkChoice =
  | { kind: "session"; sessionId: string }
  | { kind: "leave"; code: "N" | "O" }
  | { kind: "clear" };

/// Menu admin chấm lại một ô ngày: đổi ca, đánh dấu nghỉ/ốm, hoặc xoá đánh dấu
/// để ngày trở về đúng lịch nhân viên đã đăng ký.
export default function DayMarkMenu({
  sessions,
  saving,
  onPick,
  onClose,
}: {
  sessions: { id: string; code: string; name: string }[];
  saving: boolean;
  onPick: (choice: MarkChoice) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClickOutside);
    };
  }, [onClose]);

  const item =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50";

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute left-1/2 top-full z-30 mt-1 w-52 -translate-x-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md"
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
    </div>
  );
}
