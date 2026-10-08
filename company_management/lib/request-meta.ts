/// IP và trình duyệt của người gửi request, để ghi nhật ký.
///
/// Ở production app chỉ nghe 127.0.0.1 và đứng sau Caddy; Caddy tự đặt
/// X-Forwarded-For bằng IP thật của máy kết nối (không tin giá trị client tự
/// gửi lên), nên lấy phần tử đầu tiên là đủ.
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const ip = first || req.headers.get("x-real-ip")?.trim() || null;
  if (!ip) return null;
  // Bỏ tiền tố IPv6 của địa chỉ IPv4 (::ffff:192.168.1.10).
  return ip.replace(/^::ffff:/, "").slice(0, 64);
}

export function userAgent(req: Request): string | null {
  return req.headers.get("user-agent")?.slice(0, 300) ?? null;
}
