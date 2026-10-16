-- Chấm công tự động qua wifi văn phòng.
--
-- Máy quét (service scanner, chung mạng với wifi) mỗi phút điểm danh thiết bị
-- trong dải văn phòng và ghi đè vào WifiPresence: MỘT dòng mỗi thiết bị, chỉ
-- giữ lần thấy gần nhất, không lưu lịch sử quét. Nhân viên tự đăng ký máy của
-- mình (EmployeeDevice); app đối chiếu hai bảng để ghi giờ vào / giờ ra.

CREATE TABLE IF NOT EXISTS "EmployeeDevice" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    -- Địa chỉ MAC chữ thường, dạng aa:bb:cc:dd:ee:ff. Một máy chỉ thuộc một người.
    "mac" TEXT NOT NULL,
    -- Mô tả ngắn lấy từ trình duyệt lúc đăng ký, vd "Safari · iPhone".
    "label" TEXT NOT NULL DEFAULT '',
    "registeredIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Lần quét gần nhất đã được app đối chiếu, để mỗi lần quét chỉ xử lý một lần.
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeDevice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EmployeeDevice_mac_key" UNIQUE ("mac"),
    CONSTRAINT "EmployeeDevice_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EmployeeDevice_userId_idx" ON "EmployeeDevice"("userId");

CREATE TABLE IF NOT EXISTS "WifiPresence" (
    "mac" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WifiPresence_pkey" PRIMARY KEY ("mac")
);
CREATE INDEX IF NOT EXISTS "WifiPresence_ip_idx" ON "WifiPresence"("ip");

-- Nguồn của lần bấm giờ: gps (nhân viên bấm), manual (admin nhập), wifi (tự động).
ALTER TABLE "AttendancePunch" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'gps';
UPDATE "AttendancePunch" SET "source" = 'manual' WHERE "isManual" AND "source" = 'gps';
