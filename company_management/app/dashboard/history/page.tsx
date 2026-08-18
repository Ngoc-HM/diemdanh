"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button, Card, Message } from "@/app/_components/ui";
import {
  addMonths,
  formatMonthLabel,
  monthKeyVN,
  weekdayLabel,
} from "@/lib/datetime";
import { DAY_STATUS_LABELS, type DayStatus } from "@/lib/attendance-rules";
import { DAY_STATUS_TONE } from "@/app/_components/status-styles";

type Day = {
  date: string;
  holidayName: string | null;
  status: DayStatus;
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
    passedDays: number;
    workedHours: number;
    absentDays: number;
    lateDays: number;
  };
};

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

  // Ngày không có lịch và cũng không chấm công thì không cần hiện.
  const visibleDays = data?.days.filter(
    (day) => day.status !== "off" || day.punches.length > 0
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lịch sử chấm công</h1>
        <p className="mt-1 text-sm text-slate-600">
          Đối chiếu giờ làm thực tế với ca đã đăng ký.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Tháng trước"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Button>
        <span className="min-w-40 text-center text-base font-semibold text-slate-900">
          {formatMonthLabel(month)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Tháng sau"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>

      {error && <Message type="error">{error}</Message>}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <div className="text-2xl font-semibold text-emerald-700">
              {data.summary.passedDays}
            </div>
            <div className="text-sm text-slate-600">Ngày công</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-semibold text-slate-900">
              {data.summary.workedHours}h
            </div>
            <div className="text-sm text-slate-600">Tổng giờ</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-semibold text-amber-700">
              {data.summary.lateDays}
            </div>
            <div className="text-sm text-slate-600">Đi muộn</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-semibold text-rose-700">
              {data.summary.absentDays}
            </div>
            <div className="text-sm text-slate-600">Vắng</div>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl bg-slate-200" aria-hidden="true" />
      ) : visibleDays && visibleDays.length > 0 ? (
        <Card className="divide-y divide-slate-100">
          {visibleDays.map((day) => (
            <div key={day.date} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-900">
                    {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                  </span>{" "}
                  <span className="text-sm text-slate-400">
                    {weekdayLabel(day.date)}
                  </span>
                  {day.holidayName && (
                    <span className="ml-2 text-sm text-sky-700">
                      {day.holidayName}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {day.codes.length > 0 && (
                    <Badge tone="brand">{day.codes.join("+")}</Badge>
                  )}
                  <Badge tone={DAY_STATUS_TONE[day.status]}>
                    {DAY_STATUS_LABELS[day.status]}
                  </Badge>
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <span>
                  {day.workedHours}h
                  {day.requiredHours > 0 && (
                    <span className="text-slate-400"> / {day.requiredHours}h</span>
                  )}
                </span>
                {day.lateMinutes > 0 && (
                  <span className="text-amber-700">Muộn {day.lateMinutes} phút</span>
                )}
                {day.punches.length > 0 && (
                  <span className="text-slate-500">
                    {day.punches
                      .map(
                        (punch) =>
                          `${punch.type === "in" ? "vào" : "ra"} ${new Date(
                            punch.at
                          ).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                      )
                      .join(" · ")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <Card className="px-6 py-12 text-center">
          <p className="text-base font-medium text-slate-900">
            Chưa có dữ liệu trong tháng này
          </p>
        </Card>
      )}
    </div>
  );
}
