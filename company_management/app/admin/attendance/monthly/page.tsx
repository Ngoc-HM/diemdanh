"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import PageHeader from "../../_components/page-header";
import {
  Button,
  Card,
  EmptyState,
  Message,
  TableSkeleton,
} from "@/app/_components/ui";
import { addMonths, formatMonthLabel, monthKeyVN, weekdayLabel } from "@/lib/datetime";
import type { DayStatus } from "@/lib/attendance-rules";
import { DAY_STATUS_CELL, LEGEND } from "@/app/_components/status-styles";

type DayCell = {
  status: DayStatus;
  label: string;
  codes: string[];
  workedHours: number;
  lateMinutes: number;
  outsideRadius: boolean;
};

type Row = {
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    employmentLabel: string;
    department: string | null;
  };
  days: Record<string, DayCell>;
  passedDays: number;
  lateDays: number;
  absentDays: number;
  totalHours: number;
  sessions: Record<string, number>;
};

type Payload = {
  month: string;
  dates: string[];
  sessions: { id: string; code: string; name: string }[];
  holidays: Record<string, string>;
  summary: Row[];
};

export default function MonthlyAttendancePage() {
  const [month, setMonth] = useState(() => monthKeyVN());
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/attendance/monthly?month=${target}`
      );
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

  const totals = data?.summary.reduce(
    (acc, row) => ({
      passed: acc.passed + row.passedDays,
      late: acc.late + row.lateDays,
      absent: acc.absent + row.absentDays,
      hours: acc.hours + row.totalHours,
    }),
    { passed: 0, late: 0, absent: 0, hours: 0 }
  );

  return (
    <>
      <PageHeader
        title="Bảng chấm công"
        description="Đối chiếu lịch làm việc đã đăng ký với giờ chấm công thực tế."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              window.open(
                `/api/admin/attendance/monthly?month=${month}&export=csv`,
                "_blank"
              )
            }
            disabled={!data || data.summary.length === 0}
          >
            <Download size={16} aria-hidden="true" />
            Xuất CSV
          </Button>
        }
      />

      <div className="mb-6 flex items-center justify-center gap-3">
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

      {error && (
        <div className="mb-4">
          <Message type="error">{error}</Message>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {LEGEND.map((item) => (
          <span key={item.status} className="flex items-center gap-1.5">
            <span
              className={`h-3.5 w-3.5 rounded-sm ${DAY_STATUS_CELL[item.status]}`}
            />
            <span className="text-slate-600">{item.label}</span>
          </span>
        ))}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : !data || data.summary.length === 0 ? (
        <EmptyState
          title="Chưa có dữ liệu chấm công"
          description="Chưa có nhân viên đang hoạt động, hoặc chưa ai chấm công trong tháng này."
        />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 min-w-[200px] bg-slate-50 px-3 py-2 text-left font-semibold text-slate-900">
                    Nhân viên
                  </th>
                  {data.dates.map((date) => {
                    const isHoliday = date in data.holidays;
                    return (
                      <th
                        key={date}
                        title={data.holidays[date]}
                        className={`min-w-[30px] px-1 py-2 text-center font-medium ${
                          isHoliday ? "text-sky-700" : "text-slate-500"
                        }`}
                      >
                        <div>{date.slice(8, 10)}</div>
                        <div className="text-[10px] font-normal text-slate-400">
                          {weekdayLabel(date)}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-center font-semibold text-slate-900">
                    Công
                  </th>
                  <th className="px-2 py-2 text-center font-semibold text-slate-900">
                    Muộn
                  </th>
                  <th className="px-2 py-2 text-center font-semibold text-slate-900">
                    Vắng
                  </th>
                  <th className="px-2 py-2 text-center font-semibold text-slate-900">
                    Giờ
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.summary.map((row) => (
                  <tr key={row.user.id} className="border-b border-slate-100 last:border-0">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2">
                      <Link
                        href={`/admin/attendance/user/${row.user.id}`}
                        className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
                      >
                        {row.user.name}
                      </Link>
                      <div className="text-[11px] text-slate-500">
                        {row.user.employeeCode
                          ? `${row.user.employeeCode} · `
                          : ""}
                        {row.user.employmentLabel}
                      </div>
                    </td>
                    {data.dates.map((date) => {
                      const cell = row.days[date];
                      const status: DayStatus = cell?.status ?? "off";
                      return (
                        <td
                          key={date}
                          title={
                            cell
                              ? `${date} · ${cell.workedHours}h${
                                  cell.lateMinutes
                                    ? ` · muộn ${cell.lateMinutes} phút`
                                    : ""
                                }${cell.outsideRadius ? " · ngoài bán kính" : ""}`
                              : undefined
                          }
                          className={`px-1 py-2 text-center font-medium ${DAY_STATUS_CELL[status]}`}
                        >
                          {cell?.label ?? ""}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center font-semibold text-emerald-700">
                      {row.passedDays}
                    </td>
                    <td className="px-2 py-2 text-center text-amber-700">
                      {row.lateDays}
                    </td>
                    <td className="px-2 py-2 text-center text-rose-700">
                      {row.absentDays}
                    </td>
                    <td className="px-2 py-2 text-center font-medium text-slate-700">
                      {row.totalHours}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {totals && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Nhân viên" value={String(data.summary.length)} />
              <StatTile
                label="Ngày công đạt"
                value={String(totals.passed)}
                tone="text-emerald-700"
              />
              <StatTile
                label="Lượt đi muộn"
                value={String(totals.late)}
                tone="text-amber-700"
              />
              <StatTile
                label="Tổng giờ làm"
                value={`${Math.round(totals.hours * 10) / 10}h`}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

function StatTile({
  label,
  value,
  tone = "text-slate-900",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card className="p-4">
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-sm text-slate-600">{label}</div>
    </Card>
  );
}
