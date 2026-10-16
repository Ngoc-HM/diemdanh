"use client";

import DashboardPageHeader from "@/app/dashboard/_components/page-header";
import DeviceCard from "@/app/dashboard/_components/device-card";

export default function DevicesPage() {
  return (
    <div className="space-y-4">
      <DashboardPageHeader title="Đăng ký thiết bị" />
      <DeviceCard className="max-w-3xl" />
    </div>
  );
}
