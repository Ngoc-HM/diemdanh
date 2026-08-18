-- Prisma dùng cột `timestamp without time zone` và tự quy đổi UTC ở tầng ứng dụng.
-- Driver `pg` thì đọc cột này theo múi giờ của tiến trình Node, nên cùng một dòng
-- dữ liệu sẽ ra hai mốc thời gian khác nhau tuỳ máy chạy — sai 7 tiếng với máy VN.
--
-- Đổi sang `timestamptz` để mốc thời gian là tuyệt đối, không phụ thuộc múi giờ
-- của server hay của client. Giá trị cũ do Prisma ghi là UTC nên diễn giải AT TIME
-- ZONE 'UTC' giữ đúng thời điểm ban đầu.

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND data_type = 'timestamp without time zone'
     ORDER BY table_name, column_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
      target.table_name,
      target.column_name,
      target.column_name
    );
  END LOOP;
END $$;
