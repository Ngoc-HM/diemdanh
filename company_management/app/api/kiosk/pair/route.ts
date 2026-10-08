import { cookies } from "next/headers";
import { badRequest, handle, HttpError } from "@/lib/auth-guard";
import { KIOSK_COOKIE, kioskCookieOptions, pairKioskDevice } from "@/lib/presence";

/// Máy đặt ở văn phòng mở link ghép nối: đổi mã dùng một lần lấy cookie thiết bị.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    if (!token) badRequest("Thiếu mã ghép nối");
    const deviceToken = await pairKioskDevice(token);
    if (!deviceToken) {
      throw new HttpError(400, "Link ghép nối không đúng, đã dùng hoặc đã hết hạn. Tạo link mới ở trang Bảo mật.");
    }
    const cookieStore = await cookies();
    cookieStore.set(KIOSK_COOKIE, deviceToken, kioskCookieOptions());
    return { success: true };
  }, "Kiosk pair error");
}
