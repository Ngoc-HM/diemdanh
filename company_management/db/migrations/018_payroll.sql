-- Phân hệ lương. Số tiền lưu bằng đồng (BIGINT), không lưu số lẻ.

-- Hồ sơ lương của từng nhân viên. Chỉ admin xem / sửa.
CREATE TABLE "PayProfile" (
    "userId" TEXT NOT NULL,
    -- 'monthly' = lương tháng, chia theo ngày công / ngày công tháng;
    -- 'daily' = đơn giá một ngày công.
    "salaryType" TEXT NOT NULL DEFAULT 'monthly',
    "baseSalary" BIGINT NOT NULL DEFAULT 0,
    -- 'collaborator' = CTV, 'probation' = thử việc, 'official' = chính thức.
    "contractType" TEXT NOT NULL DEFAULT 'official',
    -- % lương được hưởng khi thử việc (luật: tối thiểu 85%).
    "probationPercent" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "gender" TEXT,
    "dependents" INTEGER NOT NULL DEFAULT 0,
    -- 'flat10' = khấu trừ thẳng 10%, 'progressive' = luỹ tiến có giảm trừ,
    -- 'none' = không khấu trừ.
    "taxMode" TEXT NOT NULL DEFAULT 'flat10',
    "hasInsurance" BOOLEAN NOT NULL DEFAULT false,
    -- Mức lương đóng bảo hiểm; NULL = lấy lương cơ bản.
    "insuranceSalary" BIGINT,
    -- Có hưởng phép năm không (chỉ người có hợp đồng lao động).
    "annualLeave" BOOLEAN NOT NULL DEFAULT false,
    -- Ngày bắt đầu tính phép / thâm niên, "YYYY-MM-DD"; NULL = ngày vào làm.
    "leaveStartDate" TEXT,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "PayProfile_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "PayProfile_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayProfile_salaryType_check" CHECK ("salaryType" IN ('monthly', 'daily')),
    CONSTRAINT "PayProfile_contractType_check"
        CHECK ("contractType" IN ('collaborator', 'probation', 'official')),
    CONSTRAINT "PayProfile_taxMode_check" CHECK ("taxMode" IN ('flat10', 'progressive', 'none')),
    CONSTRAINT "PayProfile_gender_check" CHECK ("gender" IS NULL OR "gender" IN ('male', 'female')),
    CONSTRAINT "PayProfile_amounts_check" CHECK (
        "baseSalary" >= 0 AND "dependents" >= 0
        AND "probationPercent" > 0 AND "probationPercent" <= 100
        AND ("insuranceSalary" IS NULL OR "insuranceSalary" >= 0)
    )
);

-- Khoản hỗ trợ admin tự tạo (Hỗ trợ AI, gửi xe...).
CREATE TABLE "Allowance" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    -- Số tiền mặc định; người được hưởng có thể có mức riêng.
    "amount" BIGINT NOT NULL DEFAULT 0,
    -- 'monthly' = cố định mỗi tháng; 'prorated' = theo tỉ lệ ngày công /
    -- ngày công tháng; 'per_day' = số tiền × số ngày công.
    "mode" TEXT NOT NULL DEFAULT 'monthly',
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "Allowance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Allowance_mode_check" CHECK ("mode" IN ('monthly', 'prorated', 'per_day')),
    CONSTRAINT "Allowance_amount_check" CHECK ("amount" >= 0)
);
CREATE UNIQUE INDEX "Allowance_name_key" ON "Allowance"(lower("name"));

-- Ai được hưởng khoản nào. amount NULL = theo mức mặc định của khoản.
CREATE TABLE "EmployeeAllowance" (
    "userId" TEXT NOT NULL,
    "allowanceId" TEXT NOT NULL,
    "amount" BIGINT,

    CONSTRAINT "EmployeeAllowance_pkey" PRIMARY KEY ("userId", "allowanceId"),
    CONSTRAINT "EmployeeAllowance_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeAllowance_allowanceId_fkey" FOREIGN KEY ("allowanceId")
        REFERENCES "Allowance"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeAllowance_amount_check" CHECK ("amount" IS NULL OR "amount" >= 0)
);

-- Bảng lương đã chốt: lưu nguyên kết quả tính lúc chốt, để file tải sau này
-- vẫn ra đúng con số đó dù chấm công / hồ sơ lương có đổi.
CREATE TABLE "PayrollClosing" (
    "month" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "closedBy" TEXT,
    "closedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "PayrollClosing_pkey" PRIMARY KEY ("month")
);

-- Mức bảo hiểm, thuế, giảm trừ, phép năm. Admin sửa ở trang Cài đặt lương.
INSERT INTO "Settings" ("id", "key", "value")
VALUES ('cfg_payroll', 'payroll_config', '{}')
ON CONFLICT ("key") DO NOTHING;
