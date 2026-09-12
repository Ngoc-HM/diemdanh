"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Trash2, Upload } from "lucide-react";
import PageHeader from "../_components/page-header";
import { Button, Card, Field, Input, Message } from "@/app/_components/ui";
import { CompanyLogo } from "@/app/_components/company-brand";

export default function CompanySettingsPage() {
  const [companyName, setCompanyName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings/company")
      .then((response) => response.json())
      .then((data) => {
        setCompanyName(data.value || "");
        setLogo(data.logo ?? null);
      })
      .catch(() =>
        setMessage({ type: "error", text: "Không tải được thiết lập công ty" })
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

  async function uploadLogo(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/settings/company", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không tải lên được");
      // Thêm query để trình duyệt không dùng ảnh cache cùng tên file.
      setLogo(`${data.logo}?v=${Date.now()}`);
      setMessage({ type: "success", text: "Đã cập nhật logo" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không tải lên được",
      });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeLogo() {
    if (!confirm("Gỡ logo hiện tại?")) return;
    const response = await fetch("/api/settings/company", { method: "DELETE" });
    if (response.ok) {
      setLogo(null);
      setMessage({ type: "success", text: "Đã gỡ logo" });
    } else {
      const data = await response.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Không thể gỡ logo" });
    }
  }

  return (
    <>
      <PageHeader
        title="Thiết lập công ty"
        description="Tên và logo hiển thị trên trang đăng nhập và đầu trang của nhân viên."
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

          <Field label="Logo" hint="PNG, JPG hoặc WebP — tối đa 2MB.">
            <div className="flex items-center gap-4">
              <CompanyLogo logo={logo} size="lg" />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={14} aria-hidden="true" />
                  {uploading ? "Đang tải lên..." : logo ? "Đổi logo" : "Tải logo lên"}
                </Button>
                {logo && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={removeLogo}
                    disabled={uploading}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Gỡ
                  </Button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadLogo(file);
                }}
              />
            </div>
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
