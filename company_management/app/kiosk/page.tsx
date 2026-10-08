"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MonitorX } from "lucide-react";
import {
  CompanyLogo,
  useCompanyBranding,
} from "@/app/_components/company-brand";

type CodeState =
  | { kind: "loading" }
  | { kind: "unpaired"; error: string }
  | {
      kind: "ready";
      code: string;
      expiresAt: number;
      device: string;
      required: boolean;
    };

/// Màn hình đặt ở văn phòng, hiện mã có mặt đổi mỗi 30 giây. Không cần đăng
/// nhập: máy được admin ghép nối bằng link dùng một lần (?pair=...).
export default function KioskPage() {
  const { name: companyName, logo } = useCompanyBranding();
  const [state, setState] = useState<CodeState>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      const response = await fetch("/api/kiosk/code", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setState({
          kind: "unpaired",
          error: payload.error || "Màn hình chưa được ghép nối",
        });
        return;
      }
      if (!response.ok) throw new Error(payload.error);
      const expiresAt = Date.now() + payload.secondsLeft * 1000;
      setState({
        kind: "ready",
        code: payload.code,
        expiresAt,
        device: payload.device,
        required: payload.required,
      });
      // Lấy mã mới ngay khi mã cũ đổi (cộng chút trễ cho chắc qua mốc).
      timer.current = setTimeout(refresh, payload.secondsLeft * 1000 + 300);
    } catch {
      // Mất mạng thoáng qua: thử lại sau vài giây, giữ mã đang hiện.
      timer.current = setTimeout(refresh, 3000);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const pairToken = new URLSearchParams(window.location.search).get("pair");
      if (pairToken) {
        const response = await fetch("/api/kiosk/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: pairToken }),
        }).catch(() => null);
        // Xoá mã ghép nối khỏi thanh địa chỉ dù thành công hay không.
        window.history.replaceState(null, "", "/kiosk");
        if (response && !response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (!cancelled)
            setState({
              kind: "unpaired",
              error: payload.error || "Ghép nối thất bại",
            });
          return;
        }
      }
      if (!cancelled) refresh();
    }
    start();
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      cancelled = true;
      clearInterval(tick);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  if (state.kind === "unpaired") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <MonitorX size={48} className="text-slate-400" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-slate-900">{state.error}</h1>
        <p className="max-w-md text-slate-600">
          Admin vào Quản trị → Bảo mật → Thêm màn hình, rồi mở link ghép nối
          trên máy này.
        </p>
      </main>
    );
  }

  const secondsLeft =
    state.kind === "ready"
      ? Math.max(0, Math.ceil((state.expiresAt - now) / 1000))
      : 0;
  const progress =
    state.kind === "ready" ? Math.min(1, (state.expiresAt - now) / 30000) : 0;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-slate-50 p-8">
      <div className="flex items-center gap-4">
        <CompanyLogo logo={logo} size="lg" />
        <div>
          <p className="text-3xl font-semibold text-slate-900">{companyName}</p>
          <p className="text-lg text-slate-500">
            Mã có mặt — nhập khi bấm Vào / Ra ca
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white px-16 py-12 shadow-sm">
        <p
          className="font-mono text-[min(18vw,26vh)] font-semibold leading-none tracking-[0.15em] text-slate-900 tabular-nums"
          aria-live="polite"
        >
          {state.kind === "ready"
            ? `${state.code.slice(0, 3)} ${state.code.slice(3)}`
            : "··· ···"}
        </p>
        <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${secondsLeft <= 5 ? "bg-amber-500" : "bg-sky-600"}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-3 text-center text-xl text-slate-500 tabular-nums">
          Đổi mã sau {secondsLeft} giây
        </p>
      </div>

      {state.kind === "ready" && (
        <p className="text-sm text-slate-400">
          {state.device}
          {state.required ? "" : " · Công ty chưa bắt buộc nhập mã"}
        </p>
      )}
    </main>
  );
}
