-- Prisma trước đây tự sinh `id` (cuid) và tự cập nhật `updatedAt` ở tầng ứng dụng.
-- Bỏ Prisma thì đẩy hai việc đó xuống database, để câu INSERT không phải mang theo
-- id và mốc thời gian.

ALTER TABLE "User"                 ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Attendance"           ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "AttendancePunch"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "WorkLocation"         ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Settings"             ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Admin"                ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "WorkSession"          ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "ScheduleRegistration" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "ScheduleDay"          ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Holiday"              ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

ALTER TABLE "User"                 ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Attendance"           ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "WorkLocation"         ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Admin"                ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "WorkSession"          ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ScheduleRegistration" ALTER COLUMN "updatedAt" SET DEFAULT now();

-- Bảng ghi nhận migration của Prisma không còn dùng tới.
DROP TABLE IF EXISTS "_prisma_migrations";
