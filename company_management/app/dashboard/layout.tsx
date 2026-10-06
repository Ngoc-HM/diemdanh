"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Timer,
  CalendarCog,
  CalendarDays,
  Clock,
  ExternalLink,
  History,
  LogOut,
  NotebookPen,
  Settings,
} from "lucide-react";
import {
  CompanyLogo,
  useCompanyBranding,
} from "@/app/_components/company-brand";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /// Link ra ngoài hệ thống: mở tab mới, không bao giờ ở trạng thái đang chọn.
  external?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Chấm công", icon: <Clock size={18} /> },
  { href: "/dashboard/schedule", label: "Đăng ký lịch", icon: <CalendarDays size={18} /> },
  { href: "/dashboard/history", label: "Lịch sử", icon: <History size={18} /> },
  { href: "/dashboard/work-reports", label: "Nội dung công việc", icon: <NotebookPen size={18} /> },
  { href: "/dashboard/shift-requests", label: "Chỉnh sửa ca", icon: <CalendarCog size={18} /> },
  { href: "/dashboard/overtime", label: "Làm thêm giờ", icon: <Timer size={18} /> },
  { href: "/dashboard/settings", label: "Cài đặt", icon: <Settings size={18} /> },
  { href: "https://app.clickup.com", label: "ClickUp", icon: <ExternalLink size={18} />, external: true },
];

type SessionUser = { name: string; email: string; avatarUrl?: string | null };

/// Layout khu vực nhân viên, cùng khung với khu vực quản trị: header cố định
/// (thương hiệu trái, đồng hồ + đăng xuất phải), sidebar dọc trái chứa khối
/// người dùng và menu, nội dung bên phải.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { name: companyName, logo } = useCompanyBranding();
  const [now, setNow] = useState<Date | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        // Server trả lời rõ là không còn phiên (vd tài khoản đã ngừng hoạt
        // động) thì về trang đăng nhập; lỗi mạng thì chỉ để trống tên.
        if (data && !data.user) {
          window.location.href = "/login";
          return;
        }
        setUser(data?.user ?? null);
      })
      .catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const isActive = (item: NavItem) =>
    !item.external &&
    (item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href));

  const clock = now
    ? now.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        {/* Khối thương hiệu tự đệm để thẳng hàng với cột trái */}
        <div className="flex h-16 items-center justify-between gap-4 pr-4 sm:pr-6">
          {/* Tên công ty hiện đủ, không cắt; chỉ giữ chiều rộng tối thiểu để
              thẳng hàng với cột trái, dài hơn thì tự nới ra. */}
          <div className="flex min-w-0 shrink items-center gap-3 px-4 lg:min-w-60 lg:px-3">
            <CompanyLogo logo={logo} />
            <p className="text-base font-semibold leading-tight text-slate-900">
              {companyName || "Chấm công"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Một đồng hồ duy nhất cho toàn khu vực nhân viên */}
            <div className="text-right">
              <div className="text-base font-semibold tabular-nums leading-tight text-slate-900">
                {clock}
              </div>
              <div className="text-xs text-slate-500">
                {now
                  ? now.toLocaleDateString("vi-VN", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : ""}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Mobile: tab ngang dưới header (sidebar dọc ẩn) */}
        <nav className="flex overflow-x-auto border-t border-slate-200 lg:hidden">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-28 flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-sky-600 bg-sky-50 text-sky-700"
                    : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className={active ? "text-sky-600" : "text-slate-400"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          {/* Thông tin người dùng nằm ngay dưới khối thương hiệu */}
          <div className="flex items-center gap-3 border-b border-slate-200 px-3 py-3">
            {user?.avatarUrl ? (
              // Ảnh nhân viên tự upload nên dùng thẻ img thường.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-sm font-semibold text-white"
              >
                {user?.name?.trim().slice(0, 1).toUpperCase() ?? "?"}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {user?.name ?? " "}
              </p>
              <p className="truncate text-xs text-slate-500">
                {user?.email ?? " "}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sky-50 text-sky-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className={active ? "text-sky-600" : "text-slate-400"}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
