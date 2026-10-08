/// Mã một lần theo thời gian (TOTP, RFC 6238) — cùng chuẩn Google Authenticator,
/// Microsoft Authenticator, Authy dùng. Chỉ dùng `crypto` có sẵn của Node, không
/// gọi dịch vụ ngoài. Dùng cho xác thực 2 lớp và mã có mặt ở văn phòng.
import { createHmac, randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Khoá base32 không hợp lệ");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/// Khoá mới 160 bit (độ dài khuyến nghị của RFC 4226), dạng base32.
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: string, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totpStep(now: number = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_STEP_SECONDS);
}

export function totp(secret: string, now: number = Date.now(), digits = TOTP_DIGITS): string {
  return hotp(secret, totpStep(now), digits);
}

/// Giây còn lại trước khi mã hiện tại đổi.
export function totpSecondsLeft(now: number = Date.now()): number {
  return TOTP_STEP_SECONDS - (Math.floor(now / 1000) % TOTP_STEP_SECONDS);
}

/// Kiểm tra mã 6 số. Chấp nhận lệch `window` bước (mặc định ±1 = ±30 giây) để
/// bù đồng hồ điện thoại lệch và thời gian gõ. Trả về bước khớp (để chống dùng
/// lại mã), hoặc null nếu sai.
export function verifyTotp(
  secret: string,
  code: string,
  options: { now?: number; window?: number; minStep?: number } = {}
): number | null {
  const normalized = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const current = totpStep(options.now ?? Date.now());
  const window = options.window ?? 1;
  for (let delta = -window; delta <= window; delta++) {
    const step = current + delta;
    // Bước đã dùng rồi thì không nhận lại (cùng một mã không đăng nhập được 2 lần).
    if (options.minStep !== undefined && step <= options.minStep) continue;
    if (hotp(secret, step) === normalized) return step;
  }
  return null;
}

/// Đường dẫn otpauth:// để app xác thực quét qua mã QR.
export function otpauthUrl(issuer: string, account: string, secret: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
