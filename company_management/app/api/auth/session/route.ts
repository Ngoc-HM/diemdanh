import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { clearSessionCookie, getSession } from "@/lib/session";

/// Phiên hiện tại. Nhân viên đã bị ngừng hoạt động, hoặc phiên đã bị thu hồi
/// (đổi mật khẩu, bật / tắt 2 lớp ở nơi khác), thì coi như không còn phiên và
/// xoá cookie để layout đẩy về trang đăng nhập.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  if (session.role === "employee") {
    // Ảnh đại diện đọc từ database chứ không nhét vào JWT: đổi ảnh là thấy
    // ngay, không phải đợi ký lại phiên.
    const user = await queryOne<{
      isActive: boolean;
      avatarUrl: string | null;
      sessionVersion: number;
    }>(
      `SELECT "isActive", "avatarUrl", "sessionVersion" FROM "User" WHERE "id" = $1`,
      [session.userId]
    );
    if (!user || !user.isActive || user.sessionVersion !== (session.sv ?? 0)) {
      await clearSessionCookie();
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user: { ...session, avatarUrl: user.avatarUrl } });
  }

  const admin = await queryOne<{ sessionVersion: number }>(
    `SELECT "sessionVersion" FROM "Admin" WHERE "id" = $1`,
    [session.userId]
  );
  if (!admin || admin.sessionVersion !== (session.sv ?? 0)) {
    await clearSessionCookie();
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: session });
}
