import { Monitor } from "lucide-react";

/// Trang đích cho điện thoại/máy tính bảng: middleware đẩy về đây.
export default function DesktopOnlyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Monitor size={40} className="mx-auto mb-4 text-sky-600" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-slate-900">Chỉ hỗ trợ máy tính</h1>
        <p className="mt-2 text-sm text-slate-600">
          Hệ thống chấm công không dùng được trên điện thoại hay máy tính bảng.
          Vui lòng mở trên máy tính.
        </p>
      </div>
    </div>
  );
}
