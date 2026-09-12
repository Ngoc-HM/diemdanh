"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";
import {
  CompanyLogo,
  useCompanyBranding,
} from "@/app/_components/company-brand";

/// Đọc token từ URL nên phải nằm trong Suspense (yêu cầu của useSearchParams
/// khi trang được prerender tĩnh).
function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <Message type="error">
        Đường link không hợp lệ. Hãy yêu cầu lại từ trang quên mật khẩu.
      </Message>
    );
  }

  if (done) {
    return (
      <Message type="success">
        Đã đặt mật khẩu mới. Bạn có thể đăng nhập bằng mật khẩu vừa đặt.
      </Message>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Xác nhận mật khẩu không khớp");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không đặt được mật khẩu");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đặt được mật khẩu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Mật khẩu mới" required hint="Ít nhất 6 ký tự">
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>
      <Field label="Nhập lại mật khẩu mới" required>
        <Input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
        />
      </Field>

      {error && <Message type="error">{error}</Message>}

      <Button type="submit" size="lg" disabled={loading} className="w-full">
        {loading ? "Đang lưu..." : "Đặt mật khẩu mới"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { name: companyName, logo } = useCompanyBranding();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <Card className="p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <CompanyLogo logo={logo} size="lg" className="mb-3" />
            <h1 className="min-h-8 text-2xl font-semibold text-slate-900">
              {companyName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">Đặt lại mật khẩu</p>
          </div>
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-500">
          <Link href="/login" className="font-medium text-sky-600 hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
