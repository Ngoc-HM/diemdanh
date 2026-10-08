"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import PageHeader from "../_components/page-header";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";
import TwoFactorCard from "@/app/_components/two-factor-card";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Xác nhận mật khẩu không khớp" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/auth/admin/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể đổi mật khẩu");

      setMessage({ type: "success", text: "Đã đổi mật khẩu" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể đổi mật khẩu",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Tài khoản"
        description="Xác thực 2 lớp và mật khẩu quản trị. Đổi mật khẩu hay bật / tắt 2 lớp sẽ đăng xuất mọi máy khác."
      />

      <div className="grid max-w-6xl items-start gap-4 xl:grid-cols-2">
        <TwoFactorCard />

        <Card>
          <form onSubmit={submit} className="space-y-4 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Đổi mật khẩu
            </h2>
            <Field label="Mật khẩu hiện tại" required>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="Mật khẩu mới" required hint="Ít nhất 8 ký tự">
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field label="Nhập lại mật khẩu mới" required>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>

            {message && (
              <Message type={message.type} onDismiss={() => setMessage(null)}>
                {message.text}
              </Message>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                <KeyRound size={16} aria-hidden="true" />
                {saving ? "Đang lưu..." : "Đổi mật khẩu"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
