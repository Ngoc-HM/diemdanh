"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  KeyRound,
  LogOut,
  MapPin,
  PartyPopper,
  Clock,
  Users,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  { href: "/admin/attendance", label: "Điểm danh", icon: <CalendarCheck size={18} /> },
  { href: "/admin/schedules", label: "Lịch làm việc", icon: <CalendarDays size={18} /> },
  { href: "/admin/users", label: "Nhân viên", icon: <Users size={18} /> },
  { href: "/admin/sessions", label: "Ca làm việc", icon: <Clock size={18} /> },
  { href: "/admin/locations", label: "Vị trí", icon: <MapPin size={18} /> },
  { href: "/admin/holidays", label: "Ngày lễ", icon: <PartyPopper size={18} /> },
  { href: "/admin/company", label: "Công ty", icon: <Building2 size={18} /> },
];

/// Quyền truy cập đã được chặn ở `middleware.ts` trước khi render, nên layout
/// không cần gọi lại /api/auth/session và không còn màn hình "Đang tải".
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin-login-app";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        {/* Không đệm trái ở đây — khối thương hiệu tự đệm để thẳng hàng với cột trái */}
        <div className="flex h-16 items-center justify-between pr-4 sm:pr-6">
          <div className="flex shrink-0 items-center gap-3 px-4 lg:w-56 lg:px-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Building2 size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">Quản trị</p>
              <p className="text-xs text-slate-500">Hệ thống chấm công</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/change-password"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              <KeyRound size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Đổi mật khẩu</span>
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Cột trái bám sát mép màn hình, tự cuộn riêng khi menu dài hơn màn hình */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sky-50 text-sky-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className={isActive ? "text-sky-600" : "text-slate-400"}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>

      {/* Mobile nav */}
      <nav className="sticky bottom-0 z-40 flex overflow-x-auto border-t border-slate-200 bg-white lg:hidden">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-[76px] flex-1 flex-col items-center gap-1 px-2 py-2 text-xs font-medium ${
                isActive ? "text-sky-700" : "text-slate-500"
              }`}
            >
              <span className={isActive ? "text-sky-600" : "text-slate-400"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
