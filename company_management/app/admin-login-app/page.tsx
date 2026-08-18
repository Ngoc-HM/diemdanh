"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Đăng nhập thất bại");
      router.push("/admin/attendance");
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
              <ShieldCheck size={24} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Quản trị viên</h1>
            <p className="mt-1 text-sm text-slate-600">
              Khu vực dành cho người quản lý chấm công
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Tài khoản" required>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
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
      </div>
    </div>
  );
}
