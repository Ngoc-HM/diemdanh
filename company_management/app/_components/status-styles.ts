import type { DayStatus } from "@/lib/attendance-rules";

/// Bảng màu dùng chung cho ô ngày trong lưới chấm công.
export const DAY_STATUS_CELL: Record<DayStatus, string> = {
  passed: "bg-emerald-100 text-emerald-800",
  late: "bg-amber-100 text-amber-800",
  insufficient: "bg-amber-100 text-amber-800",
  open: "bg-sky-100 text-sky-700",
  absent: "bg-rose-100 text-rose-700",
  unscheduled: "bg-slate-200 text-slate-700",
  holiday: "bg-sky-50 text-sky-700",
  off: "bg-white text-slate-300",
};

export const DAY_STATUS_TONE: Record<
  DayStatus,
  "neutral" | "brand" | "success" | "warning" | "danger"
> = {
  passed: "success",
  late: "warning",
  insufficient: "warning",
  open: "brand",
  absent: "danger",
  unscheduled: "neutral",
  holiday: "brand",
  off: "neutral",
};

export const LEGEND: { status: DayStatus; label: string }[] = [
  { status: "passed", label: "Đủ công" },
  { status: "late", label: "Đi muộn / thiếu giờ" },
  { status: "open", label: "Đang trong ca" },
  { status: "absent", label: "Vắng" },
  { status: "unscheduled", label: "Làm ngoài lịch" },
  { status: "holiday", label: "Nghỉ lễ" },
];
