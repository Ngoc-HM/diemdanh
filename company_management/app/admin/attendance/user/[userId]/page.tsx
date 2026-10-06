"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  LogIn,
  LogOut,
  NotebookText,
  Pencil,
  Plus,
  Trash2,
  X,
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
import { formatDuration } from "@/lib/work-reports";
import { formatWorkdays, type DayStatus } from "@/lib/attendance-rules";
import { DAY_STATUS_TONE, ROW_HIGHLIGHT } from "@/app/_components/status-styles";

type Punch = {
  id: string;
  type: string;
  time: string;
  distance: number | null;
  withinRadius: boolean;
  isManual: boolean;
  locationName: string | null;
};

/// Một khoảng trong báo cáo "Nội dung công việc hằng ngày" của nhân viên.
type WorkReport = {
  id: string;
  start: string;
  end: string;
  minutes: number;
  content: string;
};

type Day = {
  date: string;
  weekday: string;
  holidayName: string | null;
  scheduled: { code: string; name: string; workStart: string; workEnd: string }[];
  status: DayStatus;
  /// Ngày được tính công (kể cả "ngoài lịch" có đủ giờ vào/ra).
  countsAsWorkDay: boolean;
  /// Số công của ngày: 1 = x, 0,5 = x/2.
  workdayValue: number;
  /// Thiếu giờ, admin chưa xem lại (vẫn đang tính đủ công).
  needsReview: boolean;
  /// Quyết định admin đã chọn cho ngày thiếu giờ.
  reviewDecision: "count" | "exclude" | null;
  /// Admin đã chấm lại ô này (DayMark isAdminEdit).
  adminEdited: boolean;
  /// Đang có yêu cầu đổi ca chờ duyệt cho ngày này.
  pendingRequest: boolean;
  statusLabel: string;
  workedHours: number;
  requiredHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  outsideRadius: boolean;
  note: string | null;
  editedAt: string | null;
  punches: Punch[];
  /// Nhân viên tự khai, admin chỉ xem — không tham gia tính công.
  reports: WorkReport[];
  reportMinutes: number;
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
    workdays: number;
    standardWorkdays: number;
    reviewDays: number;
    lateDays: number;
    absentDays: number;
    totalHours: number;
  };
};

type DraftPunch = { type: "in" | "out"; time: string };

/// Nền và chú thích của một dòng ngày: đỏ = có lịch mà không đi (khác nghỉ N
/// đã xin); vàng = có gì đó admin cần để ý (đã sửa, đang chờ duyệt, làm ngoài
/// lịch). Vắng ưu tiên hơn vì là lỗi thật, còn vàng chỉ là nhắc nhở.
function rowHighlight(day: Day): { className: string; title: string | undefined } {
  if (day.status === "absent") {
    return {
      className: ROW_HIGHLIGHT.absent,
      title: "Có lịch nhưng không chấm công",
    };
  }
  const notes: string[] = [];
  if (day.needsReview) notes.push("Thiếu giờ, chờ admin xem lại (đang tính đủ công)");
  if (day.adminEdited) notes.push("Admin đã sửa ngày này");
  if (day.pendingRequest) notes.push("Đang chờ duyệt đổi ca");
  if (day.status === "unscheduled") {
    notes.push("Đi làm không đăng ký lịch, vẫn tính công");
  }
  if (notes.length === 0) return { className: "", title: undefined };
  return { className: ROW_HIGHLIGHT.attention, title: notes.join(" · ") };
}

/// Link từ trang "Quên checkout" mang theo ?month= để mở đúng tháng có sự cố.
export default function UserAttendanceDetailPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <UserAttendanceDetail />
    </Suspense>
  );
}

