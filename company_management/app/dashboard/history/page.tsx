"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, EmptyState, Message } from "@/app/_components/ui";
import { monthKeyVN, weekdayLabel } from "@/lib/datetime";
import {
  DAY_STATUS_LABELS,
  formatWorkdays,
  type DayStatus,
} from "@/lib/attendance-rules";
import { DAY_STATUS_TONE, ROW_HIGHLIGHT } from "@/app/_components/status-styles";
import DashboardPageHeader from "@/app/dashboard/_components/page-header";
import MonthNav from "@/app/dashboard/_components/month-nav";

type Day = {
  date: string;
  holidayName: string | null;
  adminEdited: boolean;
  /// Đang có yêu cầu đổi ca chờ admin duyệt.
  pendingRequest: boolean;
  status: DayStatus;
  /// Ngày này được tính một ngày công (kể cả ngoài lịch có đủ vào/ra).
  countsAsWorkDay: boolean;
  codes: string[];
  workedHours: number;
  requiredHours: number;
  lateMinutes: number;
  punches: { id: string; type: string; at: string; isManual: boolean }[];
};

type Payload = {
  month: string;
  days: Day[];
  summary: {
    /// Tổng số công, có thể lẻ nửa ngày (ca S / C = 0,5).
    workdays: number;
    standardWorkdays: number;
    workedHours: number;
    absentDays: number;
    lateDays: number;
  };
};

const SUMMARY_ITEMS: {
  key: Exclude<keyof Payload["summary"], "standardWorkdays">;
  label: string;
  tone: string;
  suffix?: string;
}[] = [
  { key: "workdays", label: "Ngày công", tone: "text-emerald-700" },
  { key: "workedHours", label: "Tổng giờ", tone: "text-slate-900", suffix: "h" },
  { key: "lateDays", label: "Đi muộn", tone: "text-amber-700" },
  { key: "absentDays", label: "Vắng", tone: "text-rose-700" },
];

/// Nền dòng: đỏ = có lịch mà không đi, vàng = có gì đó cần để ý (admin đã
/// sửa, đang chờ duyệt đổi ca, hoặc đi làm ngoài lịch). Đỏ xét trước vì vắng
/// là sự thật đã xảy ra, còn vàng chỉ là ghi chú.
function rowHighlight(day: Day): string | undefined {
  if (day.status === "absent") return ROW_HIGHLIGHT.absent;
  if (day.adminEdited || day.pendingRequest || day.status === "unscheduled") {
    return ROW_HIGHLIGHT.attention;
  }
  return undefined;
}

/// Lý do dòng được tô màu, hiện khi rê chuột. Thứ tự trùng với rowHighlight;
/// chờ duyệt đứng trước admin đã sửa vì đó là việc đang treo.
function rowTitle(day: Day): string | undefined {
  if (day.status === "absent") return "Có lịch nhưng không chấm công";
  if (day.pendingRequest) return "Đang chờ duyệt yêu cầu đổi ca";
  if (day.adminEdited) return "Admin đã sửa ngày này";
  if (day.status === "unscheduled") return "Đi làm không đăng ký lịch, vẫn tính công";
  return undefined;
}

export default function HistoryPage() {
  const [month, setMonth] = useState(() => monthKeyVN());
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/attendance?month=${target}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được dữ liệu");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  // Ngày không có lịch và cũng không chấm công thì không cần hiện, trừ khi
  // admin đã đụng vào hoặc đang có yêu cầu đổi ca treo ở ngày đó.
  const visibleDays = data?.days.filter(
    (day) =>
      day.status !== "off" ||
      day.punches.length > 0 ||
      day.adminEdited ||
      day.pendingRequest
  );

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Lịch sử chấm công"
        actions={<MonthNav month={month} onChange={setMonth} />}
      />

      {error && <Message type="error">{error}</Message>}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUMMARY_ITEMS.map((item) => (
            <Card key={item.key} className="px-4 py-3">
              <div className={`text-2xl font-semibold tabular-nums ${item.tone}`}>
                {item.key === "workdays"
                  ? formatWorkdays(data.summary.workdays)
                  : data.summary[item.key]}
                {item.suffix}
                {item.key === "workdays" && (
                  <span className="text-base font-normal text-slate-500">
                    {" "}/ {data.summary.standardWorkdays}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-600">{item.label}</div>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl bg-slate-200" aria-hidden="true" />
      ) : visibleDays && visibleDays.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 font-semibold text-slate-900">Ngày</th>
                <th className="px-4 py-2 font-semibold text-slate-900">Ca</th>
                <th className="px-4 py-2 font-semibold text-slate-900">Trạng thái</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-900">
                  Giờ làm
                </th>
                <th className="hidden px-4 py-2 text-right font-semibold text-slate-900 sm:table-cell">
                  Đi muộn
                </th>
                <th className="hidden px-4 py-2 font-semibold text-slate-900 md:table-cell">
                  Bấm giờ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleDays.map((day) => (
                <tr
                  key={day.date}
                  className={rowHighlight(day)}
                  title={rowTitle(day)}
                >
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="font-medium tabular-nums text-slate-900">
                      {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                    </span>{" "}
                    <span className="text-slate-400">{weekdayLabel(day.date)}</span>
                    {day.holidayName && (
                      <div className="text-xs text-sky-700">{day.holidayName}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {day.codes.length > 0 ? (
                      <Badge tone="brand">{day.codes.join("+")}</Badge>
                    ) : day.status === "unscheduled" && day.countsAsWorkDay ? (
                      // Không có mã ca nhưng vẫn là một ngày công: nói rõ thay
                      // vì để dấu gạch khiến nhân viên tưởng bị mất công.
                      <Badge tone="warning">Ngoài lịch</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={DAY_STATUS_TONE[day.status]}>
                      {DAY_STATUS_LABELS[day.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums text-slate-900">
                    {day.workedHours}h
                    {day.requiredHours > 0 && (
                      <span className="text-slate-400"> / {day.requiredHours}h</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-2 text-right whitespace-nowrap tabular-nums sm:table-cell">
                    {day.lateMinutes > 0 ? (
                      <span className="text-amber-700">{day.lateMinutes} phút</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-2 whitespace-nowrap text-slate-500 md:table-cell">
                    {day.punches.length > 0
                      ? day.punches
                          .map(
                            (punch) =>
                              `${punch.type === "in" ? "vào" : "ra"} ${new Date(
                                punch.at
                              ).toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                          )
                          .join(" · ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="Chưa có dữ liệu trong tháng này" />
      )}
    </div>
  );
}
