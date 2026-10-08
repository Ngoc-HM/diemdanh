/// Mã có mặt: một màn hình đặt ở văn phòng hiện mã 6 số đổi mỗi 30 giây,
/// nhân viên phải nhập mã đang hiện khi bấm Vào / Ra ca. Ngồi nhà thì không
/// nhìn thấy màn hình — khác với GPS, trình duyệt không giả được thứ này.
///
/// Màn hình (kiosk) không đăng nhập bằng tài khoản: admin tạo một link ghép
/// nối dùng một lần, mở link trên máy đặt ở văn phòng thì máy đó nhận một
/// cookie bí mật riêng. Server chỉ lưu băm của cookie; thu hồi là tắt ngay.
import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { decryptSecret, encryptSecret, hashToken } from "@/lib/mailer";
import {
  generateTotpSecret,
  hotp,
  totpSecondsLeft,
  totpStep,
} from "@/lib/totp";
import { AttendancePolicy, parsePolicy } from "@/lib/attendance-policy";

export {
  DEFAULT_POLICY,
  parsePolicy,
  rejectsOutsideRadius,
} from "@/lib/attendance-policy";
export type { AttendancePolicy } from "@/lib/attendance-policy";

export const KIOSK_COOKIE = "kiosk";
/// Link ghép nối chưa dùng thì hết hạn sau ngần này giờ.
export const KIOSK_PAIRING_HOURS = 24;
/// Sai mã có mặt quá ngần này lần trong PRESENCE_LOCK_MINUTES thì tạm chặn.
export const PRESENCE_MAX_FAILURES = 5;
export const PRESENCE_LOCK_MINUTES = 10;

export async function getAttendancePolicy(): Promise<AttendancePolicy> {
  const row = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'attendance_policy'`,
  );
  return parsePolicy(row?.value);
}

export async function saveAttendancePolicy(
  policy: AttendancePolicy,
): Promise<AttendancePolicy> {
  const value = JSON.stringify(parsePolicy(JSON.stringify(policy)));
  await queryOne(
    `INSERT INTO "Settings" ("key", "value") VALUES ('attendance_policy', $1)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
     RETURNING "key"`,
    [value],
  );
  return parsePolicy(value);
}

/// Khoá sinh mã có mặt, tạo lần đầu khi cần, lưu mã hoá trong Settings.
async function presenceSecret(): Promise<string> {
  const row = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'presence_secret'`,
  );
  const existing = row ? decryptSecret(row.value) : null;
  if (existing) return existing;

  // Hai request cùng tạo: DO NOTHING rồi đọc lại để ai cũng dùng chung một khoá.
  await queryOne(
    `INSERT INTO "Settings" ("key", "value") VALUES ('presence_secret', $1)
     ON CONFLICT ("key") DO NOTHING RETURNING "key"`,
    [encryptSecret(generateTotpSecret())],
  );
  const saved = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'presence_secret'`,
  );
  const secret = saved ? decryptSecret(saved.value) : null;
  if (!secret)
    throw new Error("Không đọc được khoá mã có mặt (AUTH_SECRET đã đổi?)");
  return secret;
}

/// Đổi khoá: mã đang hiện trên mọi màn hình đổi theo, mã ai đó chụp lại trước
/// đó vô dụng. Gọi khi thu hồi một màn hình.
export async function rotatePresenceSecret() {
  await queryOne(
    `INSERT INTO "Settings" ("key", "value") VALUES ('presence_secret', $1)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value" RETURNING "key"`,
    [encryptSecret(generateTotpSecret())],
  );
}

export async function currentPresenceCode(now: number = Date.now()) {
  const secret = await presenceSecret();
  return {
    code: hotp(secret, totpStep(now)),
    secondsLeft: totpSecondsLeft(now),
  };
}

/// Nhận mã đang hiện và mã ngay trước đó (người vừa đọc xong thì mã đổi).
/// Không nhận mã tương lai: màn hình và server dùng chung đồng hồ server.
export async function verifyPresenceCode(
  code: string,
  now: number = Date.now(),
): Promise<boolean> {
  const normalized = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const secret = await presenceSecret();
  const step = totpStep(now);
  return (
    hotp(secret, step) === normalized || hotp(secret, step - 1) === normalized
  );
}

// ---- màn hình (kiosk) ----

export type KioskDeviceRow = {
  id: string;
  name: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
};

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/// Tạo màn hình mới, trả về mã ghép nối dùng một lần (nhúng vào link).
export async function createKioskDevice(name: string) {
  const pairingToken = newToken();
  const device = await queryOne<KioskDeviceRow>(
    `INSERT INTO "KioskDevice" ("name", "tokenHash") VALUES ($1, $2)
     RETURNING "id", "name", "createdAt", "lastSeenAt", "revokedAt"`,
    [name, hashToken(`pair:${pairingToken}`)],
  );
  return { device: device!, pairingToken };
}

/// Mở link ghép nối trên máy ở văn phòng: đổi mã ghép nối lấy cookie thiết bị
/// mới. Link dùng xong là chết — ai chép được link cũng không xem được mã.
export async function pairKioskDevice(
  pairingToken: string,
): Promise<string | null> {
  const deviceToken = newToken();
  const paired = await queryOne<{ id: string }>(
    `UPDATE "KioskDevice" SET "tokenHash" = $2, "lastSeenAt" = now()
      WHERE "tokenHash" = $1 AND "revokedAt" IS NULL AND "lastSeenAt" IS NULL
        AND "createdAt" > now() - ($3 || ' hours')::interval
      RETURNING "id"`,
    [
      hashToken(`pair:${pairingToken}`),
      hashToken(`device:${deviceToken}`),
      String(KIOSK_PAIRING_HOURS),
    ],
  );
  return paired ? deviceToken : null;
}

/// Thiết bị ứng với cookie, hoặc null nếu cookie sai / đã thu hồi.
export async function kioskFromToken(deviceToken: string | undefined) {
  if (!deviceToken) return null;
  return await queryOne<{ id: string; name: string }>(
    `UPDATE "KioskDevice" SET "lastSeenAt" = now()
      WHERE "tokenHash" = $1 AND "revokedAt" IS NULL
      RETURNING "id", "name"`,
    [hashToken(`device:${deviceToken}`)],
  );
}

export async function listKioskDevices() {
  return await query<KioskDeviceRow>(
    `SELECT "id", "name", "createdAt", "lastSeenAt", "revokedAt"
       FROM "KioskDevice" WHERE "revokedAt" IS NULL ORDER BY "createdAt" ASC`,
  );
}

export async function revokeKioskDevice(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `UPDATE "KioskDevice" SET "revokedAt" = now()
      WHERE "id" = $1 AND "revokedAt" IS NULL RETURNING "id"`,
    [id],
  );
  if (row) await rotatePresenceSecret();
  return Boolean(row);
}

export function kioskCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    // Màn hình chạy liên tục nhiều tháng; thu hồi bằng nút ở trang Bảo mật.
    maxAge: 60 * 60 * 24 * 400,
  };
}
