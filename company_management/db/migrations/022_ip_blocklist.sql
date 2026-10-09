-- Chặn theo IP (09/10/2026):
-- 1. Blacklist: IP / dải IP do admin thêm bị chặn khỏi toàn bộ web. Tài khoản
--    nhân viên nào dùng IP đó (mang phiên đăng nhập, hoặc đăng nhập đúng mật
--    khẩu) bị khoá ngay.
-- 2. Chỉ nhận chấm công từ mạng văn phòng (dải IP admin khai).

CREATE TABLE "BlockedIp" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    -- Dạng chuẩn hoá: "192.168.1.26" (một IP) hoặc "10.0.0.0/8" (một dải).
    "cidr" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BlockedIp_cidr_key" ON "BlockedIp"("cidr");

-- Khoá tài khoản (khác ngừng hoạt động): nhân viên vẫn còn trong danh sách,
-- chỉ không đăng nhập / dùng được cho tới khi admin mở khoá.
ALTER TABLE "User"
    ADD COLUMN "lockedAt" TIMESTAMPTZ,
    ADD COLUMN "lockReason" TEXT;

-- Mọi lần chấm công trên prod tới 09/10/2026 đều từ 192.168.1.x (Wi-Fi văn
-- phòng); máy vào qua Tailscale hiện IP gateway Docker nên bị chặn chấm công.
INSERT INTO "Settings" ("id", "key", "value")
VALUES ('cfg_punch_network', 'punch_network', '{"enabled":true,"ranges":["192.168.1.0/24"]}')
ON CONFLICT ("key") DO NOTHING;
