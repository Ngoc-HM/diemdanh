-- Ngày công tính theo phần ngày như bảng lương kế toán: ca sáng / chiều là nửa
-- ngày (x/2), ca cả ngày là một ngày (x). Mỗi ca mang số công riêng, admin đặt
-- ở trang Ca làm việc.
ALTER TABLE "WorkSession"
    ADD COLUMN "workdayValue" DOUBLE PRECISION NOT NULL DEFAULT 1;

UPDATE "WorkSession" SET "workdayValue" = 0.5 WHERE "code" IN ('S', 'C');
-- Tăng ca không cộng ngày công: OT trả theo giờ × hệ số, tính riêng.
UPDATE "WorkSession" SET "workdayValue" = 0 WHERE "code" = 'T';

ALTER TABLE "WorkSession"
    ADD CONSTRAINT "WorkSession_workdayValue_check"
    CHECK ("workdayValue" >= 0 AND "workdayValue" <= 1);

-- Quyết định của admin cho ngày làm thiếu giờ. Ngày thiếu giờ mặc định vẫn
-- tính đủ công; admin xem lại rồi chọn tính ('count') hoặc không tính
-- ('exclude'). Chưa có dòng nào = chưa xem, hết tháng vẫn tính đủ.
CREATE TABLE "DayReview" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "DayReview_pkey" PRIMARY KEY ("userId", "date"),
    CONSTRAINT "DayReview_decision_check" CHECK ("decision" IN ('count', 'exclude')),
    CONSTRAINT "DayReview_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE
);
