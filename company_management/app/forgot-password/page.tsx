"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";
import {
  CompanyLogo,
  useCompanyBranding,
} from "@/app/_components/company-brand";

/// Hai bước trên cùng một trang: nhập email nhận mã, rồi nhập mã 8 số kèm mật
/// khẩu mới. Giữ nguyên email đã nhập nên không phải gõ lại.
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { name: companyName, logo } = useCompanyBranding();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không gửi được mã");
      setStep("code");
      setNotice(
        "Nếu email có trong hệ thống, mã 8 số đã được gửi. Kiểm tra cả hộp thư spam."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được mã");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
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
        body: JSON.stringify({ email, code, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không đổi được mật khẩu");
      setNotice("Đã đổi mật khẩu. Đang chuyển sang trang đăng nhập...");
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được mật khẩu");
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

          {notice && (
            <div className="mb-4">
              <Message type="info">{notice}</Message>
            </div>
          )}
          {error && (
            <div className="mb-4">
              <Message type="error">{error}</Message>
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={sendCode} className="space-y-4">
              <Field label="Email" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nhanvien@congty.vn"
                  required
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Đang gửi..." : "Gửi mã"}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="space-y-4">
              <Field label="Mã 8 số trong email" required>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{8}"
                  maxLength={8}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  placeholder="12345678"
                  className="text-center text-lg tracking-[0.4em]"
                  required
                />
              </Field>
              <Field label="Mật khẩu mới" required hint="Ít nhất 6 ký tự">
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </Field>
              <Field label="Nhập lại mật khẩu mới" required>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  minLength={6}
                  required
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Đang đổi..." : "Đổi mật khẩu"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Đổi email
                </button>
                <button
                  type="button"
                  onClick={() => sendCode()}
                  disabled={loading}
                  className="font-medium text-sky-700 hover:underline disabled:text-slate-400"
                >
                  Gửi lại mã
                </button>
              </div>
            </form>
          )}
        </Card>

        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="font-medium text-sky-700 hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
