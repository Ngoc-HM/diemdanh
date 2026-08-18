"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, History, LogOut } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Chấm công", icon: <Clock size={18} /> },
  { href: "/dashboard/schedule", label: "Đăng ký lịch", icon: <CalendarDays size={18} /> },
  { href: "/dashboard/history", label: "Lịch sử", icon: <History size={18} /> },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16 sm:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
          <p className="text-base font-semibold text-slate-900 sm:hidden">
            Chấm công
          </p>
          <button
            onClick={handleLogout}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white sm:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
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
