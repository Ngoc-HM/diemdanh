import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import nodemailer from "nodemailer";
import { queryOne } from "@/lib/db";
import { DEV_SECRET } from "@/lib/session-token";

/// Cấu hình SMTP do admin nhập ở trang Email, lưu trong bảng Settings (không
/// dùng .env). Mật khẩu SMTP được mã hoá trước khi lưu.
export type EmailConfig = {
  host: string;
  port: number;
  /// true = TLS ngay từ đầu (thường cổng 465); false = STARTTLS (cổng 587).
  secure: boolean;
  user: string;
  /// Đã giải mã, sẵn sàng đưa cho nodemailer.
  password: string;
  /// Địa chỉ người gửi, vd `Chấm công <noreply@congty.vn>`.
  from: string;
  reminderEnabled: boolean;
  /// Email báo cho nhân viên khi admin sửa công / duyệt đổi ca / duyệt OT.
  notifyEnabled: boolean;
};

const SETTING_KEY = "email_config";

/// Khoá mã hoá mật khẩu SMTP dẫn xuất từ AUTH_SECRET, để dump database không
/// lộ mật khẩu. Đổi AUTH_SECRET thì admin phải nhập lại mật khẩu SMTP.
function encryptionKey(): Buffer {
  return createHash("sha256")
    .update(process.env.AUTH_SECRET || DEV_SECRET)
    .digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string | null {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

type StoredConfig = Omit<EmailConfig, "password"> & {
  /// Chuỗi đã mã hoá, hoặc rỗng nếu SMTP không cần đăng nhập.
  password: string;
};

export async function getEmailConfig(): Promise<EmailConfig | null> {
  const row = await queryOne<{ value: string }>(
    `SELECT "value" FROM "Settings" WHERE "key" = $1`,
    [SETTING_KEY]
  );
  if (!row) return null;

  try {
    const stored = JSON.parse(row.value) as Partial<StoredConfig>;
    return {
      host: stored.host ?? "",
      port: Number(stored.port) || 587,
      secure: Boolean(stored.secure),
      user: stored.user ?? "",
      password: stored.password ? (decryptSecret(stored.password) ?? "") : "",
      from: stored.from ?? "",
      reminderEnabled: Boolean(stored.reminderEnabled),
      // Cấu hình lưu trước khi có tuỳ chọn này thì mặc định bật.
      notifyEnabled: stored.notifyEnabled !== false,
    };
  } catch {
    return null;
  }
}

export async function saveEmailConfig(config: EmailConfig): Promise<void> {
  const stored: StoredConfig = {
    ...config,
    password: config.password ? encryptSecret(config.password) : "",
  };
  await queryOne(
    `INSERT INTO "Settings" ("key", "value") VALUES ($1, $2)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
     RETURNING "key"`,
    [SETTING_KEY, JSON.stringify(stored)]
  );
}

/// SMTP đã đủ thông tin để gửi được chưa.
export function isEmailReady(config: EmailConfig | null): config is EmailConfig {
  return Boolean(config && config.host && config.from);
}

export async function sendMail(
  config: EmailConfig,
  message: { to: string; subject: string; text: string; html?: string }
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });
  await transport.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

/// Mã đặt lại mật khẩu: 8 chữ số, sống 15 phút, sai quá 5 lần thì huỷ.
export const RESET_CODE_LENGTH = 8;
export const RESET_CODE_TTL_MINUTES = 15;
export const RESET_CODE_MAX_ATTEMPTS = 5;

/// Băm mã đặt lại mật khẩu trước khi lưu/tra cứu.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
