import { useEffect, useState } from "react";
import { Button, Card, Message } from "@/app/_components/ui";

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
  { value: 0, label: "Chủ nhật" },
];

/// Chỉ dùng trong trang client (Lịch làm việc), nên không cần "use client".
/// Ngày nghỉ hằng tuần (Settings weekly_off_days). Khác ngày lễ: ngày nghỉ
/// tuần không có lịch, không tính vào ngày công tháng, OT tính 200%; ngày lễ
/// vẫn được tính công, OT tính 300%.
export default function WeeklyOffCard({ onSaved }: { onSaved?: () => void }) {
  const [weeklyOff, setWeeklyOff] = useState<number[]>([0, 6]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings/weekly-off")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.days)) setWeeklyOff(data.days);
      })
      .catch(() => undefined);
  }, []);

  function toggle(day: number) {
    setWeeklyOff((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/weekly-off", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: weeklyOff }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể lưu");
      setWeeklyOff(data.days);
      setMessage({ type: "success", text: "Đã lưu ngày nghỉ hằng tuần" });
      onSaved?.();
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
    <Card className="mb-6 p-5">
      <h3 className="text-base font-semibold text-slate-900">Ngày nghỉ hằng tuần</h3>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Nhân viên toàn thời gian không có lịch vào các ngày này, và chúng không
        nằm trong ngày công tháng (mặc định Thứ 7 và Chủ nhật). Đi làm ngày nghỉ
        phải làm phiếu OT, tính hệ số ngày nghỉ.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {WEEKDAY_OPTIONS.map((option) => {
          const active = weeklyOff.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              aria-pressed={active}
              className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
                active
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
        <Button size="sm" className="ml-auto" onClick={save} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
      {message && (
        <div className="mt-3">
          <Message type={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </Message>
        </div>
      )}
    </Card>
  );
}
