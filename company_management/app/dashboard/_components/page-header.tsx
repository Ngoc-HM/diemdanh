import { ReactNode } from "react";

/// Tiêu đề trang khu vực nhân viên. H1 30px/700 theo thang typography DESIGN,
/// hành động chính nằm bên phải trên cùng một hàng.
export default function DashboardPageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
