"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";
import {
  CompanyLogo,
  useCompanyBranding,
} from "@/app/_components/company-brand";

export default function LoginPage() {
  const { name: companyName, logo } = useCompanyBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Đăng nhập thất bại");
      // Điều hướng cả trang để middleware đọc cookie mới; bị đẩy ngược về đây
      // thì form dựng lại, không kẹt ở "Đang đăng nhập...".
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <Card className="p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <CompanyLogo logo={logo} size="lg" className="mb-3" />
            <h1 className="min-h-8 text-2xl font-semibold text-slate-900">
              {companyName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">Chấm công nội bộ</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nhanvien@congty.vn"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Mật khẩu" required>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            {error && <Message type="error">{error}</Message>}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-500">
          <Link
            href="/forgot-password"
            className="font-medium text-sky-600 hover:underline"
          >
            Quên mật khẩu?
          </Link>
        </p>
      </div>
    </div>
  );
}
