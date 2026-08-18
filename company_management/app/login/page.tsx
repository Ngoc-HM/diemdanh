"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/company")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setCompanyName(data?.value || "Công ty của bạn"))
      .catch(() => setCompanyName("Công ty của bạn"));
  }, []);

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
      router.push("/dashboard");
      router.refresh();
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
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Building2 size={24} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {companyName || " "}
            </h1>
            <p className="mt-1 text-sm text-slate-600">Hệ thống chấm công nội bộ</p>
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
          Quên mật khẩu? Liên hệ quản trị viên để được đặt lại.
        </p>
      </div>
    </div>
  );
}
