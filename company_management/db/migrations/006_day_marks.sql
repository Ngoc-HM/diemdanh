-- Ca "HC — Hành chính" đổi thành "CN — Cả ngày": trong lưới đăng ký, CN là ca
-- trọn ngày và loại trừ với ca sáng/ca chiều. Tăng ca T xếp xuống dưới cùng.
UPDATE "WorkSession"
   SET "code" = 'CN', "name" = 'Cả ngày', "sortOrder" = 3, "updatedAt" = now()
 WHERE "code" = 'HC';

UPDATE "WorkSession" SET "sortOrder" = 4, "updatedAt" = now() WHERE "code" = 'T';

-- Đánh dấu ngày: N = nhân viên đăng ký nghỉ, O = admin chấm ốm.
-- `sessionIds` chỉ dùng khi admin đổi luôn ca của ngày đó; NULL = giữ ca gốc.
-- `isAdminEdit` là thứ khiến ô hiện màu vàng nhẹ cho cả admin và nhân viên.
CREATE TABLE "DayMark" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "leaveCode" TEXT,
    "sessionIds" TEXT[],
    "isAdminEdit" BOOLEAN NOT NULL DEFAULT false,
    "editedBy" TEXT,
    "editedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "DayMark_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DayMark_leaveCode_check" CHECK ("leaveCode" IN ('N', 'O'))
);

CREATE UNIQUE INDEX "DayMark_userId_date_key" ON "DayMark"("userId", "date");
CREATE INDEX "DayMark_date_idx" ON "DayMark"("date");

ALTER TABLE "DayMark" ADD CONSTRAINT "DayMark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
