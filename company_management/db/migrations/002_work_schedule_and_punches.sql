-- Hồ sơ nhân viên + phân loại hợp đồng
ALTER TABLE "User" ADD COLUMN     "employeeCode" TEXT,
                   ADD COLUMN     "employmentType" TEXT NOT NULL DEFAULT 'full_time',
                   ADD COLUMN     "phone" TEXT,
                   ADD COLUMN     "department" TEXT,
                   ADD COLUMN     "position" TEXT,
                   ADD COLUMN     "startDate" TIMESTAMP(3),
                   ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");
CREATE INDEX "User_isActive_name_idx" ON "User"("isActive", "name");

-- Ca làm việc: bổ sung khung giờ làm và cờ ca mặc định cho full-time
ALTER TABLE "WorkSession" ADD COLUMN "workStart" TEXT,
                          ADD COLUMN "workEnd" TEXT,
                          ADD COLUMN "isDefaultFull" BOOLEAN NOT NULL DEFAULT false;

UPDATE "WorkSession" SET "workStart" = "checkInStart" WHERE "workStart" IS NULL;
UPDATE "WorkSession" SET "workEnd" = "checkInEnd" WHERE "workEnd" IS NULL;

ALTER TABLE "WorkSession" ALTER COLUMN "workStart" SET NOT NULL,
                          ALTER COLUMN "workEnd" SET NOT NULL;

-- Bảng chấm công: thêm ghi chú và dấu vết sửa tay
ALTER TABLE "Attendance" ADD COLUMN "note" TEXT,
                         ADD COLUMN "editedBy" TEXT,
                         ADD COLUMN "editedAt" TIMESTAMP(3),
                         ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Attendance" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Mỗi lần bấm giờ là một dòng, ghép cặp in -> out để tính giờ công nhiều ca/ngày
CREATE TABLE "AttendancePunch" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "distance" DOUBLE PRECISION,
    "locationId" TEXT,
    "withinRadius" BOOLEAN NOT NULL DEFAULT false,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);

-- Chuyển dữ liệu cũ: check-in nằm trên Attendance, check-out nằm ở CheckoutEvent
INSERT INTO "AttendancePunch" ("id", "attendanceId", "type", "at", "latitude", "longitude", "distance", "createdAt")
SELECT CONCAT('mig_in_', "id"), "id", 'in', "checkIn", "checkInLat", "checkInLng", "checkInDistance", "checkIn"
FROM "Attendance"
WHERE "checkIn" IS NOT NULL;

INSERT INTO "AttendancePunch" ("id", "attendanceId", "type", "at", "latitude", "longitude", "distance", "createdAt")
SELECT CONCAT('mig_out_', "id"), "attendanceId", 'out', "checkedOutAt", "latitude", "longitude", "distance", "createdAt"
FROM "CheckoutEvent";

CREATE INDEX "AttendancePunch_attendanceId_at_idx" ON "AttendancePunch"("attendanceId", "at");

ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_attendanceId_fkey"
    FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "WorkLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Các cột/bảng cũ đã được thay bằng AttendancePunch
DROP TABLE "CheckoutEvent";
DROP TABLE "SessionAttendance";

ALTER TABLE "Attendance" DROP COLUMN "checkIn",
                         DROP COLUMN "checkInLat",
                         DROP COLUMN "checkInLng",
                         DROP COLUMN "checkInDistance",
                         DROP COLUMN "checkOut",
                         DROP COLUMN "checkOutLat",
                         DROP COLUMN "checkOutLng",
                         DROP COLUMN "checkOutDistance";

-- Đăng ký lịch làm việc theo tháng (part-time / intern)
CREATE TABLE "ScheduleRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleDay" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleRegistration_userId_month_key" ON "ScheduleRegistration"("userId", "month");
CREATE INDEX "ScheduleRegistration_month_idx" ON "ScheduleRegistration"("month");
CREATE UNIQUE INDEX "ScheduleDay_registrationId_date_sessionId_key" ON "ScheduleDay"("registrationId", "date", "sessionId");
CREATE INDEX "ScheduleDay_date_idx" ON "ScheduleDay"("date");
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

ALTER TABLE "ScheduleRegistration" ADD CONSTRAINT "ScheduleRegistration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleDay" ADD CONSTRAINT "ScheduleDay_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "ScheduleRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleDay" ADD CONSTRAINT "ScheduleDay_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
