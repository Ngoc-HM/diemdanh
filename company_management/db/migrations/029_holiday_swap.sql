-- Hoán đổi ngày làm việc đi kèm một đợt lễ. Vd lễ rơi vào T3: công ty cho
-- nghỉ luôn T2 ("swapOffDate", vốn là ngày làm) và đi làm bù một T7
-- ("swapWorkDate", vốn là ngày nghỉ tuần). Cả hai cùng NULL = không hoán đổi.
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "swapOffDate" TEXT,
                      ADD COLUMN IF NOT EXISTS "swapWorkDate" TEXT;
ALTER TABLE "Holiday" DROP CONSTRAINT IF EXISTS "Holiday_swap_pair_check";
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_swap_pair_check"
    CHECK (("swapOffDate" IS NULL) = ("swapWorkDate" IS NULL));
