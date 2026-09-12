"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/app/_components/ui";
import { addMonths, formatMonthLabel } from "@/lib/datetime";

/// Điều hướng tháng dùng chung cho trang Đăng ký lịch và Lịch sử, để hai màn
/// có cùng một vị trí và cùng một kích thước control.
export default function MonthNav({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Tháng trước"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </Button>
      <span className="min-w-36 text-center text-sm font-semibold text-slate-900">
        {formatMonthLabel(month)}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="Tháng sau"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}
