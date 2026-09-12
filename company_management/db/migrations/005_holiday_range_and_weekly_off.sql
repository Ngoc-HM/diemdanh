-- Ngày lễ theo khoảng: một đợt nghỉ (vd Tết) trải từ startDate tới endDate,
-- hệ thống tự bung ra từng ngày khi tính công.
ALTER TABLE "Holiday" ADD COLUMN "startDate" TEXT,
                      ADD COLUMN "endDate" TEXT;

UPDATE "Holiday" SET "startDate" = "date", "endDate" = "date";

ALTER TABLE "Holiday" ALTER COLUMN "startDate" SET NOT NULL,
                      ALTER COLUMN "endDate" SET NOT NULL;

CREATE INDEX "Holiday_range_idx" ON "Holiday"("startDate", "endDate");

-- Ngày nghỉ cố định hằng tuần (mặc định Thứ 7 + Chủ nhật), admin chỉnh được.
-- full-time chỉ bị gán lịch vào ngày KHÔNG thuộc danh sách này.
INSERT INTO "Settings" ("id", "key", "value")
VALUES ('cfg_weekly_off_days', 'weekly_off_days', '0,6')
ON CONFLICT ("key") DO NOTHING;
