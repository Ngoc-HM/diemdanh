import { query } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/auth-guard";
import {
  getWifiAttendanceEnabled,
  lastScanAt,
  saveWifiAttendanceEnabled,
} from "@/lib/wifi-attendance";

type AdminDeviceRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  mac: string;
  label: string;
  createdAt: Date;
  lastSeenAt: Date | null;
};

async function readState() {
  const [enabled, scannedAt, devices] = await Promise.all([
    getWifiAttendanceEnabled(),
    lastScanAt(),
    query<AdminDeviceRow>(
      `SELECT d."id", d."userId", u."name" AS "userName", u."email" AS "userEmail",
              d."mac", d."label", d."createdAt", d."lastSeenAt"
         FROM "EmployeeDevice" d JOIN "User" u ON u."id" = d."userId"
        ORDER BY u."name" ASC, d."createdAt" ASC`
    ),
  ]);
  return { enabled, lastScanAt: scannedAt, devices };
}

/// Chấm công tự động qua wifi: công tắc chung, lần quét gần nhất và mọi máy
/// nhân viên đã đăng ký.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return readState();
  }, "Wifi attendance read error");
}

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    await saveWifiAttendanceEnabled(body?.enabled === true);
    return readState();
  }, "Wifi attendance write error");
}
