import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mã có mặt" };

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
