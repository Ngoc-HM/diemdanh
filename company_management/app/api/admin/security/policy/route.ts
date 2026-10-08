import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { getAttendancePolicy, listKioskDevices, saveAttendancePolicy } from "@/lib/presence";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return { policy: await getAttendancePolicy() };
  }, "Attendance policy read error");
}

/// Bật mã có mặt mà chưa có màn hình nào thì không ai chấm công được — chặn.
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const presenceCode = body?.presenceCode === true;
    if (presenceCode && (await listKioskDevices()).length === 0) {
      badRequest("Cần ghép nối ít nhất một màn hình hiện mã trước khi bật");
    }
    const policy = await saveAttendancePolicy({
      presenceCode,
      outsideRadius: body?.outsideRadius === "flag" ? "flag" : "reject",
    });
    return { policy };
  }, "Attendance policy write error");
}
