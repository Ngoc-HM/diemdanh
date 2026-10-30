-- Lương thử việc nhập mức cố định (đ). NULL = tính theo % lương cơ bản.
ALTER TABLE "PayProfile" ADD COLUMN IF NOT EXISTS "probationSalary" BIGINT;
ALTER TABLE "PayProfile" DROP CONSTRAINT IF EXISTS "PayProfile_probationSalary_check";
ALTER TABLE "PayProfile" ADD CONSTRAINT "PayProfile_probationSalary_check"
    CHECK ("probationSalary" IS NULL OR "probationSalary" >= 0);
