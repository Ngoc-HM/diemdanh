// Import theo subpath thay vì barrel `jose`: barrel kéo theo nhánh JWE có dùng
// CompressionStream, thứ không chạy được trên Edge Runtime của middleware.
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

/// Khoá ký JWT. Ở production bắt buộc phải có `AUTH_SECRET`: thiếu mà vẫn chạy
/// bằng chuỗi mặc định thì ai cũng tự ký được session admin. Chỉ môi trường
/// dev mới được dùng fallback.
export const DEV_SECRET = "company-management-secret-key-change-in-production";

/// Độ dài tối thiểu của AUTH_SECRET ở production (HS256 khuyến nghị >= 32 byte).
const MIN_SECRET_LENGTH = 32;

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (secret?.length ?? 0) < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET phải có ít nhất ${MIN_SECRET_LENGTH} ký tự ở production — khoá ngắn thì session có thể bị dò.`
    );
  }
  if (!secret) {
    console.warn(
      "[auth] Chưa đặt AUTH_SECRET, đang dùng khoá mặc định cho môi trường dev."
    );
  }

  cachedSecret = new TextEncoder().encode(secret || DEV_SECRET);
  return cachedSecret;
}

export type SessionPayload = {
  userId: string;
  role: "admin" | "employee";
  name: string;
  email: string;
};

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/// Phiên còn hạn 7 ngày, nhưng mỗi lần nhân viên mở web mà phiên đã quá một
/// ngày thì ký lại từ đầu — ai còn dùng hằng ngày thì không bao giờ bị đá ra.
export const SESSION_REFRESH_AFTER_SECONDS = 60 * 60 * 24;

/// Thuộc tính cookie phiên, dùng chung cho route handler (Node) và middleware
/// (edge) để hai nơi không đặt lệch nhau.
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export async function signSession(payload: SessionPayload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

/// Payload đọc từ JWT, kèm mốc phát hành để biết có nên gia hạn hay chưa.
export type VerifiedSession = SessionPayload & { iat?: number };

/// Không phụ thuộc `next/headers` nên dùng được cả trong middleware (edge runtime).
export async function verifySession(
  token: string
): Promise<VerifiedSession | null> {
  // Lấy khoá ngoài try: thiếu AUTH_SECRET ở production phải nổ lỗi, không được
  // biến thành "session không hợp lệ" khiến mọi người bị đăng xuất âm thầm.
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as VerifiedSession;
  } catch {
    return null;
  }
}
