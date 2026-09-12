"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

type Branding = { name: string; logo: string | null };

/// Tên công ty + logo do admin cấu hình ở trang Công ty. Mọi nơi cần
/// hiển thị thương hiệu (đăng nhập, header admin/user) đều đọc từ đây.
export function useCompanyBranding(): Branding {
  const [branding, setBranding] = useState<Branding>({ name: "", logo: null });

  useEffect(() => {
    fetch("/api/settings/company")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) =>
        setBranding({
          name: data?.value || "Công ty của bạn",
          logo: data?.logo ?? null,
        })
      )
      .catch(() => setBranding({ name: "Công ty của bạn", logo: null }));
  }, []);

  return branding;
}

/// Ô logo: có ảnh thì hiển thị ảnh trần (không viền, không nền), căn được theo
/// className; không có thì fallback icon mặc định.
export function CompanyLogo({
  logo,
  size = "md",
  className = "",
}: {
  logo: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "lg"
      ? "h-11 w-11"
      : size === "sm"
        ? "h-8 w-8"
        : "h-9 w-9";
  const height = size === "lg" ? "h-11" : size === "sm" ? "h-8" : "h-9";
  const icon = size === "lg" ? 24 : size === "sm" ? 16 : 18;

  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="Logo công ty" className={`${box} object-contain ${className}`} />
    );
  }

  return (
    <span
      className={`inline-flex items-center ${height} text-sky-600 ${className}`}
    >
      <Building2 size={icon} aria-hidden="true" />
    </span>
  );
}