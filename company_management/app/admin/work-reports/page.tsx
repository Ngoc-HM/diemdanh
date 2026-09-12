"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import PageHeader from "../_components/page-header";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Message,
  Select,
  TableSkeleton,
} from "@/app/_components/ui";
import { addMonths, formatMonthLabel, monthKeyVN } from "@/lib/datetime";
import { formatDuration } from "@/lib/work-reports";

type Entry = {
  id: string;
  date: string;
  weekday: string;
  start: string;
  end: string;
  minutes: number;
  content: string;
  user: {
    id: string;
    name: string;
    employeeCode: string | null;
    department: string | null;
  };
};

type Payload = {
  month: string;
  date: string | null;
  userId: string | null;
  entries: Entry[];
  totalMinutes: number;
};

type Employee = { id: string; name: string; employeeCode: string | null };

/// Một nhân viên trong một ngày = một khối; các khoảng bên trong nối tiếp nhau
/// nên đọc theo khối dễ hơn là đọc từng dòng rời.
type Block = { key: string; entry: Entry; entries: Entry[]; minutes: number };

function groupByUserDay(entries: Entry[]): Block[] {
  const blocks = new Map<string, Block>();
  for (const entry of entries) {
    const key = `${entry.date}|${entry.user.id}`;
    const block = blocks.get(key) ?? { key, entry, entries: [], minutes: 0 };
    block.entries.push(entry);
    block.minutes += entry.minutes;
    blocks.set(key, block);
  }
  return [...blocks.values()];
}

export default function AdminWorkReportsPage() {
  const [month, setMonth] = useState(() => monthKeyVN());
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /// Bộ lọc thành query string, dùng chung cho lần tải dữ liệu và nút xuất CSV.
  const buildQuery = useCallback(
    (extra?: Record<string, string>) => {
      const params = new URLSearchParams({ month });
      if (userId) params.set("userId", userId);
      // Ngày ngoài tháng đang xem thì API từ chối, nên bỏ qua luôn ở client.
      if (date && date.slice(0, 7) === month) params.set("date", date);
      for (const [key, value] of Object.entries(extra ?? {})) {
        params.set(key, value);
      }
      return params.toString();
    },
    [month, userId, date]
  );

  useEffect(() => {
    fetch("/api/users")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setEmployees(payload?.users ?? []))
      .catch(() => setEmployees([]));
  }, []);

  const load = useCallback(async (queryString: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/work-reports?${queryString}`);
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
    load(buildQuery());
  }, [buildQuery, load]);

  const blocks = groupByUserDay(data?.entries ?? []);

  return (
    <>
      <PageHeader
        title="Báo cáo công việc"
        description="Nội dung công việc nhân viên tự khai theo từng khoảng thời gian trong ngày. Chỉ để xem — nhân viên khai và sửa trong ngày, hết ngày là chốt."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMonth(addMonths(month, -1))}
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
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label="Tháng sau"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                window.open(
                  `/api/admin/work-reports?${buildQuery({ export: "csv" })}`,
                  "_blank"
                )
              }
              disabled={!data || data.entries.length === 0}
            >
              <Download size={16} aria-hidden="true" />
              Xuất CSV
            </Button>
          </div>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <Select
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className="w-60"
          aria-label="Lọc theo nhân viên"
        >
          <option value="">Tất cả nhân viên</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
              {employee.employeeCode ? ` (${employee.employeeCode})` : ""}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-48"
          aria-label="Lọc theo ngày"
        />
        {date && (
          <Button variant="ghost" size="sm" onClick={() => setDate("")}>
            Bỏ lọc ngày
          </Button>
        )}
        <span className="ml-auto text-sm text-slate-600">
          {data ? `${data.entries.length} khoảng · ${formatDuration(data.totalMinutes)}` : ""}
        </span>
      </Card>

      {error && <Message type="error">{error}</Message>}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : blocks.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 font-semibold text-slate-900">Ngày</th>
                <th className="px-4 py-2 font-semibold text-slate-900">Nhân viên</th>
                <th className="px-4 py-2 font-semibold text-slate-900">Khung giờ</th>
                <th className="px-4 py-2 font-semibold text-slate-900">Nội dung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {blocks.map((block) =>
                block.entries.map((entry, index) => (
                  <tr key={entry.id}>
                    {index === 0 && (
                      <>
                        <td
                          rowSpan={block.entries.length}
                          className="px-4 py-2 whitespace-nowrap"
                        >
                          <span className="font-medium tabular-nums text-slate-900">
                            {entry.date.slice(8, 10)}/{entry.date.slice(5, 7)}
                          </span>{" "}
                          <span className="text-slate-400">{entry.weekday}</span>
                        </td>
                        <td rowSpan={block.entries.length} className="px-4 py-2">
                          <Link
                            href={`/admin/attendance/user/${entry.user.id}?month=${entry.date.slice(0, 7)}`}
                            className="font-medium text-sky-700 hover:underline"
                          >
                            {entry.user.name}
                          </Link>
                          <div className="text-xs text-slate-500">
                            {entry.user.employeeCode ?? "—"}
                            {entry.user.department ? ` · ${entry.user.department}` : ""}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Tổng {formatDuration(block.minutes)}
                          </div>
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="tabular-nums text-slate-900">
                        {entry.start} – {entry.end}
                      </span>
                      <div className="text-xs text-slate-500">
                        {formatDuration(entry.minutes)}
                      </div>
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-2 text-slate-700">
                      {entry.content}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title="Chưa có nội dung công việc nào"
          description="Không có khoảng nào khớp bộ lọc đang chọn."
        />
      )}
    </>
  );
}
