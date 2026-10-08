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
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /// Đúng mật khẩu nhưng tài khoản bật 2 lớp: chuyển sang ô nhập mã.
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");

  async function submit(url: string, body: Record<string, string>) {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        // Vé tạm 5 phút hết hạn: quay lại bước mật khẩu.
        if (
          needCode &&
          response.status === 401 &&
          /hết hạn/.test(data.error ?? "")
        ) {
          setNeedCode(false);
          setCode("");
        }
        throw new Error(data.error || "Đăng nhập thất bại");
      }
      if (data.twoFactorRequired) {
        setNeedCode(true);
        setLoading(false);
        return;
      }
      // Admin hay nhân viên đều đăng nhập ở đây; server trả trang đích theo
      // vai trò. Điều hướng cả trang để middleware đọc cookie mới; bị đẩy
      // ngược về đây thì form dựng lại, không kẹt ở "Đang đăng nhập...".
      window.location.assign(data.redirect || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (needCode) submit("/api/auth/login/2fa", { code });
    else submit("/api/auth/login", { identifier, password });
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
            {needCode ? (
              <>
                <p className="text-sm text-slate-600">
                  Mở app Google Authenticator trên điện thoại và nhập mã 6 số
                  của tài khoản{" "}
                  <span className="font-medium text-slate-900">
                    {identifier}
                  </span>
                  . Mất điện thoại thì nhập một mã dự phòng.
                </p>
                <Field label="Mã xác thực" required>
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={9}
                    autoFocus
                    required
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Email hoặc tên đăng nhập" required>
                  <Input
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
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
              </>
            )}

            {error && <Message type="error">{error}</Message>}

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full"
            >
              {loading
                ? "Đang đăng nhập..."
                : needCode
                  ? "Xác nhận"
                  : "Đăng nhập"}
            </Button>
            {needCode && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setNeedCode(false);
                  setCode("");
                  setError("");
                }}
              >
                Quay lại
              </Button>
            )}
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
