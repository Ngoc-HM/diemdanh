import { redirect } from "next/navigation";

/// Đổi mật khẩu nay nằm trong tab Cài đặt; giữ đường dẫn cũ cho link đã lưu.
export default function ChangePasswordRedirect() {
  redirect("/dashboard/settings");
}
