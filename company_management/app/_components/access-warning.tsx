"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button, Card } from "@/app/_components/ui";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg p-8 text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50"
        >
          <ShieldAlert size={24} className="text-rose-600" />
        </span>

        <h1 className="text-2xl font-semibold text-slate-900">
          {kind === "forbidden"
            ? "Bạn không có quyền vào khu vực này"
            : "Không có trang này"}
        </h1>

        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Việc bạn tự ý truy cập các đường dẫn không được phép đã được ghi lại và
          báo cáo với quản trị viên.
        </p>

        {path && (
          <p className="mt-4 inline-block rounded-md bg-slate-100 px-3 py-1 font-mono text-sm text-slate-600">
            {path}
          </p>
        )}

        <div className="mt-6">
          <Link href="/">
            <Button size="lg">Về trang chính</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
