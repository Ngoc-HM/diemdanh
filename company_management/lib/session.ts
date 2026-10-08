import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  SessionPayload,
  signSession,
  verifySession,
} from "@/lib/session-token";

export type { SessionPayload };
export { signSession, verifySession } from "@/lib/session-token";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/// Ký lại phiên của chính người đang thao tác với số phiên bản mới — dùng sau
/// khi đổi mật khẩu / bật tắt 2 lớp: các phiên khác bị đá ra, phiên này thì không.
export async function reissueSession(session: SessionPayload, sv: number) {
  const { userId, role, name, email } = session;
  await setSessionCookie(await signSession({ userId, role, name, email, sv }));
}
