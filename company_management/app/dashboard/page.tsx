"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, MapPin } from "lucide-react";
import { Badge, Button, Card, Message } from "@/app/_components/ui";
import type { DayStatus } from "@/lib/attendance-rules";
import { DAY_STATUS_TONE } from "@/app/_components/status-styles";

type Punch = {
  id: string;
  type: string;
  at: string;
  distance: number | null;
  isManual: boolean;
};

type TodayEntry = {
  date: string;
  holidayName: string | null;
  status: DayStatus;
  codes: string[];
  workedHours: number;
  requiredHours: number;
  punches: Punch[];
};

type Payload = {
  user: { name: string; employmentType: string };
  today: string;
  todayEntry: TodayEntry | null;
  openShift: string | null;
};

const STATUS_TEXT: Record<DayStatus, string> = {
  passed: "Đã đủ công hôm nay",
  late: "Đủ giờ nhưng vào ca muộn",
  insufficient: "Chưa đủ giờ tối thiểu",
  open: "Đang trong ca",
  absent: "Chưa chấm công",
  unscheduled: "Đang làm ngoài lịch đăng ký",
  holiday: "Hôm nay là ngày nghỉ lễ",
  off: "Hôm nay bạn không có lịch làm",
};

export default function DashboardPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/attendance");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được dữ liệu");
      setData(payload);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Lỗi không xác định",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function getPosition(): Promise<GeolocationCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Trình duyệt không hỗ trợ định vị"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (error) => reject(new Error(`Không lấy được vị trí: ${error.message}`)),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  async function punch(type: "in" | "out") {
    setSubmitting(true);
    setMessage(null);
    try {
      const coords = await getPosition();
      const response = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không ghi nhận được");

      setMessage({
        type: "success",
        text: type === "in" ? "Đã check-in" : "Đã check-out",
      });
      await load();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không ghi nhận được",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  const entry = data?.todayEntry;
  const inShift = Boolean(data?.openShift);
  const status: DayStatus = entry?.status ?? "off";

  return (
    <div className="space-y-4">
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-600">
          Xin chào, <span className="font-medium text-slate-900">{data?.user.name}</span>
        </p>
        <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
          {now
            ? now.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "--:--:--"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {now
            ? now.toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : ""}
        </p>
      </Card>

      {message && (
        <Message type={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </Message>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">{STATUS_TEXT[status]}</p>
            {entry && entry.codes.length > 0 && (
              <p className="mt-1 text-sm text-slate-900">
                Ca hôm nay: <span className="font-medium">{entry.codes.join(" + ")}</span>
                {entry.requiredHours > 0 && (
                  <span className="text-slate-500"> · cần {entry.requiredHours}h</span>
                )}
              </p>
            )}
          </div>
          <Badge tone={DAY_STATUS_TONE[status]}>
            {entry?.workedHours ?? 0}h đã làm
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            onClick={() => punch("in")}
            disabled={submitting || inShift}
            className="h-14"
          >
            <LogIn size={18} aria-hidden="true" />
            Check in
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => punch("out")}
            disabled={submitting || !inShift}
            className="h-14"
          >
            <LogOut size={18} aria-hidden="true" />
            Check out
          </Button>
        </div>

        {inShift && (
          <p className="mt-3 text-center text-sm text-sky-700">
            Bạn đang trong ca từ{" "}
            {new Date(data!.openShift!).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </Card>

      {entry && entry.punches.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-xl font-semibold text-slate-900">
            Các lần bấm giờ hôm nay
          </h2>
          <ol className="space-y-2">
            {entry.punches.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 text-slate-600">
                  {item.type === "in" ? (
                    <LogIn size={14} aria-hidden="true" className="text-emerald-600" />
                  ) : (
                    <LogOut size={14} aria-hidden="true" className="text-slate-500" />
                  )}
                  {item.type === "in" ? "Vào ca" : "Ra ca"}
                  {item.isManual && <Badge>Admin nhập</Badge>}
                </span>
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  {new Date(item.at).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {item.distance != null && (
                    <span className="flex items-center gap-1 text-xs font-normal text-slate-500">
                      <MapPin size={12} aria-hidden="true" />
                      {Math.round(item.distance)}m
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
