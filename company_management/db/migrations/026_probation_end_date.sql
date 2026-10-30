-- Ngày cuối hưởng lương thử việc: tháng có ngày này thì phần trước tính theo %
-- thử việc, phần sau tính 100% lương.
ALTER TABLE "PayProfile" ADD COLUMN IF NOT EXISTS "probationEndDate" TEXT;
