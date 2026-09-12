-- Chặn dò mật khẩu ở trang đăng nhập: đếm số lần sai theo từng tài khoản,
-- quá ngưỡng thì khoá tạm. Ghi cả những email không có trong hệ thống để
-- người dò không suy ra được email nào có tài khoản.
CREATE TABLE "LoginAttempt" (
    -- Email nhân viên đã chuẩn hoá, hoặc "admin:<tên đăng nhập>".
    "identifier" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "firstFailedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "lockedUntil" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("identifier")
);
