/// Chấm công tự động qua wifi văn phòng.
///
/// Máy quét (scripts/wifi-scan.sh) ghi vào WifiPresence lần thấy gần nhất của
/// từng địa chỉ MAC trong wifi văn phòng. Nhân viên đăng ký máy của mình vào
/// EmployeeDevice. Mỗi phút app đối chiếu hai bảng:
///   - ngày chưa có giờ vào → ghi giờ vào bằng lúc quét thấy máy;
///   - đã có giờ vào → giờ ra tự động = lần cuối còn thấy máy, ghi đè lên MỘT
///     dòng "ra" nguồn wifi (không thêm dòng mới mỗi phút). Nhân viên bấm ra ca
///     vẫn được; giờ ra tính theo lần muộn nhất của cả hai (pairPunches).
/// Phần quyết định (planWifiPunch) nằm ở lib/wifi-rules.ts, thuần logic để test.
import { query, queryOne } from "@/lib/db";
import { dateKeyVN } from "@/lib/datetime";
import { planWifiPunch, WIFI_PRESENCE_FRESH_MINUTES, WifiPunchInput } from "@/lib/wifi-rules";

export { MAX_DEVICES_PER_USER, MAC_PATTERN, WIFI_PRESENCE_FRESH_MINUTES } from "@/lib/wifi-rules";

/// Công tắc chung (Settings wifi_attendance). Chưa đặt = bật.
export async function getWifiAttendanceEnabled(): Promise<boolean> {
  const setting = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'wifi_attendance'`
  );
  return setting ? setting.value === "true" : true;
}

export async function saveWifiAttendanceEnabled(enabled: boolean): Promise<void> {
  await queryOne(
    `INSERT INTO "Settings" ("key", "value") VALUES ('wifi_attendance', $1)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value" RETURNING "key"`,
    [enabled ? "true" : "false"]
  );
}

export type DeviceRow = {
  id: string;
  userId: string;
  mac: string;
  label: string;
  createdAt: Date;
  lastSeenAt: Date | null;
};

export async function listUserDevices(userId: string): Promise<DeviceRow[]> {
  return query<DeviceRow>(
    `SELECT "id", "userId", "mac", "label", "createdAt", "lastSeenAt"
       FROM "EmployeeDevice" WHERE "userId" = $1 ORDER BY "createdAt" ASC`,
    [userId]
  );
}

/// Máy quét có thấy máy nào mang IP này trong vài phút gần đây không. Dùng lúc
/// nhân viên bấm "Đăng ký máy này": app chỉ biết IP của họ, MAC tra ở đây.
export async function findPresenceByIp(ip: string): Promise<{ mac: string; seenAt: Date } | null> {
  return queryOne<{ mac: string; seenAt: Date }>(
    `SELECT "mac", "seenAt" FROM "WifiPresence"
      WHERE "ip" = $1 AND "seenAt" > now() - make_interval(mins => $2)
      ORDER BY "seenAt" DESC LIMIT 1`,
    [ip, WIFI_PRESENCE_FRESH_MINUTES]
  );
}

/// Thời điểm quét gần nhất (để màn hình admin biết máy quét có đang chạy không).
export async function lastScanAt(): Promise<Date | null> {
  const row = await queryOne<{ at: Date | null }>(`SELECT max("seenAt") AS "at" FROM "WifiPresence"`);
  return row?.at ?? null;
}

type Sighting = { userId: string; deviceId: string; mac: string; seenAt: Date };

/// Đối chiếu một lượt. Mỗi lần quét của một máy chỉ xử lý một lần (so với
/// EmployeeDevice.lastSeenAt), nên gọi dày hay thưa đều không ghi trùng.
export async function applyWifiPresence(now: Date = new Date()): Promise<{ users: number; punches: number }> {
  if (!(await getWifiAttendanceEnabled())) return { users: 0, punches: 0 };

  const sightings = await query<Sighting>(
    `SELECT d."userId", d."id" AS "deviceId", d."mac", p."seenAt"
       FROM "WifiPresence" p
       JOIN "EmployeeDevice" d ON d."mac" = p."mac"
       JOIN "User" u ON u."id" = d."userId"
      WHERE u."isActive" AND u."lockedAt" IS NULL
        AND p."seenAt" > now() - make_interval(mins => $1)
        AND (d."lastSeenAt" IS NULL OR d."lastSeenAt" < p."seenAt")
      ORDER BY p."seenAt" ASC`,
    [WIFI_PRESENCE_FRESH_MINUTES]
  );
  if (sightings.length === 0) return { users: 0, punches: 0 };

  // Một người có thể có nhiều máy đang nối: lấy lần thấy muộn nhất.
  const latestByUser = new Map<string, Sighting>();
  for (const sighting of sightings) latestByUser.set(sighting.userId, sighting);

  const today = dateKeyVN(now);
  let punches = 0;
  for (const sighting of latestByUser.values()) {
    if (dateKeyVN(sighting.seenAt) === today) {
      if (await applySighting(sighting, today)) punches += 1;
    }
  }

  // Đánh dấu đã xử lý cho mọi máy trong lượt này (kể cả máy không phải muộn nhất).
  await query(
    `UPDATE "EmployeeDevice" d SET "lastSeenAt" = p."seenAt"
       FROM "WifiPresence" p
      WHERE p."mac" = d."mac" AND d."id" = ANY($1::text[])`,
    [sightings.map((sighting) => sighting.deviceId)]
  );
  return { users: latestByUser.size, punches };
}

/// Ghi giờ cho một người theo kế hoạch của planWifiPunch. Giờ lấy thẳng từ
/// WifiPresence trong SQL để không đi qua chuyển đổi múi giờ của Node.
async function applySighting(sighting: Sighting, today: string): Promise<boolean> {
  const attendance = await queryOne<{ id: string }>(
    `INSERT INTO "Attendance" ("userId", "date") VALUES ($1, $2)
     ON CONFLICT ("userId", "date") DO UPDATE SET "userId" = EXCLUDED."userId"
     RETURNING "id"`,
    [sighting.userId, today]
  );
  const punches = await query<WifiPunchInput>(
    `SELECT "id", "type", "at", "source" FROM "AttendancePunch" WHERE "attendanceId" = $1`,
    [attendance!.id]
  );
  const plan = planWifiPunch(punches, sighting.seenAt);
  if (plan.action === "none") return false;

  if (plan.action === "move_out") {
    await query(
      `UPDATE "AttendancePunch" SET "at" = p."seenAt"
         FROM "WifiPresence" p
        WHERE p."mac" = $2 AND "AttendancePunch"."id" = $1`,
      [plan.punchId, sighting.mac]
    );
    return true;
  }
  await query(
    `INSERT INTO "AttendancePunch" ("attendanceId", "type", "at", "withinRadius", "source")
     SELECT $1, $2, p."seenAt", true, 'wifi' FROM "WifiPresence" p WHERE p."mac" = $3`,
    [attendance!.id, plan.action === "in" ? "in" : "out", sighting.mac]
  );
  return true;
}
