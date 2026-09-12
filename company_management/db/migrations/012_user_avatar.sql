-- Ảnh đại diện nhân viên tự upload ở trang Cài đặt. Lưu đường dẫn tương đối
-- (/uploads/avatar-<id>.<ext>) giống cách logo công ty đang lưu; file nằm
-- trong public/uploads nên máy chủ mới phải giữ lại thư mục đó.
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
