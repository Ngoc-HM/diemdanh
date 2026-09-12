"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/// Trang cảnh báo dùng chung cho 404 và cho trường hợp vào nhầm khu vực không
/// đủ quyền. Ghi lại lần truy cập ngay khi hiện ra — câu "đã được ghi lại"
/// phải đúng sự thật, nếu không lần đầu có người hỏi admin là lộ.
export default function AccessWarning({
  kind,
  path,
}: {
  kind: "not_found" | "forbidden";
  /// Đường dẫn đã thử vào; bỏ trống thì lấy đường dẫn hiện tại.
  path?: string;
}) {
  useEffect(() => {
    const target = path || window.location.pathname;
    fetch("/api/access-violation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: target, kind }),
    }).catch(() => undefined);
  }, [kind, path]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-xl rounded-xl border border-rose-500/30 bg-slate-800 p-8 text-center shadow-md">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15">
          <ShieldAlert size={32} className="text-rose-400" aria-hidden="true" />
        </span>

        <h1 className="text-2xl font-bold text-white">
          {kind === "forbidden"
            ? "Bạn không có quyền vào khu vực này"
            : "Không có trang này"}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-rose-200">
          Việc bạn tự ý truy cập các đường dẫn không được phép đã được ghi lại và
          báo cáo với quản trị viên.
        </p>

        <p className="mx-auto mt-4 max-w-md text-sm text-slate-400">
          Bản ghi gồm tài khoản đang đăng nhập, đường dẫn bạn vừa mở và thời
          điểm truy cập.
        </p>

        {(path || kind === "forbidden") && (
          <p className="mt-4 inline-block rounded-md bg-slate-900 px-3 py-1.5 font-mono text-sm text-slate-400">
            {path || "—"}
          </p>
        )}

        <div className="mt-7">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Quay về trang của tôi
          </Link>
        </div>
      </div>
    </div>
  );
}
