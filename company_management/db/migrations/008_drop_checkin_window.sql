-- Khung "giờ được phép check-in" của ca chưa bao giờ được dùng khi tính công
-- (đi muộn tính theo workStart, đủ công theo minHours) và chỉ gây nhầm cho
-- admin. Nhân viên được bấm giờ lúc nào cũng được, nên bỏ hẳn hai cột này.
ALTER TABLE "WorkSession" DROP COLUMN "checkInStart";
ALTER TABLE "WorkSession" DROP COLUMN "checkInEnd";
