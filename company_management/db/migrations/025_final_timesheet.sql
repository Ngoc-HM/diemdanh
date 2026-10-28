-- Bảng công chốt: những ô admin tự chấm tay. Ô nào có dòng ở đây thì lấy theo
-- admin (quyết định cuối cùng) cho file Excel và bảng lương; ô không có dòng thì
-- lấy theo máy chấm.
CREATE TABLE IF NOT EXISTS "FinalTimesheetDay" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    -- work (có công), leave (N), sick (O), absent (V), holiday (L), off (trống).
    "status" TEXT NOT NULL,
    -- Mã ca ghi trên ô khi status = work (rỗng = ghi x / x/2).
    "codes" TEXT[] NOT NULL DEFAULT '{}',
    "workday" NUMERIC(3, 1) NOT NULL DEFAULT 0,
    "editedBy" TEXT,
    "editedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "FinalTimesheetDay_pkey" PRIMARY KEY ("userId", "date"),
    CONSTRAINT "FinalTimesheetDay_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinalTimesheetDay_status_check"
        CHECK ("status" IN ('work', 'leave', 'sick', 'absent', 'holiday', 'off'))
);
