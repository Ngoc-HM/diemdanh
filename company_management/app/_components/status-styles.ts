import type { DayStatus } from "@/lib/attendance-rules";

/// Bảng màu dùng chung cho ô ngày trong lưới chấm công.
export const DAY_STATUS_CELL: Record<DayStatus, string> = {
  passed: "bg-emerald-100 text-emerald-800",
  late: "bg-amber-100 text-amber-800",
  insufficient: "bg-amber-100 text-amber-800",
  open: "bg-sky-100 text-sky-700",
  missed_out: "bg-amber-100 text-amber-800",
  leave: "bg-slate-100 text-slate-600",
  sick: "bg-slate-100 text-slate-600",
  absent: "bg-rose-100 text-rose-700",
  // Quên đăng ký nhưng vẫn đi làm: vẫn tính công, tô vàng để admin để ý.
  unscheduled: "bg-amber-100 text-amber-800",
  holiday: "bg-sky-50 text-sky-700",
  off: "bg-white text-slate-300",
};

/// Nền dòng trong bảng theo ngày (lịch sử nhân viên, chi tiết admin):
/// vàng = có gì đó admin cần để ý (admin đã sửa, ngoài lịch, chờ duyệt đổi ca),
/// đỏ = có lịch mà không đi (khác với nghỉ N đã xin).
export const ROW_HIGHLIGHT = {
  attention: "bg-amber-50",
  absent: "bg-rose-50",
} as const;

export const DAY_STATUS_TONE: Record<
  DayStatus,
  "neutral" | "brand" | "success" | "warning" | "danger"
> = {
  passed: "success",
  late: "warning",
  insufficient: "warning",
  open: "brand",
  missed_out: "warning",
  leave: "neutral",
  sick: "neutral",
  absent: "danger",
  unscheduled: "warning",
  holiday: "brand",
  off: "neutral",
};

export const LEGEND: { status: DayStatus; label: string }[] = [
  { status: "passed", label: "Đủ công" },
  { status: "late", label: "Đi muộn / thiếu giờ" },
  { status: "open", label: "Đang trong ca" },
  { status: "missed_out", label: "Quên checkout" },
  { status: "leave", label: "Nghỉ (N)" },
  { status: "sick", label: "Ốm (O)" },
  { status: "absent", label: "Vắng (có lịch mà không đi)" },
  { status: "unscheduled", label: "Làm ngoài lịch (vẫn tính công)" },
  { status: "holiday", label: "Nghỉ lễ" },
];
