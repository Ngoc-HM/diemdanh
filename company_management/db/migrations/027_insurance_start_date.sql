-- Ngày bắt đầu đóng BH: từ tháng chứa ngày này mới trừ BH vào lương.
ALTER TABLE "PayProfile" ADD COLUMN IF NOT EXISTS "insuranceStartDate" TEXT;
