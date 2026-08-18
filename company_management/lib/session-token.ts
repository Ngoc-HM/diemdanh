// Import theo subpath thay vì barrel `jose`: barrel kéo theo nhánh JWE có dùng
// CompressionStream, thứ không chạy được trên Edge Runtime của middleware.
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "company-management-secret-key-change-in-production"
);

export type SessionPayload = {
  userId: string;
  role: "admin" | "employee";
  name: string;
  email: string;
};

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function signSession(payload: SessionPayload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

/// Không phụ thuộc `next/headers` nên dùng được cả trong middleware (edge runtime).
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
