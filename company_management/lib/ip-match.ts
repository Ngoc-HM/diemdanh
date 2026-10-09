/// So khớp địa chỉ IPv4 với IP đơn lẻ hoặc dải CIDR. Thuần logic, dùng chung
/// cho middleware (chặn cả web) và route chấm công (chỉ nhận mạng văn phòng).
/// Hệ thống chỉ mở IPv4 (Caddy không nghe IPv6), IP khác dạng coi như không khớp.

export function parseIpv4(input: string | null | undefined): number | null {
  const parts = String(input ?? "").trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function formatIpv4(value: number): string {
  return [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join(".");
}

/// "192.168.1.26" | "192.168.1.0/24" → dạng chuẩn ("192.168.1.26",
/// "192.168.1.0/24"), phần host của dải được xoá về 0. Sai định dạng → null.
export function normalizeCidr(input: string | null | undefined): string | null {
  const [address, prefix, extra] = String(input ?? "").trim().split("/");
  if (extra !== undefined) return null;
  const ip = parseIpv4(address);
  if (ip === null) return null;
  if (prefix === undefined) return formatIpv4(ip);
  if (!/^\d{1,2}$/.test(prefix)) return null;
  const bits = Number(prefix);
  if (bits < 1 || bits > 32) return null;
  if (bits === 32) return formatIpv4(ip);
  const size = 2 ** (32 - bits);
  return `${formatIpv4(Math.floor(ip / size) * size)}/${bits}`;
}

/// IP có nằm trong dải (hoặc trùng IP) không.
export function ipInCidr(ip: string | null | undefined, cidr: string): boolean {
  const value = parseIpv4(ip);
  const normalized = normalizeCidr(cidr);
  if (value === null || normalized === null) return false;
  const [address, prefix] = normalized.split("/");
  const base = parseIpv4(address)!;
  const size = 2 ** (32 - (prefix ? Number(prefix) : 32));
  return value >= base && value < base + size;
}

/// Địa chỉ của chính máy chủ (127.x.x.x, ::1): request không đi qua Caddy,
/// vd healthcheck của Docker. Next tự gắn X-Forwarded-For bằng địa chỉ này.
export function isLoopbackIp(ip: string | null | undefined): boolean {
  const value = String(ip ?? "").trim();
  return value === "::1" || ipInCidr(value, "127.0.0.0/8");
}

/// Dải đầu tiên chứa IP, hoặc null.
export function findMatchingCidr(ip: string | null | undefined, ranges: string[]): string | null {
  return ranges.find((range) => ipInCidr(ip, range)) ?? null;
}

/// Dải mạng được phép chấm công (Settings `punch_network`).
export type PunchNetwork = { enabled: boolean; ranges: string[] };

export function parsePunchNetwork(raw: string | null | undefined): PunchNetwork {
  try {
    const value = JSON.parse(raw ?? "{}");
    const ranges = Array.isArray(value?.ranges)
      ? value.ranges.map((range: unknown) => normalizeCidr(String(range))).filter(Boolean)
      : [];
    return { enabled: value?.enabled === true && ranges.length > 0, ranges };
  } catch {
    return { enabled: false, ranges: [] };
  }
}
