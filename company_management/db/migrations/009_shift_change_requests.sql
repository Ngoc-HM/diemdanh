-- Yêu cầu đổi ca của nhân viên: "ngày X tôi đăng ký S nhưng làm CN, lý do...".
-- Admin duyệt thì hệ thống ghi một DayMark (isAdminEdit = true) y như admin
-- tự chấm lại ô đó; từ chối thì lịch giữ nguyên. Mỗi nhân viên chỉ có một yêu
-- cầu đang chờ cho mỗi ngày; gửi lại thì ghi đè yêu cầu đang chờ.
CREATE TABLE "ShiftChangeRequest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    -- 'N' = xin nghỉ ngày đó; NULL = đổi sang các ca trong sessionIds.
    "leaveCode" TEXT,
    "sessionIds" TEXT[],
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "ShiftChangeRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShiftChangeRequest_status_check"
        CHECK ("status" IN ('pending', 'approved', 'rejected')),
    CONSTRAINT "ShiftChangeRequest_leaveCode_check" CHECK ("leaveCode" IN ('N'))
);

CREATE INDEX "ShiftChangeRequest_userId_date_idx" ON "ShiftChangeRequest"("userId", "date");
CREATE INDEX "ShiftChangeRequest_status_idx" ON "ShiftChangeRequest"("status");
CREATE UNIQUE INDEX "ShiftChangeRequest_pending_key"
    ON "ShiftChangeRequest"("userId", "date") WHERE "status" = 'pending';

ALTER TABLE "ShiftChangeRequest" ADD CONSTRAINT "ShiftChangeRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
