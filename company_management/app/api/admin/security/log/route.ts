import { query } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/auth-guard";

const MAX_ROWS = 300;

/// Nhật ký bảo mật cho admin:
/// - ?tab=punch: các lần bấm Vào / Ra ca (&only=suspicious: chỉ lần bị từ chối hoặc có cờ)
/// - ?tab=login: đăng nhập, sai mật khẩu, đổi mật khẩu, bật / tắt 2 lớp
/// &days=N giới hạn số ngày gần nhất (mặc định 7, tối đa 90).
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") === "login" ? "login" : "punch";
    const days = Math.min(
      90,
      Math.max(1, Number(url.searchParams.get("days")) || 7),
    );
    const suspicious = url.searchParams.get("only") === "suspicious";

    if (tab === "login") {
      const rows = await query(
        `SELECT e."id", e."accountType", e."identifier", e."event", e."ip", e."userAgent",
                e."createdAt", u."name" AS "userName"
           FROM "LoginEvent" e
           LEFT JOIN "User" u ON e."accountType" = 'employee' AND u."id" = e."accountId"
          WHERE e."createdAt" > now() - ($1 || ' days')::interval
            ${suspicious ? `AND e."event" IN ('login_failed', '2fa_failed')` : ""}
          ORDER BY e."createdAt" DESC
          LIMIT ${MAX_ROWS}`,
        [String(days)],
      );
      return { tab, rows };
    }

    const rows = await query(
      `SELECT p."id", p."type", p."result", p."reason", p."latitude", p."longitude",
              p."accuracy", p."distance", p."ip", p."userAgent", p."flags", p."createdAt",
              u."name" AS "userName", u."email" AS "userEmail", l."name" AS "locationName"
         FROM "PunchAttempt" p
         JOIN "User" u ON u."id" = p."userId"
         LEFT JOIN "WorkLocation" l ON l."id" = p."locationId"
        WHERE p."createdAt" > now() - ($1 || ' days')::interval
          ${suspicious ? `AND (p."result" = 'rejected' OR cardinality(p."flags") > 0)` : ""}
        ORDER BY p."createdAt" DESC
        LIMIT ${MAX_ROWS}`,
      [String(days)],
    );
    return { tab, rows };
  }, "Security log read error");
}
