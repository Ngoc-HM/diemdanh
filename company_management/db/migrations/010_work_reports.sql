-- Nội dung công việc hằng ngày: nhân viên khai ngày làm việc thành một chuỗi
-- khoảng thời gian liền mạch, mỗi khoảng kèm mô tả việc đã làm. Khoá theo
-- (userId, date) như "DayMark" chứ không gắn vào "Attendance", vì ngày không
-- bấm giờ (lỗi GPS, admin bổ sung sau) vẫn phải khai được.
--
-- Chuỗi liền mạch — entry[i]."endAt" = entry[i+1]."startAt" — do API giữ, không
-- ép ở database, cùng cách hệ thống đang giữ luật "mỗi ngày một check-in".
CREATE TABLE "WorkReportEntry" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    -- Khoá ngày theo lịch Việt Nam, dạng YYYY-MM-DD.
    "date" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "WorkReportEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkReportEntry_time_check" CHECK ("endAt" > "startAt")
);

-- Hai khoảng của cùng một ngày không bao giờ bắt đầu cùng lúc.
CREATE UNIQUE INDEX "WorkReportEntry_userId_date_startAt_key"
    ON "WorkReportEntry"("userId", "date", "startAt");
CREATE INDEX "WorkReportEntry_date_idx" ON "WorkReportEntry"("date");

ALTER TABLE "WorkReportEntry" ADD CONSTRAINT "WorkReportEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
