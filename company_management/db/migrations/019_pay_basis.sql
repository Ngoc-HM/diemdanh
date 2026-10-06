-- Lương thoả thuận là GROSS (trước thuế, BH — người lao động tự chịu khoản trừ)
-- hay NET (số cầm về — công ty chịu thuế và BH phần người lao động, hệ thống
-- quy ngược ra gross).
ALTER TABLE "PayProfile"
    ADD COLUMN "payBasis" TEXT NOT NULL DEFAULT 'gross';

ALTER TABLE "PayProfile"
    ADD CONSTRAINT "PayProfile_payBasis_check" CHECK ("payBasis" IN ('gross', 'net'));
