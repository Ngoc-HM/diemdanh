import { handle, requireEmployee } from "@/lib/auth-guard";
import { getAttendancePolicy } from "@/lib/presence";

/// Trang chấm công cần biết có phải hiện ô nhập mã có mặt không.
export async function GET() {
  return handle(async () => {
    await requireEmployee();
    const policy = await getAttendancePolicy();
    return { presenceCode: policy.presenceCode };
  }, "Attendance policy read error");
}
