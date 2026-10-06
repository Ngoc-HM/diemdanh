import { badRequest } from "@/lib/auth-guard";

/// Kiểm tra dữ liệu khoản hỗ trợ admin gửi lên (tạo mới / sửa).
const ALLOWANCE_MODES = ["monthly", "prorated", "per_day"];

export function normalizeAllowance(body: Record<string, unknown> | null) {
  const name = String(body?.name ?? "").trim();
  const amount = Number(body?.amount);
  const mode = String(body?.mode ?? "monthly");
  if (!name || name.length > 60) badRequest("Tên khoản hỗ trợ từ 1 đến 60 ký tự");
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
    badRequest("Số tiền không hợp lệ");
  }
  if (!ALLOWANCE_MODES.includes(mode)) badRequest("Cách tính không hợp lệ");
  return {
    name,
    amount: Math.round(amount),
    mode,
    taxable: body?.taxable === undefined ? true : Boolean(body.taxable),
    isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
  };
}

