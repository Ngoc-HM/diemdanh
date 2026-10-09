import { isUniqueViolation, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, requireAdmin } from "@/lib/auth-guard";
import { ipInCidr, isLoopbackIp, normalizeCidr } from "@/lib/ip-match";
import { invalidateAccessRules, listBlockedIps } from "@/lib/ip-policy";
import { clientIp } from "@/lib/request-meta";

const NOTE_MAX = 200;

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    return { items: await listBlockedIps(), currentIp: clientIp(req) };
  }, "Blocked IP list error");
}

/// Thêm IP / dải IP vào blacklist: chặn khỏi toàn bộ web, có hiệu lực ngay.
/// Không cho chặn IP admin đang dùng, kẻo tự khoá mình ngoài trang quản trị.
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const raw = String(body?.cidr ?? "").trim();
    const note =
      String(body?.note ?? "")
        .trim()
        .slice(0, NOTE_MAX) || null;
    const cidr = normalizeCidr(raw);
    if (!cidr)
      badRequest("IP không hợp lệ. Nhập dạng 192.168.1.26 hoặc dải 10.0.0.0/8");
    if (ipInCidr("127.0.0.1", cidr!))
      badRequest("Không chặn được địa chỉ nội bộ của máy chủ (127.x.x.x)");
    const currentIp = clientIp(req);
    if (currentIp && !isLoopbackIp(currentIp) && ipInCidr(currentIp, cidr!)) {
      badRequest(
        `Không thể chặn ${cidr}: bạn đang truy cập từ IP ${currentIp}`,
      );
    }
    try {
      const item = await queryOne(
        `INSERT INTO "BlockedIp" ("cidr", "note", "createdBy") VALUES ($1, $2, $3)
         RETURNING "id", "cidr", "note", "createdAt"`,
        [cidr, note, admin.userId],
      );
      invalidateAccessRules();
      return { item };
    } catch (error) {
      if (isUniqueViolation(error))
        conflict(`${cidr} đã có trong danh sách chặn`);
      throw error;
    }
  }, "Blocked IP create error");
}