function UserAttendanceDetail() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const searchParams = useSearchParams();
  const requestedMonth = searchParams.get("month");

  const [month, setMonth] = useState(() =>
    requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)
      ? requestedMonth
      : monthKeyVN()
  );
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [editingDay, setEditingDay] = useState<Day | null>(null);
  const [reportDay, setReportDay] = useState<Day | null>(null);
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

  /// Quyết định cho ngày thiếu giờ; bấm lại nút đang chọn là bỏ quyết định.
  async function reviewDay(day: Day, decision: "count" | "exclude") {
    const next = day.reviewDecision === decision ? null : decision;
    setMessage(null);
    try {
      const response = await fetch("/api/admin/attendance/day-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date: day.date, decision: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể lưu");
      load(month);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    }
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
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              window.open(
                `/api/admin/attendance/user/${userId}?month=${month}&export=xlsx`,
                "_blank"
              )
            }
            disabled={!data}
          >
            <Download size={16} aria-hidden="true" />
            Xuất Excel
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

      {message && (
        <div className="mb-4">
          <Message type={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </Message>
        </div>
      )}

      {data && data.totals.reviewDays > 0 && (
        <div className="mb-4">
          <Message type="info">
            {data.totals.reviewDays} ngày làm thiếu giờ đang chờ xem lại. Chưa
            quyết định thì hết tháng vẫn tính đủ công; bấm “Không tính” ở dòng
            đó nếu không trả công ngày ấy.
          </Message>
        </div>
      )}

      {data && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <div className="text-2xl font-semibold text-emerald-700">
              {formatWorkdays(data.totals.workdays)}
              <span className="text-base font-normal text-slate-500">
                {" "}/ {data.totals.standardWorkdays}
              </span>
            </div>
            <div className="mt-0.5 text-sm text-slate-600">
              Ngày công / ngày công tháng
            </div>
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
                  <th className="px-4 py-3 text-center font-semibold text-slate-900">
                    Công
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-900">
                    Trạng thái
                  </th>
                  <th className="w-40 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => {
                  const highlight = rowHighlight(day);
                  return (
                    <tr
                      key={day.date}
                      title={highlight.title}
                      className={`border-b border-slate-100 last:border-0 ${highlight.className}`}
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
                      <td className="px-4 py-3 text-center font-medium tabular-nums text-slate-900">
                        {day.workdayValue > 0 ? (
                          formatWorkdays(day.workdayValue)
                        ) : (
                          <span className="text-slate-400">—</span>
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
                          {day.adminEdited && (
                            <Badge tone="warning">Admin đổi lịch</Badge>
                          )}
                          {day.pendingRequest && (
                            <Badge tone="warning">Chờ duyệt đổi ca</Badge>
                          )}
                          {day.needsReview && (
                            <Badge tone="warning">Chờ xem lại</Badge>
                          )}
                          {day.reviewDecision === "count" && (
                            <Badge tone="success">Đã duyệt tính công</Badge>
                          )}
                          {day.reviewDecision === "exclude" && (
                            <Badge tone="danger">Không tính công</Badge>
                          )}
                        </div>
                        {day.note && (
                          <div className="mt-1 text-xs text-slate-500">{day.note}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {day.status === "insufficient" && (
                            <>
                              <Button
                                variant={
                                  day.reviewDecision === "count" ? "primary" : "secondary"
                                }
                                size="sm"
                                onClick={() => reviewDay(day, "count")}
                                title="Vẫn tính đủ công (bấm lại để bỏ chọn)"
                                aria-label={`Tính công ngày ${day.date}`}
                                aria-pressed={day.reviewDecision === "count"}
                              >
                                <Check size={14} aria-hidden="true" />
                              </Button>
                              <Button
                                variant={
                                  day.reviewDecision === "exclude" ? "danger" : "secondary"
                                }
                                size="sm"
                                onClick={() => reviewDay(day, "exclude")}
                                title="Không tính công ngày này (bấm lại để bỏ chọn)"
                                aria-label={`Không tính công ngày ${day.date}`}
                                aria-pressed={day.reviewDecision === "exclude"}
                              >
                                <X size={14} aria-hidden="true" />
                              </Button>
                            </>
                          )}
                          {day.reports.length > 0 && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setReportDay(day)}
                              title={`Nội dung công việc · ${formatDuration(day.reportMinutes)}`}
                              aria-label={`Xem nội dung công việc ngày ${day.date}`}
                            >
                              <NotebookText size={14} aria-hidden="true" />
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(day)}
                            aria-label={`Sửa công ngày ${day.date}`}
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )
      )}

      <Modal
        open={reportDay !== null}
        title={`Nội dung công việc ngày ${reportDay?.date ?? ""}`}
        onClose={() => setReportDay(null)}
      >
        <p className="mb-2 text-sm text-slate-600">
          Nhân viên tự khai, tổng {formatDuration(reportDay?.reportMinutes ?? 0)}.
        </p>
        <ul className="divide-y divide-slate-100">
          {reportDay?.reports.map((report) => (
            <li key={report.id} className="py-3">
              <div className="text-sm font-medium tabular-nums text-slate-900">
                {report.start} – {report.end}
                <span className="ml-2 font-normal text-slate-500">
                  {formatDuration(report.minutes)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {report.content}
              </p>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={editingDay !== null}
        title={`Sửa công ngày ${editingDay?.date ?? ""}`}
        onClose={() => setEditingDay(null)}
      >
        <form onSubmit={saveDay} className="space-y-4">
          <p className="text-sm text-slate-600">
            Một giờ vào, giờ ra có thể nhiều lần và phải sau giờ vào; giờ công
            tính theo lần ra muộn nhất. Xoá hết dòng để đánh dấu không có công.
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
