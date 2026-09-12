"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "../_components/page-header";
import { Badge, Card, EmptyState, Message, TableSkeleton } from "@/app/_components/ui";
import { dateKeyVN, formatTimeVN } from "@/lib/datetime";

type Item = {
  id: string;
  actorName: string | null;
  actorRole: string | null;
  path: string;
  kind: "not_found" | "forbidden";
  createdAt: string;
};

const KIND_LABEL: Record<Item["kind"], { label: string; tone: "warning" | "danger" }> = {
  not_found: { label: "Đường dẫn không có", tone: "warning" },
  forbidden: { label: "Không đủ quyền", tone: "danger" },
};

export default function AccessViolationsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/access-violations");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được dữ liệu");
      setItems(payload.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Truy cập lạ"
        description="Người đã đăng nhập mở đường dẫn lạ hoặc không đủ quyền. 100 lần gần nhất."
      />

      {error && <Message type="error">{error}</Message>}

      {!items ? (
        <TableSkeleton rows={6} />
      ) : items.length === 0 ? (
        <EmptyState title="Chưa có truy cập lạ" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2 font-semibold text-slate-900">Thời điểm</th>
                <th className="px-4 py-2 font-semibold text-slate-900">Ai</th>
                <th className="px-4 py-2 font-semibold text-slate-900">Loại</th>
                <th className="px-4 py-2 font-semibold text-slate-900">Đường dẫn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const at = new Date(item.createdAt);
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-600">
                      {dateKeyVN(at).slice(8, 10)}/{dateKeyVN(at).slice(5, 7)}{" "}
                      {formatTimeVN(at)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">
                        {item.actorName ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.actorRole === "admin" ? "Quản trị" : "Nhân viên"}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={KIND_LABEL[item.kind].tone}>
                        {KIND_LABEL[item.kind].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">
                      {item.path}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
