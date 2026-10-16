import { applyWifiPresence } from "@/lib/wifi-attendance";

/// Mỗi phút đối chiếu kết quả quét wifi với máy đã đăng ký để ghi giờ vào / ra
/// tự động. Hàm đối chiếu tự bỏ qua lần quét đã xử lý nên chạy dày không sao.
const CHECK_INTERVAL_MS = 60 * 1000;
const FIRST_RUN_DELAY_MS = 20 * 1000;

const globalForScheduler = globalThis as unknown as {
  wifiTimer?: ReturnType<typeof setInterval>;
};

/// Chạy trong tiến trình server (gọi từ instrumentation.ts). Gắn vào
/// globalThis để hot-reload ở dev không tạo thêm bộ đếm thứ hai.
export function startWifiAttendanceScheduler() {
  if (globalForScheduler.wifiTimer) return;

  const tick = async () => {
    try {
      const result = await applyWifiPresence();
      if (result.punches > 0) {
        console.log(`[wifi] đã ghi ${result.punches} lần vào / ra tự động cho ${result.users} người`);
      }
    } catch (error) {
      console.error("[wifi] lỗi khi đối chiếu quét wifi:", error);
    }
  };

  console.log("[wifi] bộ chấm công qua wifi đã khởi động, đối chiếu mỗi phút");
  setTimeout(tick, FIRST_RUN_DELAY_MS).unref?.();
  globalForScheduler.wifiTimer = setInterval(tick, CHECK_INTERVAL_MS);
  globalForScheduler.wifiTimer.unref?.();
}
