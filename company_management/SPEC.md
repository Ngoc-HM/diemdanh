# SPEC — đã thay bằng README.md

Bản spec ban đầu (SQLite + NextAuth, một check-in mỗi ngày, admin hardcode) không
còn khớp với hệ thống hiện tại. Nội dung đặc tả nghiệp vụ và kỹ thuật giờ nằm ở
[README.md](./README.md) để tránh hai tài liệu trôi khác nhau.

Những điểm đã đổi so với spec cũ:

| Spec cũ | Hiện tại |
|---|---|
| SQLite | PostgreSQL, driver `pg`, SQL viết tay, không dùng ORM |
| NextAuth v5 | JWT tự ký bằng `jose`, lưu trong cookie `httpOnly` |
| Admin hardcode `admin/admin123` | Bảng `Admin`, mật khẩu băm bcrypt, `.env` chỉ dùng để khởi tạo lần đầu |
| Một check-in + một check-out mỗi ngày | Nhiều cặp `in`/`out` mỗi ngày (`AttendancePunch`) |
| Khoảng cách chỉ để hiển thị | Bán kính được áp: ngoài vùng thì từ chối chấm công |
| Không có lịch làm việc | Đăng ký lịch theo tháng cho part-time/intern, lịch cố định T2–T6 cho full-time |
| `getToday()` theo giờ máy chủ | Chốt cứng `Asia/Ho_Chi_Minh` |
