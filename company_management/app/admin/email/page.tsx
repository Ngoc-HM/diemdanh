"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Save, Send } from "lucide-react";
import PageHeader from "../_components/page-header";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";
import { formatMonthLabel } from "@/lib/datetime";
import {
  DEFAULT_REGISTRATION_WINDOW,
  RegistrationWindowConfig,
} from "@/lib/schedule";

type ConfigView = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  hasPassword: boolean;
  from: string;
  reminderEnabled: boolean;
  notifyEnabled: boolean;
};

type Payload = { config: ConfigView; lastReminderMonth: string | null };

const EMPTY_FORM = {
  host: "",
  port: "587",
  secure: false,
  user: "",
  password: "",
  from: "",
  reminderEnabled: true,
  notifyEnabled: true,
};

export default function EmailSettingsPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [hasPassword, setHasPassword] = useState(false);
  const [lastReminderMonth, setLastReminderMonth] = useState<string | null>(null);
  // Ngày mở đăng ký do admin đặt ở trang Lịch làm việc — email nhắc đi theo mốc đó.
  const [registrationWindow, setRegistrationWindow] =
    useState<RegistrationWindowConfig>(DEFAULT_REGISTRATION_WINDOW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/email-settings");
      const payload: Payload = await response.json();
      if (!response.ok) throw new Error("Không tải được cấu hình email");
      setForm({
        host: payload.config.host,
        port: String(payload.config.port),
        secure: payload.config.secure,
        user: payload.config.user,
        password: "",
        from: payload.config.from,
        reminderEnabled: payload.config.reminderEnabled,
        notifyEnabled: payload.config.notifyEnabled,
      });
      setHasPassword(payload.config.hasPassword);
      setLastReminderMonth(payload.lastReminderMonth);
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
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/settings/schedule-window")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => payload && setRegistrationWindow(payload))
      .catch(() => undefined);
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể lưu");
      setHasPassword(data.config.hasPassword);
      setForm((current) => ({ ...current, password: "" }));
      setMessage({ type: "success", text: "Đã lưu cấu hình email" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/email-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gửi thất bại");
      setMessage({ type: "success", text: `Đã gửi email thử tới ${testTo}` });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Gửi thất bại",
      });
    } finally {
      setTesting(false);
    }
  }

  async function remindNow() {
    if (!confirm("Gửi email nhắc đăng ký lịch tới toàn bộ nhân viên bán thời gian và thực tập ngay bây giờ?")) {
      return;
    }
    setReminding(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/email-settings/remind", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gửi thất bại");
      if (data.skipped) {
        setMessage({ type: "info", text: `Không gửi: ${data.skipped}` });
      } else {
        setMessage({
          type: "success",
          text: `Đã gửi ${data.sent}/${data.total} email nhắc đăng ký lịch ${formatMonthLabel(data.month)}`,
        });
        setLastReminderMonth(data.month);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Gửi thất bại",
      });
    } finally {
      setReminding(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Email (SMTP)"
        description="Máy chủ gửi email dùng cho quên mật khẩu, nhắc đăng ký lịch và thông báo cho nhân viên. Cấu hình lưu trong hệ thống, mật khẩu được mã hoá."
      />

      {message && (
        <div className="mb-4">
          <Message type={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </Message>
        </div>
      )}

      {loading ? (
        <div className="h-96 animate-pulse rounded-xl bg-slate-200" aria-hidden="true" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <form onSubmit={save} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                <Field label="Máy chủ SMTP" required>
                  <Input
                    value={form.host}
                    onChange={(event) => setForm({ ...form, host: event.target.value })}
                    placeholder="smtp.gmail.com"
                    required
                  />
                </Field>
                <Field label="Cổng" required>
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={form.port}
                    onChange={(event) => setForm({ ...form, port: event.target.value })}
                    required
                  />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.secure}
                  onChange={(event) => setForm({ ...form, secure: event.target.checked })}
                  className="h-4 w-4 rounded-sm border-slate-300 text-sky-600"
                />
                Kết nối SSL/TLS ngay từ đầu (cổng 465). Bỏ chọn nếu dùng cổng 587.
              </label>

              <Field label="Tài khoản đăng nhập SMTP" hint="Để trống nếu máy chủ không yêu cầu đăng nhập">
                <Input
                  value={form.user}
                  onChange={(event) => setForm({ ...form, user: event.target.value })}
                  placeholder="noreply@congty.vn"
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Mật khẩu SMTP"
                hint={hasPassword ? "Đã lưu. Để trống nếu không đổi." : undefined}
              >
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder={hasPassword ? "••••••••" : ""}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Địa chỉ người gửi" required hint="Ví dụ: Chấm công <noreply@congty.vn>">
                <Input
                  value={form.from}
                  onChange={(event) => setForm({ ...form, from: event.target.value })}
                  placeholder="Chấm công <noreply@congty.vn>"
                  required
                />
              </Field>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Save size={16} aria-hidden="true" />
                  {saving ? "Đang lưu..." : "Lưu cấu hình"}
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900">Gửi email thử</h3>
              <p className="mt-1 text-sm text-slate-600">
                Lưu cấu hình trước, rồi gửi thử để chắc chắn máy chủ SMTP hoạt động.
              </p>
              <div className="mt-3 flex gap-2">
                <Input
                  type="email"
                  value={testTo}
                  onChange={(event) => setTestTo(event.target.value)}
                  placeholder="email nhận thử"
                />
                <Button
                  variant="secondary"
                  onClick={sendTest}
                  disabled={testing || !testTo}
                  className="shrink-0 whitespace-nowrap"
                >
                  <Send size={16} aria-hidden="true" />
                  {testing ? "Đang gửi..." : "Gửi thử"}
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-slate-900">Nhắc đăng ký lịch</h3>
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.reminderEnabled}
                  onChange={(event) =>
                    setForm({ ...form, reminderEnabled: event.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-sky-600"
                />
                <span>
                  Tự động gửi email vào ngày {registrationWindow.openDay} hằng tháng cho nhân
                  viên bán thời gian và thực tập, nhắc đăng ký lịch tháng sau. Bấm
                  “Lưu cấu hình” để áp dụng.
                </span>
              </label>
              <p className="mt-3 text-sm text-slate-600">
                Lần gửi gần nhất:{" "}
                <span className="font-medium text-slate-900">
                  {lastReminderMonth
                    ? `lịch ${formatMonthLabel(lastReminderMonth)}`
                    : "chưa gửi lần nào"}
                </span>
              </p>
              <div className="mt-3">
                <Button variant="secondary" onClick={remindNow} disabled={reminding}>
                  <BellRing size={16} aria-hidden="true" />
                  {reminding ? "Đang gửi..." : "Gửi nhắc ngay"}
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-slate-900">Thông báo cho nhân viên</h3>
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.notifyEnabled}
                  onChange={(event) =>
                    setForm({ ...form, notifyEnabled: event.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-sky-600"
                />
                <span>
                  Gửi email cho nhân viên mỗi khi admin sửa giờ chấm công, chấm lại ô
                  ngày, quyết định ngày thiếu giờ, duyệt / từ chối đổi ca và OT. Bấm
                  “Lưu cấu hình” để áp dụng.
                </span>
              </label>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
