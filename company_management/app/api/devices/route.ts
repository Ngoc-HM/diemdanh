import { queryOne } from "@/lib/db";
import { badRequest, conflict, handle, requireEmployee } from "@/lib/auth-guard";
import { findMatchingCidr } from "@/lib/ip-match";
import { getPunchNetwork } from "@/lib/ip-policy";
import { clientIp, userAgent } from "@/lib/request-meta";
import { summarizeUserAgent } from "@/lib/security-labels";
import {
  findPresenceByIp,
  getWifiAttendanceEnabled,
  listUserDevices,
  MAX_DEVICES_PER_USER,
} from "@/lib/wifi-attendance";

/// Máy nhân viên đã đăng ký để chấm công tự động qua wifi.
export async function GET() {
  return handle(async () => {
    const session = await requireEmployee();
    return {
      enabled: await getWifiAttendanceEnabled(),
      devices: await listUserDevices(session.userId),
    };
  }, "Device list error");
}

/// "Đăng ký máy này": nhân viên đang nối wifi văn phòng bấm, app lấy IP của họ
/// rồi tra MAC trong kết quả quét gần nhất — không ai phải gõ MAC.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const ip = clientIp(req);
    const network = await getPunchNetwork();
    if (!ip || (network.enabled && !findMatchingCidr(ip, network.ranges))) {
      badRequest("Phải nối wifi văn phòng mới đăng ký được máy");
    }
    const presence = await findPresenceByIp(ip!);
    if (!presence) {
      conflict(
        "Hệ thống chưa nhìn thấy máy này trong wifi văn phòng. Chờ khoảng một phút rồi bấm lại."
      );
    }

    const owner = await queryOne<{ userId: string }>(
      `SELECT "userId" FROM "EmployeeDevice" WHERE "mac" = $1`,
      [presence!.mac]
    );
    if (owner && owner.userId !== session.userId) {
      conflict("Máy này đã được đăng ký cho tài khoản khác");
    }
    if (!owner) {
      const current = await listUserDevices(session.userId);
      if (current.length >= MAX_DEVICES_PER_USER) {
        badRequest(`Mỗi người đăng ký tối đa ${MAX_DEVICES_PER_USER} máy, xoá bớt rồi thử lại`);
      }
      await queryOne(
        `INSERT INTO "EmployeeDevice" ("userId", "mac", "label", "registeredIp")
         VALUES ($1, $2, $3, $4) RETURNING "id"`,
        [session.userId, presence!.mac, summarizeUserAgent(userAgent(req)), ip]
      );
    }
    return { alreadyRegistered: Boolean(owner), devices: await listUserDevices(session.userId) };
  }, "Device register error");
}
