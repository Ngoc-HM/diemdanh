/// Xác thực 2 lớp bằng app (Google Authenticator...) cho admin và nhân viên.
/// Khoá TOTP lưu mã hoá (AES-GCM, khoá dẫn xuất từ AUTH_SECRET); mã dự phòng
/// chỉ lưu HMAC, hiện cho người dùng đúng một lần lúc tạo.
import { createHash, createHmac, randomInt } from "node:crypto";
import QRCode from "qrcode";
import { queryOne } from "@/lib/db";
import { HttpError } from "@/lib/auth-guard";
import { decryptSecret, encryptSecret } from "@/lib/mailer";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";

export type Account = { type: "admin" | "employee"; id: string };

const TABLE: Record<Account["type"], string> = { admin: '"Admin"', employee: '"User"' };

export const BACKUP_CODE_COUNT = 10;
/// Bỏ các ký tự dễ nhầm (0/O, 1/I/L) cho dễ chép tay.
const BACKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

type TwoFactorRow = {
  totpSecret: string | null;
  totpPendingSecret: string | null;
  totpEnabledAt: Date | null;
  totpBackupCodes: string[] | null;
  totpLastStep: string | null;
};

async function loadRow(account: Account): Promise<TwoFactorRow> {
  const row = await queryOne<TwoFactorRow>(
    `SELECT "totpSecret", "totpPendingSecret", "totpEnabledAt", "totpBackupCodes",
            "totpLastStep"::text AS "totpLastStep"
       FROM ${TABLE[account.type]} WHERE "id" = $1`,
    [account.id]
  );
  if (!row) throw new HttpError(404, "Không tìm thấy tài khoản");
  return row;
}

export async function twoFactorStatus(account: Account) {
  const row = await loadRow(account);
  return {
    enabled: Boolean(row.totpSecret),
    enabledAt: row.totpEnabledAt ? row.totpEnabledAt.toISOString() : null,
    backupCodesRemaining: row.totpBackupCodes?.length ?? 0,
  };
}

export async function isTwoFactorEnabled(account: Account): Promise<boolean> {
  return (await twoFactorStatus(account)).enabled;
}

function backupKey(): Buffer {
  return createHash("sha256")
    .update(`2fa-backup:${process.env.AUTH_SECRET || "dev"}`)
    .digest();
}

function normalizeBackupCode(code: string): string {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashBackupCode(code: string): string {
  return createHmac("sha256", backupKey()).update(normalizeBackupCode(code)).digest("hex");
}

export function generateBackupCodes(): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const raw = Array.from({ length: 8 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  return { plain, hashes: plain.map(hashBackupCode) };
}

/// Bước 1: tạo khoá chờ xác nhận và mã QR. Chưa bật cho tới khi người dùng
/// nhập đúng một mã từ app (bước 2) — tránh bật xong mà app chưa quét được.
export async function beginTwoFactorSetup(account: Account, accountLabel: string, issuer: string) {
  const row = await loadRow(account);
  if (row.totpSecret) throw new HttpError(409, "Xác thực 2 lớp đang bật");
  const secret = generateTotpSecret();
  await queryOne(
    `UPDATE ${TABLE[account.type]} SET "totpPendingSecret" = $2 WHERE "id" = $1 RETURNING "id"`,
    [account.id, encryptSecret(secret)]
  );
  const url = otpauthUrl(issuer, accountLabel, secret);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { secret, otpauthUrl: url, qrSvg };
}

/// Bước 2: nhập đúng mã từ app thì bật, trả về mã dự phòng (hiện một lần).
export async function confirmTwoFactorSetup(account: Account, code: string): Promise<string[]> {
  const row = await loadRow(account);
  if (row.totpSecret) throw new HttpError(409, "Xác thực 2 lớp đang bật");
  const pending = row.totpPendingSecret ? decryptSecret(row.totpPendingSecret) : null;
  if (!pending) throw new HttpError(400, "Chưa tạo mã QR, hãy bắt đầu lại");
  const step = verifyTotp(pending, code);
  if (step === null) throw new HttpError(400, "Mã không đúng. Kiểm tra giờ trên điện thoại rồi thử lại.");
  const backup = generateBackupCodes();
  await queryOne(
    `UPDATE ${TABLE[account.type]}
        SET "totpSecret" = "totpPendingSecret", "totpPendingSecret" = NULL,
            "totpEnabledAt" = now(), "totpBackupCodes" = $2, "totpLastStep" = $3
      WHERE "id" = $1 RETURNING "id"`,
    [account.id, backup.hashes, step]
  );
  return backup.plain;
}

/// Kiểm tra lớp thứ hai: mã 6 số từ app, hoặc một mã dự phòng (dùng xong là
/// mất). Mã 6 số đã dùng thì không dùng lại được trong cùng khoảng thời gian.
export async function verifySecondFactor(
  account: Account,
  code: string
): Promise<"totp" | "backup" | null> {
  const row = await loadRow(account);
  const secret = row.totpSecret ? decryptSecret(row.totpSecret) : null;
  if (!secret) return null;

  const lastStep = row.totpLastStep === null ? undefined : Number(row.totpLastStep);
  const step = verifyTotp(secret, code, { minStep: lastStep });
  if (step !== null) {
    // Ghi bước đã dùng có điều kiện: hai request cùng một mã chỉ một cái qua.
    const saved = await queryOne(
      `UPDATE ${TABLE[account.type]} SET "totpLastStep" = $2
        WHERE "id" = $1 AND ("totpLastStep" IS NULL OR "totpLastStep" < $2)
        RETURNING "id"`,
      [account.id, step]
    );
    return saved ? "totp" : null;
  }

  const hash = hashBackupCode(code);
  if (normalizeBackupCode(code).length === 8 && row.totpBackupCodes?.includes(hash)) {
    const consumed = await queryOne(
      `UPDATE ${TABLE[account.type]} SET "totpBackupCodes" = array_remove("totpBackupCodes", $2)
        WHERE "id" = $1 AND $2 = ANY("totpBackupCodes") RETURNING "id"`,
      [account.id, hash]
    );
    return consumed ? "backup" : null;
  }
  return null;
}

export async function disableTwoFactor(account: Account) {
  await queryOne(
    `UPDATE ${TABLE[account.type]}
        SET "totpSecret" = NULL, "totpPendingSecret" = NULL, "totpEnabledAt" = NULL,
            "totpBackupCodes" = NULL, "totpLastStep" = NULL
      WHERE "id" = $1 RETURNING "id"`,
    [account.id]
  );
}

export async function regenerateBackupCodes(account: Account): Promise<string[]> {
  const backup = generateBackupCodes();
  await queryOne(
    `UPDATE ${TABLE[account.type]} SET "totpBackupCodes" = $2 WHERE "id" = $1 RETURNING "id"`,
    [account.id, backup.hashes]
  );
  return backup.plain;
}

/// Tăng phiên bản phiên: mọi JWT cũ của tài khoản hết hiệu lực. Trả về số mới
/// để người đang thao tác được ký lại phiên và không bị đá ra.
export async function bumpSessionVersion(account: Account): Promise<number> {
  const row = await queryOne<{ sessionVersion: number }>(
    `UPDATE ${TABLE[account.type]} SET "sessionVersion" = "sessionVersion" + 1
      WHERE "id" = $1 RETURNING "sessionVersion"`,
    [account.id]
  );
  return row?.sessionVersion ?? 0;
}
