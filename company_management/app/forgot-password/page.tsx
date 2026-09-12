"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";
import {
  CompanyLogo,
  useCompanyBranding,
} from "@/app/_components/company-brand";

export default function ForgotPasswordPage() {
  const { name: companyName, logo } = useCompanyBranding();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không gửi được yêu cầu");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được yêu cầu");
    } finally {
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
            <p className="mt-1 text-sm text-slate-600">Quên mật khẩu</p>
          </div>

          {done ? (
            <Message type="success">
              Nếu email có trong hệ thống, đường link đặt lại mật khẩu đã được gửi.
              Link có hiệu lực 60 phút, hãy kiểm tra cả hộp thư spam.
            </Message>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field
                label="Email đăng nhập"
                required
                hint="Hệ thống sẽ gửi đường link đặt lại mật khẩu vào email này."
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nhanvien@congty.vn"
                  autoComplete="username"
                  required
                />
              </Field>

              {error && <Message type="error">{error}</Message>}

              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? "Đang gửi..." : "Gửi link đặt lại"}
              </Button>
            </form>
          )}
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
