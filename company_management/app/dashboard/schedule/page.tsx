"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Save } from "lucide-react";
import { Button, Card, Message } from "@/app/_components/ui";
import {
  addMonths,
  dateKeyVN,
  formatMonthLabel,
  monthKeyVN,
  weekdayLabel,
} from "@/lib/datetime";
import { toggleSessionSelection } from "@/lib/schedule";
import DashboardPageHeader from "@/app/dashboard/_components/page-header";
import MonthNav from "@/app/dashboard/_components/month-nav";

type SessionRule = {
  id: string;
  code: string;
  name: string;
  workStart: string;
  workEnd: string;
  minHours: number;
};

type Payload = {
  month: string;
  employmentType: string;
  selfScheduled: boolean;
  /// Nhân viên tự đăng ký và tháng này đang trong cửa sổ đăng ký.
  canEdit: boolean;
  openMonth: string | null;
  window: { opensOn: string; closesOn: string };
  sessions: SessionRule[];
  dates: string[];
  days: Record<string, string[]>;
  offDays: string[];
  adminEdited: string[];
  /// Ngày đang có yêu cầu đổi ca chờ duyệt: khoá và tô vàng như admin đã sửa.
  pendingDates: string[];
  /// Ngày có lịch mà không bấm giờ: ô đang có ca tô đỏ.
  absentDates: string[];
  /// Ngày đi làm không đăng ký lịch (vẫn tính công): đầu cột tô vàng nhẹ.
  unscheduledDates: string[];
};

