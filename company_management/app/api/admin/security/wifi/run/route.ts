import { handle, requireAdmin } from "@/lib/auth-guard";
import { applyWifiPresence } from "@/lib/wifi-attendance";

/// Đối chiếu ngay, không chờ tới lượt mỗi phút của bộ hẹn giờ.
export async function POST() {
  return handle(async () => {
    await requireAdmin();
    return await applyWifiPresence();
  }, "Wifi attendance run error");
}
