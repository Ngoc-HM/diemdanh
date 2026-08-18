"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import PageHeader from "../_components/page-header";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";

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
        title="Đổi mật khẩu"
        description="Mật khẩu quản trị được lưu dưới dạng băm, tối thiểu 8 ký tự."
      />

      <Card className="max-w-lg">
        <form onSubmit={submit} className="space-y-4 p-5">
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
    </>
  );
}
