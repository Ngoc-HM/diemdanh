-- Cửa sổ đăng ký lịch tháng sau trước đây chôn cứng "từ ngày 20 đến hết tháng".
-- Giờ admin đặt được cả ngày mở lẫn ngày đóng ở trang Lịch làm việc; giá trị
-- lưu dạng "openDay-closeDay", ngày đóng 31 nghĩa là hết tháng (tháng ngắn
-- hơn thì hệ thống tự kẹp về ngày cuối tháng).
INSERT INTO "Settings" ("id", "key", "value")
VALUES ('cfg_schedule_registration_window', 'schedule_registration_window', '20-31')
ON CONFLICT ("key") DO NOTHING;