function formatDateVN(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

/// Vì sao lưới đang ở chế độ chỉ xem; null nghĩa là được sửa.
function readOnlyReason(data: Payload): string | null {
  if (!data.selfScheduled) {
    return "Nhân viên toàn thời gian dùng lịch cố định do hệ thống gán, không cần đăng ký. Cần đổi ca hoặc nghỉ một ngày thì gửi yêu cầu ở tab Chỉnh sửa ca.";
  }
  if (data.canEdit) return null;

  const label = formatMonthLabel(data.month);
  const range = `từ ${formatDateVN(data.window.opensOn)} đến hết ${formatDateVN(data.window.closesOn)}`;
  if (dateKeyVN() < data.window.opensOn) {
    return `Chưa mở đăng ký. Lịch ${label} nhận đăng ký ${range}.`;
  }
  return `Đã hết hạn đăng ký. Lịch ${label} chỉ nhận đăng ký ${range}; muốn đổi một ngày cụ thể thì gửi yêu cầu ở tab Chỉnh sửa ca.`;
}

/// Nhấn mạnh của một ô, ngoài chuyện đang có ca hay không:
/// - "absent": có ca mà không bấm giờ → đỏ, chỉ tô ở ô đang có ca;
/// - "pending": đang chờ duyệt đổi ca → vàng, khoá cả cột;
/// - "edited": admin đã sửa → vàng, khoá cả cột;
/// - null: ô thường.
type CellHighlight = "absent" | "pending" | "edited" | null;

const CELL_TITLES: Record<NonNullable<CellHighlight>, string> = {
  absent: "Có lịch nhưng không chấm công",
  pending: "Đang chờ duyệt yêu cầu đổi ca",
  edited: "Admin đã sửa ngày này, liên hệ quản trị viên để đổi",
};

/// Màu ô đang có ca: sky cho ca làm, slate cho N; nhạt đi khi chỉ xem.
const ACTIVE_CELL: Record<"sky" | "slate", { editable: string; readOnly: string }> = {
  sky: {
    editable: "bg-sky-600 text-white hover:bg-sky-700",
    readOnly: "cursor-default bg-sky-100 text-sky-800",
  },
  slate: {
    editable: "bg-slate-700 text-white hover:bg-slate-800",
    readOnly: "cursor-default bg-slate-200 text-slate-800",
  },
};

/// Ô trong lưới. Ô khoá (admin sửa / chờ duyệt) luôn nền vàng kể cả khi đang
/// có ca, để nhân viên nhận ra ngay ô nào mình không đổi được; ô vắng nền đỏ.
function cellClass(options: {
  active: boolean;
  highlight: CellHighlight;
  readOnly: boolean;
  tone: "sky" | "slate";
}) {
  const { active, highlight, readOnly, tone } = options;
  const base = "h-8 w-full rounded-md text-xs font-medium transition-colors";

  if (highlight === "absent") {
    return `${base} cursor-default bg-rose-100 text-rose-700`;
  }
  if (highlight) {
    return `${base} cursor-not-allowed bg-amber-100 text-amber-800 ${
      active ? "ring-2 ring-inset ring-amber-400" : ""
    }`;
  }
  if (!active) {
    return `${base} ${
      readOnly
        ? "cursor-default bg-slate-50 text-slate-300"
        : "bg-slate-50 text-slate-400 hover:bg-slate-100"
    }`;
  }
  return `${base} ${ACTIVE_CELL[tone][readOnly ? "readOnly" : "editable"]}`;
}

export default function SchedulePage() {
  const [month, setMonth] = useState(() => addMonths(monthKeyVN(), 1));
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [offDraft, setOffDraft] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/schedule?month=${target}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được lịch");
      setData(payload);
      setDraft(payload.days);
      setOffDraft(new Set<string>(payload.offDays ?? []));
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Lỗi không xác định",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  /// Chọn ca theo quy tắc chung (CN loại trừ S/C, T cộng thêm).
  /// Đăng ký ca thì bỏ đánh dấu nghỉ của ngày đó.
  function toggle(date: string, rule: SessionRule) {
    if (!data) return;
    const codeById = new Map(data.sessions.map((item) => [item.id, item.code]));

    setOffDraft((current) => {
      if (!current.has(date)) return current;
      const next = new Set(current);
      next.delete(date);
      return next;
    });

    setDraft((current) => {
      const next = toggleSessionSelection(current[date] ?? [], rule.id, codeById);
      const copy = { ...current };
      if (next.length === 0) delete copy[date];
      else copy[date] = next;
      return copy;
    });
  }

  /// Đăng ký nghỉ: xoá hết ca của ngày đó.
  function toggleOff(date: string) {
    setOffDraft((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else {
        next.add(date);
        setDraft((days) => {
          const copy = { ...days };
          delete copy[date];
          return copy;
        });
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, days: draft, offDays: [...offDraft] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể lưu");

      setMessage({
        type: "success",
        text: `Đã lưu lịch ${formatMonthLabel(month)} — ${result.savedDays} ca`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    } finally {
      setSaving(false);
    }
  }

  const adminEdited = new Set(data?.adminEdited ?? []);
  const pendingDates = new Set(data?.pendingDates ?? []);
  const absentDates = new Set(data?.absentDates ?? []);
  const unscheduledDates = new Set(data?.unscheduledDates ?? []);

  /// Nhấn mạnh chung cho cả cột ngày (khoá không cho bấm). Chờ duyệt xét
  /// trước admin đã sửa vì đó là việc đang treo, cần nhân viên để ý hơn.
  function dayHighlight(date: string): CellHighlight {
    if (pendingDates.has(date)) return "pending";
    if (adminEdited.has(date)) return "edited";
    return null;
  }

  /// Nhấn mạnh của từng ô ca: vắng chỉ tô ở ô đang có ca của ngày đó, và
  /// thắng vàng vì "không đi" là sự thật đã xảy ra, còn vàng chỉ là ghi chú.
  function cellHighlight(date: string, active: boolean): CellHighlight {
    if (active && absentDates.has(date)) return "absent";
    return dayHighlight(date);
  }

  const readOnly = data ? !data.canEdit : true;
  const reason = data ? readOnlyReason(data) : null;
  const totalShifts = Object.values(draft).reduce(
    (sum, ids) => sum + ids.length,
    0
  );
  const plannedHours =
    data?.sessions && totalShifts > 0
      ? Object.values(draft)
          .flat()
          .reduce((sum, id) => {
            const rule = data.sessions.find((item) => item.id === id);
            return sum + (rule?.minHours ?? 0);
          }, 0)
      : 0;

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="Đăng ký lịch làm việc"
        actions={<MonthNav month={month} onChange={setMonth} />}
      />

      {message && (
        <Message type={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </Message>
      )}

      {loading ? (
        <div className="h-96 animate-pulse rounded-xl bg-slate-200" aria-hidden="true" />
      ) : data ? (
        <>
          {reason && <Message type="info">{reason}</Message>}

          <Card className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{totalShifts}</span>{" "}
                ca
                {offDraft.size > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-slate-900">
                      {offDraft.size}
                    </span>{" "}
                    ngày nghỉ
                  </>
                )}
                {plannedHours > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-slate-900">
                      {Math.round(plannedHours * 10) / 10}h
                    </span>{" "}
                    dự kiến
                  </>
                )}
              </div>
              {readOnly ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                  <Eye size={16} aria-hidden="true" />
                  Chỉ xem
                </span>
              ) : (
                <Button onClick={save} disabled={saving}>
                  <Save size={16} aria-hidden="true" />
                  {saving ? "Đang lưu..." : "Lưu lịch"}
                </Button>
              )}
            </div>
          </Card>

          {/* Lưới đăng ký: hàng = ca, cột = ngày trong tháng */}
          <Card className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 min-w-40 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-900">
                    Ca
                  </th>
                  {data.dates.map((date) => {
                    const weekend = ["T7", "CN"].includes(weekdayLabel(date));
                    // Đi làm mà không có ca nào để tô, nên nhấn ở đầu cột.
                    const unscheduled = unscheduledDates.has(date);
                    return (
                      <th
                        key={date}
                        title={
                          unscheduled
                            ? "Đi làm không đăng ký lịch, vẫn tính công"
                            : undefined
                        }
                        className={`min-w-12 px-1.5 py-2 text-center font-medium ${
                          weekend ? "text-rose-600" : "text-slate-500"
                        } ${unscheduled ? "bg-amber-50" : ""}`}
                      >
                        <div>{date.slice(8, 10)}</div>
                        <div className="text-xs font-normal text-slate-400">
                          {weekdayLabel(date)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((rule) => (
                  <tr key={rule.id} className="border-b border-slate-100">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2">
                      <div className="font-medium text-slate-900">{rule.code}</div>
                      <div className="text-xs text-slate-500">
                        {rule.workStart}–{rule.workEnd} ({rule.minHours}h)
                      </div>
                    </td>
                    {data.dates.map((date) => {
                      const active = (draft[date] ?? []).includes(rule.id);
                      const highlight = cellHighlight(date, active);
                      return (
                        <td key={date} className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(date, rule)}
                            disabled={readOnly || dayHighlight(date) !== null}
                            aria-pressed={active}
                            aria-label={`${rule.code} ngày ${date}`}
                            title={highlight ? CELL_TITLES[highlight] : undefined}
                            className={cellClass({ active, highlight, readOnly, tone: "sky" })}
                          >
                            {active ? rule.code : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Nghỉ: chọn N là ngày đó không đăng ký ca nào */}
                <tr>
                  <td className="sticky left-0 z-10 bg-white px-3 py-2">
                    <div className="font-medium text-slate-900">N</div>
                    <div className="text-xs text-slate-500">Nghỉ</div>
                  </td>
                  {data.dates.map((date) => {
                    const active = offDraft.has(date);
                    // Ngày nghỉ N không bao giờ bị tính vắng nên hàng N chỉ
                    // cần nhấn mạnh chung của cột.
                    const highlight = dayHighlight(date);
                    return (
                      <td key={date} className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => toggleOff(date)}
                          disabled={readOnly || highlight !== null}
                          aria-pressed={active}
                          aria-label={`Nghỉ ngày ${date}`}
                          title={highlight ? CELL_TITLES[highlight] : undefined}
                          className={cellClass({ active, highlight, readOnly, tone: "slate" })}
                        >
                          {active ? "N" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Một dòng ký hiệu là đủ: giờ giấc từng ca đã nằm ngay ở cột trái
              của lưới, không lặp lại thành một danh sách dài. */}
          <p className="px-1 text-sm text-slate-500">
            {[
              ...data.sessions.map((rule) => [rule.code, rule.name] as const),
              ["N", "Nghỉ"] as const,
              ["O", "Ốm"] as const,
            ].map(([code, name], index) => (
              <span key={code}>
                {index > 0 && <span className="mx-2 text-slate-300">·</span>}
                <span className="font-semibold text-slate-700">{code}</span> {name}
              </span>
            ))}
          </p>
        </>
      ) : null}
    </div>
  );
}
