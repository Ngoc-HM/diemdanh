import { Pool, PoolClient } from "pg";

/// Một pool dùng chung cho cả tiến trình, gắn vào globalThis: ở chế độ dev
/// Next.js nạp lại module mỗi lần sửa file, không gắn thì mỗi lần hot-reload
/// lại mở thêm một pool và nhanh chóng hết kết nối.
const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Thiếu DATABASE_URL");
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  // Kết nối đang rảnh bị đứt (Postgres restart, mất mạng) thì pool phát sự kiện
  // "error". Không ai nghe thì Node coi là lỗi chưa bắt và tắt cả tiến trình.
  // Pool tự bỏ kết nối hỏng và mở cái mới ở lần query sau, chỉ cần ghi log.
  pool.on("error", (error) => {
    console.error("Postgres idle client error:", error.message);
  });
  return pool;
}

export const pool = globalForDb.pool ?? createPool();
// Middleware (runtime Node) và route handler là hai bundle khác nhau trong cùng
// tiến trình: giữ pool trên globalThis để cả hai dùng chung, không mở hai pool.
globalForDb.pool = pool;

export async function query<T extends object = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool.query<T>(sql, params as never[]);
  return result.rows;
}

export async function queryOne<T extends object = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query(sql, params as never[]);
  return result.rowCount ?? 0;
}

/// Chạy nhiều câu lệnh trong một transaction. Lỗi thì rollback toàn bộ.
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/// Postgres báo trùng khoá bằng mã 23505 — dùng để phân biệt lỗi nghiệp vụ
/// "email đã tồn tại" với lỗi hệ thống.
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}
