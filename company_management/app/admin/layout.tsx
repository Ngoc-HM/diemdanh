"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wallet,
  Timer,
  AlarmClockOff,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ExternalLink,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  NotebookText,
  PartyPopper,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Users,
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
  { href: "/admin/attendance", label: "Điểm danh", icon: <CalendarCheck size={18} /> },
  { href: "/admin/missed-checkout", label: "Quên checkout", icon: <AlarmClockOff size={18} /> },
  { href: "/admin/work-reports", label: "Báo cáo công việc", icon: <NotebookText size={18} /> },
  { href: "/admin/schedules", label: "Lịch làm việc", icon: <CalendarDays size={18} /> },
  { href: "/admin/shift-requests", label: "Duyệt đổi ca", icon: <ClipboardCheck size={18} /> },
  { href: "/admin/overtime", label: "Duyệt OT", icon: <Timer size={18} /> },
  { href: "/admin/payroll", label: "Bảng lương", icon: <Wallet size={18} /> },
  { href: "/admin/users", label: "Nhân viên", icon: <Users size={18} /> },
  { href: "/admin/sessions", label: "Ca làm việc", icon: <Clock size={18} /> },
  { href: "/admin/locations", label: "Vị trí", icon: <MapPin size={18} /> },
  { href: "/admin/holidays", label: "Ngày lễ", icon: <PartyPopper size={18} /> },
  { href: "/admin/company", label: "Công ty", icon: <Building2 size={18} /> },
  { href: "/admin/email", label: "Email", icon: <Mail size={18} /> },
  { href: "/admin/security", label: "Bảo mật", icon: <ShieldCheck size={18} /> },
  { href: "/admin/access-violations", label: "Truy cập lạ", icon: <ShieldAlert size={18} /> },
  { href: "https://app.clickup.com", label: "ClickUp", icon: <ExternalLink size={18} />, external: true },
];

/// Mục menu nào có badge đếm: chỉ "Duyệt đổi ca" cần nhắc admin còn việc.
const SHIFT_REQUESTS_HREF = "/admin/shift-requests";

/// Chấm đỏ nhỏ cạnh nhãn menu, chỉ hiện khi còn yêu cầu chờ duyệt.
function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} yêu cầu chờ duyệt`}
      className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1.5 py-px text-[11px] font-semibold leading-4 text-white"
    >
      {count}
    </span>
  );
}

/// Quyền truy cập đã được chặn ở `middleware.ts` trước khi render, nên layout
/// không cần gọi lại /api/auth/session và không còn màn hình "Đang tải".
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { name: companyName, logo } = useCompanyBranding();
  const [pendingRequests, setPendingRequests] = useState(0);

  /// Đếm lại mỗi khi đổi trang để admin duyệt xong là badge giảm ngay,
  /// không phải tải lại toàn bộ. Lỗi mạng thì ẩn badge, không báo gì.
  /// Request này chạy ở mọi lần chuyển trang nên kiêm luôn việc phát hiện phiên
  /// đã bị thu hồi (đổi mật khẩu / bật 2 lớp ở máy khác): 401 là về đăng nhập.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/shift-requests?status=pending`)
      .then((response) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((payload) => {
        if (cancelled) return;
        const count = Number(payload?.pendingCount);
        setPendingRequests(Number.isFinite(count) ? count : 0);
      })
      .catch(() => {
        if (!cancelled) setPendingRequests(0);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleLogout() {

    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        {/* Không đệm trái ở đây — khối thương hiệu tự đệm để thẳng hàng với cột trái */}
        <div className="flex h-16 items-center justify-between pr-4 sm:pr-6">
          {/* Tên công ty hiện đủ, không cắt; chỉ giữ chiều rộng tối thiểu để
              thẳng hàng với cột trái, dài hơn thì tự nới ra. */}
          <div className="flex min-w-0 shrink items-center gap-3 px-4 lg:min-w-56 lg:px-3">
            <CompanyLogo logo={logo} />
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900">Quản trị</p>
              <p className="text-xs leading-tight text-slate-500">
                {companyName || "Hệ thống chấm công"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/change-password"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              <KeyRound size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Tài khoản</span>
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
        {/* Header cao 64px + 1px viền dưới = 65px; lệch 1px là trang nào cũng có thanh cuộn dọc thừa. */}
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const isActive =
                !item.external &&
                (pathname === item.href || pathname.startsWith(item.href + "/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
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
                  <span className="flex-1">{item.label}</span>
                  {item.href === SHIFT_REQUESTS_HREF && (
                    <PendingBadge count={pendingRequests} />
                  )}
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
            !item.external &&
            (pathname === item.href || pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-[76px] flex-1 flex-col items-center gap-1 px-2 py-2 text-xs font-medium ${
                isActive ? "text-sky-700" : "text-slate-500"
              }`}
            >
              <span className={isActive ? "text-sky-600" : "text-slate-400"}>
                {item.icon}
              </span>
              <span className="inline-flex items-center gap-1">
                {item.label}
                {item.href === SHIFT_REQUESTS_HREF && (
                  <PendingBadge count={pendingRequests} />
                )}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
