import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { createKioskDevice, KIOSK_PAIRING_HOURS, listKioskDevices } from "@/lib/presence";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return { devices: await listKioskDevices() };
  }, "Kiosk list error");
}

/// Tạo màn hình mới; trả mã ghép nối để trang admin dựng link mở trên máy ở văn phòng.
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    if (!name) badRequest("Vui lòng đặt tên cho màn hình");
    if (name.length > 60) badRequest("Tên tối đa 60 ký tự");
    const { device, pairingToken } = await createKioskDevice(name);
    return { device, pairingToken, expiresInHours: KIOSK_PAIRING_HOURS };
  }, "Kiosk create error");
}
