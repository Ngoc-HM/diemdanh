-- Ghi lại những lần truy cập đường dẫn không tồn tại hoặc không đủ quyền.
-- Trang cảnh báo nói với nhân viên là "đã được ghi lại", nên phải ghi thật:
-- doạ suông thì lần đầu có người hỏi admin là lộ.
CREATE TABLE "AccessViolation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    -- NULL = khách chưa đăng nhập (chỉ ghi khi có phiên, xem route).
    "userId" TEXT,
    -- Chép lại tên và vai trò tại thời điểm đó, để xoá nhân viên vẫn còn dấu vết.
    "actorName" TEXT,
    "actorRole" TEXT,
    "path" TEXT NOT NULL,
    -- 'not_found' = đường dẫn không tồn tại, 'forbidden' = sai quyền.
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "AccessViolation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccessViolation_kind_check" CHECK ("kind" IN ('not_found', 'forbidden'))
);

CREATE INDEX "AccessViolation_createdAt_idx" ON "AccessViolation"("createdAt" DESC);

ALTER TABLE "AccessViolation" ADD CONSTRAINT "AccessViolation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
