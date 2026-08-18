"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import PageHeader from "../../../_components/page-header";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Message,
  Modal,
  Select,
  TableSkeleton,
} from "@/app/_components/ui";
import { addMonths, formatMonthLabel, monthKeyVN } from "@/lib/datetime";
import type { DayStatus } from "@/lib/attendance-rules";
import { DAY_STATUS_TONE } from "@/app/_components/status-styles";

type Punch = {
  id: string;
  type: string;
  time: string;
  distance: number | null;
  withinRadius: boolean;
  isManual: boolean;
  locationName: string | null;
};

type Day = {
  date: string;
  weekday: string;
  holidayName: string | null;
  scheduled: { code: string; name: string; workStart: string; workEnd: string }[];
  status: DayStatus;
  statusLabel: string;
  workedHours: number;
  requiredHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  outsideRadius: boolean;
  note: string | null;
  editedAt: string | null;
  punches: Punch[];
};

type Payload = {
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    employmentLabel: string;
    department: string | null;
    position: string | null;
  };
  month: string;
  days: Day[];
  totals: {
    passedDays: number;
    lateDays: number;
    absentDays: number;
    totalHours: number;
  };
};

type DraftPunch = { type: "in" | "out"; time: string };

export default function UserAttendanceDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [month, setMonth] = useState(() => monthKeyVN());
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [editingDay, setEditingDay] = useState<Day | null>(null);
  const [draft, setDraft] = useState<DraftPunch[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (target: string) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/admin/attendance/user/${userId}?month=${target}`
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Không tải được dữ liệu");
        setData(payload);
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Lỗi không xác định",
        });
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    load(month);
  }, [month, load]);

  function openEdit(day: Day) {
    setEditingDay(day);
    setDraft(
      day.punches.map((punch) => ({
        type: punch.type === "in" ? "in" : "out",
        time: punch.time,
      }))
    );
    setNote(day.note ?? "");
  }

  async function saveDay(event: React.FormEvent) {
    event.preventDefault();
    if (!editingDay) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/attendance/user/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editingDay.date, punches: draft, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể lưu");

      setEditingDay(null);
      setMessage({
        type: "success",
        text: `Đã cập nhật công ngày ${editingDay.date}`,
      });
      load(month);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={data ? data.user.name : "Chi tiết chấm công"}
        description={
          data
            ? [
                data.user.employeeCode,
                data.user.employmentLabel,
                data.user.department,
                data.user.position,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
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

      {message && (
        <div className="mb-4">
          <Message type={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </Message>
        </div>
      )}

      {data && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <div className="text-2xl font-semibold text-emerald-700">
              {data.totals.passedDays}
            </div>
            <div className="mt-0.5 text-sm text-slate-600">Ngày công đạt</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-semibold text-amber-700">
              {data.totals.lateDays}
            </div>
            <div className="mt-0.5 text-sm text-slate-600">Đi muộn</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-semibold text-rose-700">
              {data.totals.absentDays}
            </div>
            <div className="mt-0.5 text-sm text-slate-600">Vắng</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-semibold text-slate-900">
              {data.totals.totalHours}h
            </div>
            <div className="mt-0.5 text-sm text-slate-600">Tổng giờ làm</div>
          </Card>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={8} />
      ) : (
        data && (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-900">Ngày</th>
                  <th className="px-4 py-3 font-semibold text-slate-900">Lịch</th>
                  <th className="px-4 py-3 font-semibold text-slate-900">
                    Giờ vào / ra
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-900">Giờ làm</th>
                  <th className="px-4 py-3 font-semibold text-slate-900">
                    Trạng thái
                  </th>
                  <th className="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => (
                  <tr
                    key={day.date}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                      </div>
                      <div className="text-xs text-slate-500">{day.weekday}</div>
                      {day.holidayName && (
                        <div className="mt-1 text-xs text-sky-700">
                          {day.holidayName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {day.scheduled.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {day.scheduled.map((rule) => (
                            <Badge key={rule.code} tone="brand">
                              {rule.code} {rule.workStart}–{rule.workEnd}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {day.punches.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {day.punches.map((punch) => (
                            <span
                              key={punch.id}
                              title={
                                punch.isManual
                                  ? "Do admin nhập"
                                  : `${punch.locationName ?? ""} ${
                                      punch.distance != null
                                        ? `· ${Math.round(punch.distance)}m`
                                        : ""
                                    }`
                              }
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                punch.type === "in"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {punch.type === "in" ? (
                                <LogIn size={11} aria-hidden="true" />
                              ) : (
                                <LogOut size={11} aria-hidden="true" />
                              )}
                              {punch.time}
                              {punch.isManual && (
                                <Pencil size={10} aria-hidden="true" className="text-slate-400" />
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {day.workedHours}h
                      {day.requiredHours > 0 && (
                        <span className="text-slate-400"> / {day.requiredHours}h</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={DAY_STATUS_TONE[day.status]}>
                          {day.statusLabel}
                        </Badge>
                        {day.lateMinutes > 0 && (
                          <Badge tone="warning">Muộn {day.lateMinutes}′</Badge>
                        )}
                        {day.outsideRadius && (
                          <Badge tone="danger">Ngoài bán kính</Badge>
                        )}
                        {day.editedAt && <Badge>Sửa tay</Badge>}
                      </div>
                      {day.note && (
                        <div className="mt-1 text-xs text-slate-500">{day.note}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(day)}
                        aria-label={`Sửa công ngày ${day.date}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      <Modal
        open={editingDay !== null}
        title={`Sửa công ngày ${editingDay?.date ?? ""}`}
        onClose={() => setEditingDay(null)}
      >
        <form onSubmit={saveDay} className="space-y-4">
          <p className="text-sm text-slate-600">
            Giờ vào và giờ ra phải xen kẽ theo thứ tự thời gian. Xoá hết dòng để
            đánh dấu ngày này không có công.
          </p>

          <div className="space-y-2">
            {draft.map((punch, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={punch.type}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((item, position) =>
                        position === index
                          ? { ...item, type: event.target.value as "in" | "out" }
                          : item
                      )
                    )
                  }
                  className="w-28"
                >
                  <option value="in">Vào</option>
                  <option value="out">Ra</option>
                </Select>
                <Input
                  type="time"
                  value={punch.time}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((item, position) =>
                        position === index
                          ? { ...item, time: event.target.value }
                          : item
                      )
                    )
                  }
                  required
                />
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    setDraft((current) =>
                      current.filter((_, position) => position !== index)
                    )
                  }
                  aria-label="Xoá dòng"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setDraft((current) => [
                ...current,
                {
                  type: current.length % 2 === 0 ? "in" : "out",
                  time: current.length % 2 === 0 ? "08:00" : "17:00",
                },
              ])
            }
          >
            <Plus size={14} aria-hidden="true" />
            Thêm dòng
          </Button>

          <Field label="Ghi chú" hint="Ví dụ: quên check-out, đi công tác">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Lý do sửa công"
            />
          </Field>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingDay(null)}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
