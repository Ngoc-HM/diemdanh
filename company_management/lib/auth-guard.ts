import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { clearSessionCookie, getSession, SessionPayload } from "@/lib/session";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/// Trả về session admin, hoặc ném HttpError 401 để `handle` biến thành response.
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new HttpError(401, "Bạn không có quyền truy cập");
  }
  return session;
}

export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new HttpError(401, "Vui lòng đăng nhập lại");
  }
  return session;
}

export async function requireEmployee(): Promise<SessionPayload> {
  const session = await requireUser();
  if (session.role !== "employee") {
    throw new HttpError(403, "Chỉ nhân viên mới dùng được chức năng này");
  }
  // Tài khoản bị ngừng hoạt động sau khi đã đăng nhập: cookie còn hạn nhưng
  // không được dùng nữa. Xoá cookie luôn để lần điều hướng kế tiếp middleware
  // đẩy về trang đăng nhập thay vì đợi JWT hết hạn.
  const user = await queryOne<{ isActive: boolean }>(
    `SELECT "isActive" FROM "User" WHERE "id" = $1`,
    [session.userId]
  );
  if (!user || !user.isActive) {
    await clearSessionCookie();
    throw new HttpError(403, "Tài khoản đã ngừng hoạt động. Liên hệ quản trị viên.");
  }
  return session;
}

/// Bọc handler của route để lỗi nghiệp vụ trả về đúng status thay vì 500.
export async function handle<T>(
  fn: () => Promise<T>,
  context: string
): Promise<NextResponse> {
  try {
    const result = await fn();
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result as Record<string, unknown>);
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(`${context}:`, error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

export function notFound(message: string): never {
  throw new HttpError(404, message);
}

export function conflict(message: string): never {
  throw new HttpError(409, message);
}
