import { query } from "@/lib/db";
import { clientIp, userAgent } from "@/lib/request-meta";
import type { LoginEventType } from "@/lib/security-labels";

export type { LoginEventType };

/// Ghi nhật ký tài khoản. Lỗi ghi log không được làm hỏng việc chính (đăng
/// nhập, đổi mật khẩu), nên chỉ in ra console.
export async function logLoginEvent(
  req: Request | null,
  event: LoginEventType,
  account: { type: "admin" | "employee" | "unknown"; id?: string | null; identifier?: string | null }
) {
  try {
    await query(
      `INSERT INTO "LoginEvent" ("accountType", "accountId", "identifier", "event", "ip", "userAgent")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        account.type,
        account.id ?? null,
        account.identifier?.slice(0, 200) ?? null,
        event,
        req ? clientIp(req) : null,
        req ? userAgent(req) : null,
      ]
    );
  } catch (error) {
    console.error("Không ghi được nhật ký đăng nhập:", error);
  }
}
