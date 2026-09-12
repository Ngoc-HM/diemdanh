-- Quên mật khẩu chuyển từ link sang mã OTP 8 số gửi qua email. Cột
-- "tokenHash" giờ giữ băm của mã OTP thay vì băm của token trong link.
--
-- Mã chỉ có 8 chữ số nên phải đếm số lần nhập sai: quá ngưỡng thì huỷ mã,
-- không để ai dò hết 100 triệu tổ hợp.
ALTER TABLE "PasswordReset" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- Mã cũ (băm của token trong link) không còn dùng được nữa.
DELETE FROM "PasswordReset";
