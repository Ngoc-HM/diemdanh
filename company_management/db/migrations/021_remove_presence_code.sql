-- Bỏ tính năng mã có mặt (màn hình kiosk) thêm ở 020: chủ dự án không dùng.
-- Nhật ký chấm công / đăng nhập, xác thực 2 lớp và sessionVersion vẫn giữ.
DROP TABLE IF EXISTS "KioskDevice";
DELETE FROM "Settings" WHERE "key" IN ('attendance_policy', 'presence_secret');
