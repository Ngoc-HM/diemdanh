-- Siết bảo mật sau bài test vượt định vị (06/10/2026). Phòng thủ đặt ở chính
-- server chấm công, không phụ thuộc máy tấn công là máy nào.

-- 1. Phiên đăng nhập: số phiên bản nằm trong JWT. Đổi / đặt lại mật khẩu, bật /
--    tắt xác thực 2 lớp thì tăng số này — mọi phiên cũ hết hiệu lực ngay.
ALTER TABLE "User"  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Admin" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- 2. Xác thực 2 lớp (TOTP, quét bằng Google Authenticator). Khoá lưu mã hoá
--    bằng khoá dẫn xuất từ AUTH_SECRET; mã dự phòng chỉ lưu băm.
--    totpLastStep chống dùng lại một mã 6 số trong cùng khoảng 30 giây.
ALTER TABLE "User"
    ADD COLUMN "totpSecret" TEXT,
    ADD COLUMN "totpPendingSecret" TEXT,
    ADD COLUMN "totpEnabledAt" TIMESTAMPTZ,
    ADD COLUMN "totpBackupCodes" TEXT[],
    ADD COLUMN "totpLastStep" BIGINT;
ALTER TABLE "Admin"
    ADD COLUMN "totpSecret" TEXT,
    ADD COLUMN "totpPendingSecret" TEXT,
    ADD COLUMN "totpEnabledAt" TIMESTAMPTZ,
    ADD COLUMN "totpBackupCodes" TEXT[],
    ADD COLUMN "totpLastStep" BIGINT;

-- 3. Nhật ký đăng nhập: thành công, sai mật khẩu, sai mã 2 lớp, đổi mật khẩu...
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "accountType" TEXT NOT NULL,
    -- NULL khi tài khoản không tồn tại (đăng nhập sai bằng email lạ).
    "accountId" TEXT,
    "identifier" TEXT,
    "event" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoginEvent_accountType_check" CHECK ("accountType" IN ('admin', 'employee', 'unknown'))
);
CREATE INDEX "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt" DESC);
CREATE INDEX "LoginEvent_account_idx" ON "LoginEvent"("accountId", "createdAt" DESC);

-- 4. Nhật ký mọi lần bấm Vào / Ra ca, kể cả lần bị từ chối, kèm IP, trình
--    duyệt, độ chính xác GPS và các cờ bất thường.
CREATE TABLE "PunchAttempt" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    -- Lý do từ chối (outside_radius, presence_code, no_location...); NULL nếu nhận.
    "reason" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "distance" DOUBLE PRECISION,
    "locationId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "flags" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "PunchAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PunchAttempt_result_check" CHECK ("result" IN ('accepted', 'rejected')),
    CONSTRAINT "PunchAttempt_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PunchAttempt_createdAt_idx" ON "PunchAttempt"("createdAt" DESC);
CREATE INDEX "PunchAttempt_user_idx" ON "PunchAttempt"("userId", "createdAt" DESC);
CREATE INDEX "PunchAttempt_ip_idx" ON "PunchAttempt"("ip", "createdAt" DESC);

-- 5. Màn hình hiện mã có mặt đặt ở văn phòng. Admin đăng ký từng thiết bị;
--    thiết bị giữ một cookie bí mật, server chỉ lưu băm.
CREATE TABLE "KioskDevice" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "lastSeenAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,

    CONSTRAINT "KioskDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KioskDevice_tokenHash_key" ON "KioskDevice"("tokenHash");

-- Chính sách chấm công: ngoài bán kính thì từ chối hay nhận kèm cờ; có bắt
-- nhập mã có mặt không. Mặc định giữ đúng hành vi cũ.
INSERT INTO "Settings" ("id", "key", "value")
VALUES ('cfg_attendance_policy', 'attendance_policy',
        '{"outsideRadius":"reject","presenceCode":false}')
ON CONFLICT ("key") DO NOTHING;
