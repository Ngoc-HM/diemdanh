/// Chính sách chấm công (trang Bảo mật). Thuần logic, không đụng database.

export type AttendancePolicy = {
  /// Ngoài bán kính: "reject" = từ chối như cũ; "flag" = vẫn nhận nhưng gắn
  /// cờ để admin xem lại. "flag" chỉ có hiệu lực khi đang bắt mã có mặt.
  outsideRadius: "reject" | "flag";
  presenceCode: boolean;
};

export const DEFAULT_POLICY: AttendancePolicy = {
  outsideRadius: "reject",
  presenceCode: false,
};

export function parsePolicy(raw: string | null | undefined): AttendancePolicy {
  try {
    const value = JSON.parse(raw ?? "{}");
    return {
      outsideRadius: value?.outsideRadius === "flag" ? "flag" : "reject",
      presenceCode: value?.presenceCode === true,
    };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

/// GPS sai có bị từ chối không. Không bắt mã có mặt thì GPS là lớp chặn duy
/// nhất, nên luôn từ chối dù cấu hình là "flag".
export function rejectsOutsideRadius(policy: AttendancePolicy): boolean {
  return policy.outsideRadius === "reject" || !policy.presenceCode;
}
