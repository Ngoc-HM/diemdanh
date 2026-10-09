import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { normalizeCidr } from "@/lib/ip-match";
import { getPunchNetwork, savePunchNetwork } from "@/lib/ip-policy";
import { clientIp } from "@/lib/request-meta";

/// Dải mạng văn phòng được phép chấm công. Kèm IP của chính admin để dễ khai.
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    return { network: await getPunchNetwork(), currentIp: clientIp(req) };
  }, "Punch network read error");
}

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const rawRanges: unknown[] = Array.isArray(body?.ranges) ? body.ranges : [];
    const ranges: string[] = [];
    for (const raw of rawRanges) {
      const text = String(raw ?? "").trim();
      if (!text) continue;
      const normalized = normalizeCidr(text);
      if (!normalized) badRequest(`"${text}" không phải IP hoặc dải IP hợp lệ (vd 192.168.1.0/24)`);
      if (!ranges.includes(normalized!)) ranges.push(normalized!);
    }
    if (ranges.length > 50) badRequest("Tối đa 50 dải mạng");
    const enabled = body?.enabled === true;
    if (enabled && ranges.length === 0) badRequest("Cần ít nhất một dải mạng khi bật");
    return { network: await savePunchNetwork({ enabled, ranges }), currentIp: clientIp(req) };
  }, "Punch network write error");
}
