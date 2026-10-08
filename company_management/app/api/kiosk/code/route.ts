import { cookies } from "next/headers";
import { handle, HttpError } from "@/lib/auth-guard";
import {
  currentPresenceCode,
  getAttendancePolicy,
  KIOSK_COOKIE,
  kioskFromToken,
} from "@/lib/presence";

/// Mã có mặt hiện tại — chỉ trả cho màn hình đã ghép nối.
export async function GET() {
  return handle(async () => {
    const cookieStore = await cookies();
    const device = await kioskFromToken(cookieStore.get(KIOSK_COOKIE)?.value);
    if (!device) throw new HttpError(401, "Màn hình chưa được ghép nối hoặc đã bị thu hồi");
    const [{ code, secondsLeft }, policy] = await Promise.all([
      currentPresenceCode(),
      getAttendancePolicy(),
    ]);
    return { code, secondsLeft, device: device.name, required: policy.presenceCode };
  }, "Kiosk code error");
}
