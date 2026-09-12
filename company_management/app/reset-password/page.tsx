import { redirect } from "next/navigation";

/// Trước đây đặt lại mật khẩu bằng link trong email; nay dùng mã 8 số nhập
/// thẳng ở trang Quên mật khẩu. Giữ đường dẫn cũ để link đã gửi không vào 404.
export default function ResetPasswordRedirect() {
  redirect("/forgot-password");
}
