"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlarmClockOff, ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "../_components/page-header";
import CheckoutDialog, {
  type CheckoutTarget,
} from "../_components/checkout-dialog";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Message,
  TableSkeleton,
} from "@/app/_components/ui";
import { addMonths, formatMonthLabel, monthKeyVN } from "@/lib/datetime";

type Item = {
  userId: string;
  userName: string;
  employeeCode: string | null;
  department: string | null;
  date: string;
  weekday: string;
  checkInAt: string;
};

type Payload = { month: string; count: number; items: Item[] };

export default function MissedCheckoutPage() {
  const [month, setMonth] = useState(() => monthKeyVN());
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState<CheckoutTarget | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/attendance/missed-checkout?month=${target}`,
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Không tải được dữ liệu");
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

  return (
    <>
      <PageHeader
        title="Quên checkout"
        description="Ngày đã check-in nhưng hết ngày không có lần check-out nào. Giờ công tính 0 cho tới khi bổ sung giờ ra; nhân viên nhận email khi admin bổ sung."
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
          </div>
        }
      />

      {error && <Message type="error">{error}</Message>}
      {saved && (
        <div className="mb-4">
          <Message type="success" onDismiss={() => setSaved(null)}>
            {saved}
          </Message>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : data && data.items.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 font-semibold text-slate-900">Ngày</th>
                <th className="px-4 py-2 font-semibold text-slate-900">
                  Nhân viên
                </th>
                <th className="hidden px-4 py-2 font-semibold text-slate-900 md:table-cell">
                  Phòng ban
                </th>
                <th className="px-4 py-2 text-right font-semibold text-slate-900">
                  Giờ vào
                </th>
                <th className="px-4 py-2 text-right font-semibold text-slate-900">
                  Sửa
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((item) => (
                <tr key={`${item.userId}-${item.date}`}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="font-medium tabular-nums text-slate-900">
                      {item.date.slice(8, 10)}/{item.date.slice(5, 7)}
                    </span>{" "}
                    <span className="text-slate-400">{item.weekday}</span>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/attendance/user/${item.userId}?month=${item.date.slice(0, 7)}`}
                      className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
                    >
                      {item.userName}
                    </Link>
                    {item.employeeCode && (
                      <div className="text-xs text-slate-500">
                        {item.employeeCode}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-2 text-slate-600 md:table-cell">
                    {item.department ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Badge tone="warning">{item.checkInAt}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setFixing({
                          userId: item.userId,
                          userName: item.userName,
                          date: item.date,
                          checkInAt: item.checkInAt,
                        })
                      }
                    >
                      <AlarmClockOff size={14} aria-hidden="true" />
                      Bổ sung giờ ra
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title={`Không có ca nào quên checkout trong ${formatMonthLabel(month)}`}
        />
      )}

      <CheckoutDialog
        target={fixing}
        onClose={() => setFixing(null)}
        onSaved={(target, time) => {
          setFixing(null);
          setSaved(
            `Đã bổ sung giờ ra ${time} ngày ${target.date.slice(8, 10)}/${target.date.slice(5, 7)} cho ${target.userName}`,
          );
          load(month);
        }}
      />
    </>
  );
}
