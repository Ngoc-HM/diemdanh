/// Chặn theo IP: blacklist chặn cả web (middleware), và dải mạng văn phòng
/// được phép chấm công (route chấm công). Kèm khoá / mở khoá tài khoản.
import { query, queryOne } from "@/lib/db";
import { parsePunchNetwork, PunchNetwork } from "@/lib/ip-match";
import { logLoginEvent } from "@/lib/security-log";

export type BlockedIpRow = {
  id: string;
  cidr: string;
  note: string | null;
  createdAt: Date;
};

/// Middleware tra blacklist ở mọi request nên giữ bản sao trong bộ nhớ vài
/// giây; admin thêm / xoá IP thì xoá bản sao để có hiệu lực ngay.
const CACHE_MS = 5_000;
const cache = globalThis as unknown as { blockedIps?: { at: number; ranges: string[] } };

export async function getBlockedRanges(): Promise<string[]> {
  const cached = cache.blockedIps;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.ranges;
  const rows = await query<{ cidr: string }>(`SELECT "cidr" FROM "BlockedIp"`);
  const ranges = rows.map((row) => row.cidr);
  cache.blockedIps = { at: Date.now(), ranges };
  return ranges;
}

export function invalidateBlockedRanges() {
  cache.blockedIps = undefined;
}

export async function listBlockedIps(): Promise<BlockedIpRow[]> {
  return await query<BlockedIpRow>(
    `SELECT "id", "cidr", "note", "createdAt" FROM "BlockedIp" ORDER BY "createdAt" DESC`
  );
}

export async function getPunchNetwork(): Promise<PunchNetwork> {
  const row = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = 'punch_network'`
  );
  return parsePunchNetwork(row?.value);
}

export async function savePunchNetwork(network: PunchNetwork): Promise<PunchNetwork> {
  const value = JSON.stringify(network);
  await queryOne(
    `INSERT INTO "Settings" ("key", "value") VALUES ('punch_network', $1)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value" RETURNING "key"`,
    [value]
  );
  return parsePunchNetwork(value);
}

/// Khoá tài khoản nhân viên và đá mọi phiên ra ngay. Đã khoá rồi thì thôi.
export async function lockEmployee(
  req: Request | null,
  userId: string,
  reason: string
): Promise<boolean> {
  const locked = await queryOne<{ email: string }>(
    `UPDATE "User"
        SET "lockedAt" = now(), "lockReason" = $2,
            "sessionVersion" = "sessionVersion" + 1, "updatedAt" = now()
      WHERE "id" = $1 AND "lockedAt" IS NULL
      RETURNING "email"`,
    [userId, reason.slice(0, 300)]
  );
  if (!locked) return false;
  await logLoginEvent(req, "account_locked", {
    type: "employee",
    id: userId,
    identifier: `${locked.email} (${reason})`,
  });
  return true;
}

export async function unlockEmployee(
  req: Request,
  userId: string,
  adminName: string
): Promise<boolean> {
  const unlocked = await queryOne<{ email: string }>(
    `UPDATE "User" SET "lockedAt" = NULL, "lockReason" = NULL, "updatedAt" = now()
      WHERE "id" = $1 AND "lockedAt" IS NOT NULL
      RETURNING "email"`,
    [userId]
  );
  if (!unlocked) return false;
  await logLoginEvent(req, "account_unlocked", {
    type: "employee",
    id: userId,
    identifier: `${unlocked.email} (bởi ${adminName})`,
  });
  return true;
}

export const LOCKED_MESSAGE_PREFIX = "Tài khoản đã bị khoá";

export function lockedMessage(reason: string | null): string {
  return `${LOCKED_MESSAGE_PREFIX}${reason ? `: ${reason}` : ""}. Liên hệ quản trị viên để mở khoá.`;
}

export const BLOCKED_MESSAGE = "Truy cập từ địa chỉ mạng này đã bị chặn.";

/// Header middleware gắn cho hai route đăng nhập khi IP nằm trong blacklist, để
/// route kiểm mật khẩu rồi khoá đúng tài khoản. Middleware luôn xoá giá trị
/// client tự gửi lên.
export const BLOCKED_IP_HEADER = "x-blocked-ip";
