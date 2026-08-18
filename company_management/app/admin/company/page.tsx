"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import PageHeader from "../_components/page-header";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";

export default function CompanySettingsPage() {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings/company")
      .then((response) => response.json())
      .then((data) => setCompanyName(data.value || ""))
      .catch(() =>
        setMessage({ type: "error", text: "Không tải được tên công ty" })
      )
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: companyName.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể lưu");
      setCompanyName(data.value);
      setMessage({ type: "success", text: "Đã lưu tên công ty" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Thiết lập công ty"
        description="Tên này hiển thị trên trang đăng nhập của nhân viên."
      />

      <Card className="max-w-2xl">
        <div className="space-y-4 p-5">
          <Field label="Tên công ty" required>
            {loading ? (
              <div className="h-11 w-full animate-pulse rounded-md bg-slate-100" />
            ) : (
              <Input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                maxLength={120}
                placeholder="Công ty TNHH ABC"
              />
            )}
          </Field>

          {message && (
            <Message type={message.type} onDismiss={() => setMessage(null)}>
              {message.text}
            </Message>
          )}

          <div className="flex justify-end">
            <Button
              onClick={save}
              disabled={loading || saving || !companyName.trim()}
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
