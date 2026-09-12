"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Save, Trash2, Upload } from "lucide-react";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";
import DashboardPageHeader from "@/app/dashboard/_components/page-header";

type Profile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  employeeCode: string | null;
};

type Feedback = { type: "success" | "error"; text: string };

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);

  /// Tên và email nằm trong cookie phiên nên sau khi lưu phải tải lại trang:
  /// header, sidebar và mọi trang khác mới đọc được giá trị mới.
  const applyProfile = useCallback((next: Profile) => {
    setProfile(next);
    setName(next.name);
    setEmail(next.email);
  }, []);

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((response) => response.json())
      .then((payload) => payload.profile && applyProfile(payload.profile))
      .catch(() => setFeedback({ type: "error", text: "Không tải được hồ sơ" }));
  }, [applyProfile]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      // Email là tên đăng nhập: đổi xong mà không nói rõ thì lần sau nhân viên
      // vẫn gõ email cũ và không vào được.
      const emailChanged = payload.profile.email !== profile?.email;
      applyProfile(payload.profile);
      setFeedback({
        type: "success",
        text: emailChanged
          ? `Đã lưu. Lần sau đăng nhập bằng ${payload.profile.email}`
          : "Đã lưu hồ sơ",
      });
      // Tải lại để tên mới hiện ở sidebar và header.
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không lưu được",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    setFeedback(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được ảnh lên");
      applyProfile(payload.profile);
      setFeedback({ type: "success", text: "Đã đổi ảnh đại diện" });
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không tải được ảnh lên",
      });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeAvatar() {
    setUploading(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/auth/profile", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không gỡ được ảnh");
      applyProfile(payload.profile);
      setFeedback({ type: "success", text: "Đã gỡ ảnh đại diện" });
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không gỡ được ảnh",
      });
    } finally {
      setUploading(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", text: "Xác nhận mật khẩu không khớp" });
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không đổi được mật khẩu");
      setFeedback({ type: "success", text: "Đã đổi mật khẩu" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không đổi được mật khẩu",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-4">
      <DashboardPageHeader title="Cài đặt" />

      {feedback && (
        <Message type={feedback.type} onDismiss={() => setFeedback(null)}>
          {feedback.text}
        </Message>
      )}

      <Card className="max-w-2xl">
        <form onSubmit={saveProfile} className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Hồ sơ</h2>

          <div className="flex items-center gap-4">
            {profile?.avatarUrl ? (
              // Ảnh nhân viên tự upload, kích thước tuỳ ý nên dùng thẻ img
              // thường thay vì next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt="Ảnh đại diện"
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xl font-semibold text-white"
              >
                {(profile?.name ?? "?").trim().slice(0, 1).toUpperCase()}
              </span>
            )}

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadAvatar(file);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                <Upload size={16} aria-hidden="true" />
                {uploading ? "Đang tải..." : "Đổi ảnh"}
              </Button>
              {profile?.avatarUrl && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={removeAvatar}
                  disabled={uploading}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Gỡ ảnh
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ và tên" required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
              />
            </Field>
            <Field label="Email đăng nhập" required hint="Đổi email là đổi tên đăng nhập">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              {profile?.employeeCode ? `Mã NV ${profile.employeeCode}` : ""}
            </span>
            <Button type="submit" disabled={savingProfile}>
              <Save size={16} aria-hidden="true" />
              {savingProfile ? "Đang lưu..." : "Lưu hồ sơ"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="max-w-2xl">
        <form onSubmit={savePassword} className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Đổi mật khẩu</h2>

          <Field label="Mật khẩu hiện tại" required>
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mật khẩu mới" required hint="Ít nhất 6 ký tự">
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={6}
                required
              />
            </Field>
            <Field label="Nhập lại mật khẩu mới" required>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
                required
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={savingPassword}>
              <KeyRound size={16} aria-hidden="true" />
              {savingPassword ? "Đang lưu..." : "Đổi mật khẩu"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
