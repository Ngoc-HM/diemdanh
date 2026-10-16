/// Phần thuần logic của chấm công tự động qua wifi (không đụng database) để
/// test được; phần đọc / ghi DB ở lib/wifi-attendance.ts.

/// Lần quét cũ hơn ngần này phút coi như máy đã rời mạng (máy quét chạy mỗi phút).
export const WIFI_PRESENCE_FRESH_MINUTES = 3;
export const MAX_DEVICES_PER_USER = 3;
export const MAC_PATTERN = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;

export type WifiPunchInput = { id: string; type: string; at: Date; source: string };

export type WifiPunchPlan =
  | { action: "in" }
  | { action: "new_out" }
  | { action: "move_out"; punchId: string }
  | { action: "none" };

/// Quyết định phải ghi gì khi thấy máy của nhân viên lúc `seenAt`, dựa trên
/// các lần bấm giờ đã có trong ngày (mọi nguồn):
///   - chưa có giờ vào → ghi giờ vào;
///   - đã có giờ ra nguồn wifi → dời nó tới lần thấy muộn hơn (một dòng duy nhất);
///   - chưa có giờ ra wifi → thêm, trừ khi nhân viên đã bấm ra muộn hơn lần thấy.
export function planWifiPunch(punches: WifiPunchInput[], seenAt: Date): WifiPunchPlan {
  const seen = seenAt.getTime();
  const ins = punches.filter((punch) => punch.type === "in");
  if (ins.length === 0) return { action: "in" };

  const firstIn = Math.min(...ins.map((punch) => punch.at.getTime()));
  if (seen <= firstIn) return { action: "none" };

  const outs = punches.filter((punch) => punch.type === "out");
  const wifiOut = outs.find((punch) => punch.source === "wifi");
  if (wifiOut) {
    return seen > wifiOut.at.getTime()
      ? { action: "move_out", punchId: wifiOut.id }
      : { action: "none" };
  }
  const latestOut = Math.max(...outs.map((punch) => punch.at.getTime()), 0);
  if (seen <= latestOut) return { action: "none" };
  return { action: "new_out" };
}
