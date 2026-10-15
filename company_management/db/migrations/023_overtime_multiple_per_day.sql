-- Một người một ngày được nhiều phiếu OT (vd thứ 7 phiếu sáng + phiếu chiều).
-- Mỗi phiếu tính giờ chấm công nằm trong khoảng giờ của nó; API chặn khoảng
-- giờ trùng nhau trong cùng ngày.
DROP INDEX IF EXISTS "OvertimeRequest_active_key";
CREATE INDEX IF NOT EXISTS "OvertimeRequest_user_date_idx"
    ON "OvertimeRequest"("userId", "date");
