/// Nhật ký mọi lần bấm Vào / Ra ca (kể cả bị từ chối) và các cờ bất thường,
/// để admin soi lại khi nghi ngờ chấm công hộ / giả vị trí.
import { query, queryOne } from "@/lib/db";
import { clientIp, userAgent } from "@/lib/request-meta";
import { PRESENCE_LOCK_MINUTES } from "@/lib/presence";
import type { PunchFlag } from "@/lib/security-labels";

export type { PunchFlag };

/// Độ chính xác GPS trình duyệt báo (mét) quá ngưỡng này thì gắn cờ.
export const LOW_ACCURACY_METERS = 200;
/// Cùng một IP chấm công cho hai người khác nhau trong khoảng này: đáng ngờ
/// (máy trung chuyển, hoặc một máy bấm hộ nhiều người).
export const SHARED_IP_MINUTES = 15;

export type PunchAttempt = {
  userId: string;
  type: string;
  result: "accepted" | "rejected";
  reason?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  distance?: number | null;
  locationId?: string | null;
  flags?: PunchFlag[];
};

/// Lỗi ghi log không được làm hỏng việc chấm công.
export async function logPunchAttempt(req: Request, attempt: PunchAttempt) {
  try {
    await query(
      `INSERT INTO "PunchAttempt"
         ("userId", "type", "result", "reason", "latitude", "longitude", "accuracy",
          "distance", "locationId", "ip", "userAgent", "flags")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        attempt.userId,
        attempt.type.slice(0, 10),
        attempt.result,
        attempt.reason ?? null,
        attempt.latitude ?? null,
        attempt.longitude ?? null,
        attempt.accuracy ?? null,
        attempt.distance ?? null,
        attempt.locationId ?? null,
        clientIp(req),
        userAgent(req),
        attempt.flags ?? [],
      ],
    );
  } catch (error) {
    console.error("Không ghi được nhật ký chấm công:", error);
  }
}

/// Số lần nhập sai mã có mặt gần đây của một nhân viên.
export async function recentPresenceFailures(userId: string): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS "count" FROM "PunchAttempt"
      WHERE "userId" = $1 AND "reason" = 'presence_code'
        AND "createdAt" > now() - ($2 || ' minutes')::interval`,
    [userId, String(PRESENCE_LOCK_MINUTES)],
  );
  return row?.count ?? 0;
}

/// IP này vừa chấm công thành công cho một người khác?
export async function ipUsedByOthers(
  ip: string | null,
  userId: string,
): Promise<boolean> {
  if (!ip) return false;
  const row = await queryOne<{ id: string }>(
    `SELECT "id" FROM "PunchAttempt"
      WHERE "ip" = $1 AND "userId" <> $2 AND "result" = 'accepted'
        AND "createdAt" > now() - ($3 || ' minutes')::interval
      LIMIT 1`,
    [ip, userId, String(SHARED_IP_MINUTES)],
  );
  return Boolean(row);
}
