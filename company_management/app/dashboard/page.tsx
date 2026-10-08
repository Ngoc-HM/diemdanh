"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, MapPin } from "lucide-react";
import { Badge, Button, Card, Field, Input, Message } from "@/app/_components/ui";
import type { DayStatus } from "@/lib/attendance-rules";
import { DAY_STATUS_TONE } from "@/app/_components/status-styles";
import DashboardPageHeader from "@/app/dashboard/_components/page-header";

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
  checkInAt: string | null;
  lastOutAt: string | null;
};

const STATUS_TEXT: Record<DayStatus, string> = {
  passed: "Đã đủ công hôm nay",
  late: "Đủ giờ nhưng vào ca muộn",
  insufficient: "Chưa đủ giờ tối thiểu",
  open: "Đang trong ca",
  missed_out: "Quên checkout",
  leave: "Hôm nay bạn đăng ký nghỉ",
  sick: "Hôm nay được chấm nghỉ ốm",
  absent: "Chưa chấm công",
  unscheduled: "Đang làm ngoài lịch đăng ký",
  holiday: "Hôm nay là ngày nghỉ lễ",
  off: "Hôm nay bạn không có lịch làm",
};

function timeVN(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /// Công ty bật mã có mặt: phải nhập mã đang hiện trên màn hình ở văn phòng.
  const [presenceRequired, setPresenceRequired] = useState(false);
  const [presenceCode, setPresenceCode] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
    fetch("/api/attendance/policy")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setPresenceRequired(Boolean(payload?.presenceCode)))
      .catch(() => undefined);
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
      if (presenceRequired && !/^\d{6}$/.test(presenceCode.trim())) {
        throw new Error("Nhập mã có mặt 6 số đang hiện trên màn hình ở văn phòng");
      }
      // Đã bắt mã có mặt thì vị trí chỉ là tín hiệu phụ: không lấy được vẫn
      // gửi, server quyết định theo chính sách của công ty.
      let coords: GeolocationCoordinates | null = null;
      try {
        coords = await getPosition();
      } catch (error) {
        if (!presenceRequired) throw error;
      }
      const response = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          accuracy: coords?.accuracy ?? null,
          presenceCode: presenceRequired ? presenceCode.trim() : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không ghi nhận được");

      setMessage({
        type: "success",
        text: type === "in" ? "Đã check-in" : "Đã check-out",
      });
      setPresenceCode("");
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
        <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  const entry = data?.todayEntry;
  const checkedIn = Boolean(data?.checkInAt);
  const status: DayStatus = entry?.status ?? "off";
  const punches = entry?.punches ?? [];

  return (
    <div className="space-y-4">
      <DashboardPageHeader title="Chấm công" />

      {message && (
        <Message type={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </Message>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-semibold text-slate-900">
              {STATUS_TEXT[status]}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {entry && entry.codes.length > 0
                ? `Ca ${entry.codes.join(" + ")}`
                : "Không có ca đăng ký"}
              {entry && entry.requiredHours > 0 && ` · cần ${entry.requiredHours}h`}
              {data?.checkInAt && ` · vào ${timeVN(data.checkInAt)}`}
              {data?.lastOutAt && ` · ra ${timeVN(data.lastOutAt)}`}
            </p>
          </div>
          <Badge tone={DAY_STATUS_TONE[status]}>
            {entry?.workedHours ?? 0}h đã làm
          </Badge>
        </div>

        {presenceRequired && (
          <div className="mt-4 max-w-xs">
            <Field
              label="Mã có mặt"
              required
              hint="Mã 6 số trên màn hình ở văn phòng, đổi mỗi 30 giây"
            >
              <Input
                value={presenceCode}
                onChange={(event) => setPresenceCode(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="123456"
                maxLength={6}
                className="font-mono text-lg tracking-widest"
              />
            </Field>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            onClick={() => punch("in")}
            disabled={submitting || checkedIn}
          >
            <LogIn size={18} aria-hidden="true" />
            Vào ca
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => punch("out")}
            disabled={submitting || !checkedIn}
          >
            <LogOut size={18} aria-hidden="true" />
            Ra ca
          </Button>
        </div>

        {checkedIn && (
          <p className="mt-3 text-sm text-slate-500">
            Bấm ra ca được nhiều lần, hệ thống tính theo lần muộn nhất.
          </p>
        )}
      </Card>

      {punches.length > 0 && (
        <Card>
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Lần bấm giờ hôm nay
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-2 font-semibold text-slate-900">Loại</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-900">
                    Giờ
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-900">
                    Khoảng cách
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {punches.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2 text-slate-900">
                        {item.type === "in" ? (
                          <LogIn
                            size={14}
                            aria-hidden="true"
                            className="text-emerald-600"
                          />
                        ) : (
                          <LogOut
                            size={14}
                            aria-hidden="true"
                            className="text-slate-500"
                          />
                        )}
                        {item.type === "in" ? "Vào ca" : "Ra ca"}
                        {item.isManual && <Badge>Admin nhập</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-900">
                      {timeVN(item.at)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                      {item.distance != null ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} aria-hidden="true" />
                          {Math.round(item.distance)}m
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
