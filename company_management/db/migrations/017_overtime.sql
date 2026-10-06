-- Phiếu làm thêm giờ (OT). Nhân viên khai ngày, giờ dự kiến, nơi đi/đến và nội
-- dung; admin duyệt mới được trả. Ký hiệu và hệ số tự suy ra theo ngày:
-- T = ngày thường, T1 = ngày nghỉ hằng tuần, T2 = ngày lễ.
-- Số giờ OT lấy từ chấm công thực tế; không có đủ giờ vào/ra (đi công tác...)
-- thì lấy giờ dự kiến trên phiếu. Admin chốt tay được bằng approvedMinutes.
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    -- "HH:MM" giờ VN, cùng một ngày (không kéo qua nửa đêm).
    "plannedStart" TEXT NOT NULL,
    "plannedEnd" TEXT NOT NULL,
    -- Nơi đi / nơi đến, như cột trong "Bảng chấm công làm thêm giờ".
    "place" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    -- Số phút admin chốt; NULL = tính theo chấm công / giờ dự kiến.
    "approvedMinutes" INTEGER,
    "adminNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OvertimeRequest_status_check"
        CHECK ("status" IN ('pending', 'approved', 'rejected')),
    CONSTRAINT "OvertimeRequest_minutes_check"
        CHECK ("approvedMinutes" IS NULL OR ("approvedMinutes" >= 0 AND "approvedMinutes" <= 1440)),
    CONSTRAINT "OvertimeRequest_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OvertimeRequest_status_idx" ON "OvertimeRequest"("status");
-- Mỗi người mỗi ngày chỉ một phiếu còn hiệu lực (chờ hoặc đã duyệt); phiếu bị
-- từ chối giữ lại làm lịch sử và không chặn khai lại.
CREATE UNIQUE INDEX "OvertimeRequest_active_key"
    ON "OvertimeRequest"("userId", "date") WHERE "status" <> 'rejected';

-- Hệ số OT (%) và số giờ chuẩn một ngày để quy ra lương giờ. Admin sửa ở
-- trang Làm thêm giờ.
INSERT INTO "Settings" ("id", "key", "value")
VALUES ('cfg_overtime', 'overtime_config',
        '{"weekdayRate":150,"weeklyOffRate":200,"holidayRate":300,"hoursPerDay":8}')
ON CONFLICT ("key") DO NOTHING;
