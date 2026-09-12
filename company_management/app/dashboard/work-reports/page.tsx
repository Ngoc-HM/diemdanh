"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  Message,
  TableSkeleton,
  Textarea,
} from "@/app/_components/ui";
import {
  formatTimeVN,
  monthKeyVN,
  weekdayLabel,
} from "@/lib/datetime";
import {
  CONTENT_MAX_LENGTH,
  CONTENT_MIN_LENGTH,
  formatDuration,
} from "@/lib/work-reports";
import DashboardPageHeader from "@/app/dashboard/_components/page-header";

type Entry = {
  id: string;
  date: string;
  /// "HH:MM" giờ VN
  start: string;
  end: string;
  minutes: number;
  content: string;
};

type Day = { date: string; totalMinutes: number; entries: Entry[] };

type Payload = {
  month: string;
  today: string;
  checkInAt: string | null;
  lastOutAt: string | null;
  /// Khoảng có mặt hôm nay (vào → ra muộn nhất), null khi chưa đủ hai đầu.
  presentMinutes: number | null;
  days: Day[];
};

type Feedback = { type: "success" | "error"; text: string };

function formatDayVN(dateKey: string) {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

/// Giờ hiện tại theo múi giờ VN, không theo múi giờ của trình duyệt — mọi mốc
/// thời gian trong hệ thống đều là giờ VN.
function nowTimeVN() {
  return formatTimeVN(new Date());
}

export default function WorkReportsPage() {
  const month = monthKeyVN();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);

  // Form thêm khoảng mới
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newContent, setNewContent] = useState("");

  // Khoảng đang sửa
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editContent, setEditContent] = useState("");

  const load = useCallback(async (target: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/work-reports?month=${target}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Không tải được dữ liệu");
      setData(payload);
    } catch (error) {
      setFeedback({
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

  const today = data?.today ?? "";
  const todayDay = data?.days.find((day) => day.date === today) ?? null;
  const todayEntries = todayDay?.entries ?? [];
  const lastEntry = todayEntries.at(-1) ?? null;

  /// Khoảng đầu tiên trong ngày bắt đầu lúc nhân viên ngồi vào làm — gợi ý sẵn
  /// giờ check-in, chưa check-in thì lấy giờ hiện tại. Các khoảng sau nối
  /// thẳng vào giờ kết thúc của khoảng trước nên không có gì để nhập.
  useEffect(() => {
    if (!data || lastEntry) return;
    setNewStart((current) => {
      if (current) return current;
      return data.checkInAt ? formatTimeVN(new Date(data.checkInAt)) : nowTimeVN();
    });
  }, [data, lastEntry]);

  const startValue = lastEntry ? lastEntry.end : newStart;
  const trimmedNew = newContent.trim();
  const canAdd =
    Boolean(startValue) &&
    Boolean(newEnd) &&
    trimmedNew.length >= CONTENT_MIN_LENGTH &&
    trimmedNew.length <= CONTENT_MAX_LENGTH &&
    !saving;

  /// Mọi thao tác đều trả về danh sách mới của ngày, nhưng bảng lịch sử tháng
  /// cũng phải đổi theo nên tải lại cả tháng cho chắc.
  async function mutate(
    url: string,
    init: RequestInit,
    successText: string
  ): Promise<boolean> {
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(url, init);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      setFeedback({ type: "success", text: successText });
      await load(month);
      return true;
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không lưu được",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!canAdd) return;
    const body: Record<string, string> = {
      endTime: newEnd,
      content: trimmedNew,
    };
    // Chỉ khoảng đầu tiên mới gửi giờ bắt đầu; các khoảng sau do server nối.
    if (!lastEntry) body.startTime = startValue;

    const ok = await mutate(
      "/api/work-reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "Đã lưu khoảng công việc"
    );
    if (ok) {
      setNewEnd("");
      setNewContent("");
    }
  }

  function openEdit(entry: Entry, isFirst: boolean) {
    setEditingId(entry.id);
    setEditStart(isFirst ? entry.start : "");
    setEditEnd(entry.end);
    setEditContent(entry.content);
    setFeedback(null);
  }

  async function saveEdit(event: React.FormEvent, isFirst: boolean) {
    event.preventDefault();
    if (!editingId) return;
    const trimmed = editContent.trim();
    if (trimmed.length < CONTENT_MIN_LENGTH) return;

    const body: Record<string, string> = { endTime: editEnd, content: trimmed };
    if (isFirst) body.startTime = editStart;

    const ok = await mutate(
      `/api/work-reports/${editingId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "Đã cập nhật"
    );
    if (ok) setEditingId(null);
  }

  async function removeEntry(entry: Entry) {
    if (!confirm(`Xoá khoảng ${entry.start}–${entry.end}?`)) return;
    await mutate(
      `/api/work-reports/${entry.id}`,
      { method: "DELETE" },
      "Đã xoá khoảng công việc"
    );
  }

  const declaredMinutes = todayDay?.totalMinutes ?? 0;

  return (
    <div className="space-y-4">
      <DashboardPageHeader title="Nội dung công việc hằng ngày" />

      <Message type="info">Chỉ ghi và sửa được trong ngày hôm nay.</Message>

      {feedback && (
        <Message type={feedback.type} onDismiss={() => setFeedback(null)}>
          {feedback.text}
        </Message>
      )}

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl bg-slate-200" aria-hidden="true" />
      ) : (
        data && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Hôm nay {formatDayVN(today)} ({weekdayLabel(today)})
              </h2>
              <p className="text-sm text-slate-600">
                Tổng{" "}
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatDuration(declaredMinutes)}
                </span>
                {data.presentMinutes !== null && (
                  <> · có mặt {formatDuration(data.presentMinutes)}</>
                )}
              </p>
            </div>

            <ul className="divide-y divide-slate-100">
              {todayEntries.map((entry, index) => {
                const isFirst = index === 0;
                if (editingId === entry.id) {
                  return (
                    <li key={entry.id} className="bg-sky-50 px-5 py-4">
                      <form
                        onSubmit={(event) => saveEdit(event, isFirst)}
                        className="space-y-3"
                      >
                        <div className="flex flex-wrap items-end gap-3">
                          <Field label="Bắt đầu">
                            <Input
                              type="time"
                              className="w-36"
                              value={isFirst ? editStart : entry.start}
                              onChange={(event) => setEditStart(event.target.value)}
                              disabled={!isFirst}
                              required
                            />
                          </Field>
                          <Field label="Kết thúc">
                            <Input
                              type="time"
                              className="w-36"
                              value={editEnd}
                              onChange={(event) => setEditEnd(event.target.value)}
                              required
                            />
                          </Field>
                        </div>
                        <Textarea
                          value={editContent}
                          onChange={(event) => setEditContent(event.target.value)}
                          minLength={CONTENT_MIN_LENGTH}
                          maxLength={CONTENT_MAX_LENGTH}
                          required
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            <X size={14} aria-hidden="true" />
                            Huỷ
                          </Button>
                          <Button type="submit" size="sm" disabled={saving}>
                            <Check size={14} aria-hidden="true" />
                            {saving ? "Đang lưu..." : "Lưu"}
                          </Button>
                        </div>
                      </form>
                    </li>
                  );
                }

                return (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-start gap-3 px-5 py-3"
                  >
                    <div className="w-40 shrink-0">
                      <div className="font-medium tabular-nums text-slate-900">
                        {entry.start} – {entry.end}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDuration(entry.minutes)}
                      </div>
                    </div>
                    <p className="min-w-40 flex-1 whitespace-pre-wrap text-slate-700">
                      {entry.content}
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(entry, isFirst)}
                        aria-label={`Sửa khoảng ${entry.start}–${entry.end}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeEntry(entry)}
                        aria-label={`Xoá khoảng ${entry.start}–${entry.end}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <form onSubmit={addEntry} className="space-y-3 border-t border-slate-200 px-5 py-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Bắt đầu">
                  <Input
                    type="time"
                    className="w-36"
                    value={startValue}
                    onChange={(event) => setNewStart(event.target.value)}
                    disabled={Boolean(lastEntry)}
                    required
                  />
                </Field>
                <Field label="Kết thúc" required>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      className="w-36"
                      value={newEnd}
                      onChange={(event) => setNewEnd(event.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setNewEnd(nowTimeVN())}
                    >
                      <Clock3 size={16} aria-hidden="true" />
                      Bây giờ
                    </Button>
                  </div>
                </Field>
              </div>

              <Field
                label="Nội dung công việc"
                required
                hint={`${CONTENT_MIN_LENGTH}–${CONTENT_MAX_LENGTH} ký tự`}
              >
                <Textarea
                  value={newContent}
                  onChange={(event) => setNewContent(event.target.value)}
                  placeholder="Bạn đã làm gì trong khoảng thời gian này?"
                  minLength={CONTENT_MIN_LENGTH}
                  maxLength={CONTENT_MAX_LENGTH}
                  required
                />
              </Field>

              <div className="flex justify-end">
                <Button type="submit" disabled={!canAdd}>
                  <Plus size={16} aria-hidden="true" />
                  {saving ? "Đang lưu..." : "Thêm khoảng"}
                </Button>
              </div>
            </form>
          </Card>
        )
      )}

      {!loading && !data && <TableSkeleton rows={3} />}

    </div>
  );
}
