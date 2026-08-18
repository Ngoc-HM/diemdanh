import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/// Đưa database về đúng phiên bản schema mới nhất:
///   1. chưa có database thì tạo
///   2. chạy các file .sql trong db/migrations theo thứ tự tên
///   3. ghi lại file nào đã chạy vào bảng schema_migrations
/// Mỗi file chạy trong một transaction. Chạy lại nhiều lần vẫn an toàn —
/// đã có thì bỏ qua, nên gắn được vào `npm run dev`.

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

/// Postgres không có CREATE DATABASE IF NOT EXISTS, và cũng không cho tạo
/// database từ bên trong chính nó — phải nối vào database "postgres" để tạo.
async function ensureDatabase(connectionString: string): Promise<boolean> {
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name) throw new Error("DATABASE_URL thiếu tên database");

  const probe = new Client({ connectionString });
  try {
    await probe.connect();
    await probe.end();
    return false;
  } catch (error) {
    // 3D000 = database không tồn tại. Lỗi khác (sai mật khẩu, không tới được
    // server) thì ném lên để người chạy thấy đúng nguyên nhân.
    if ((error as { code?: string }).code !== "3D000") throw error;
  }

  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    // Tên database không truyền được qua tham số, phải nội suy — nên chặn
    // ký tự lạ thay vì tin vào chuỗi trong .env.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`Tên database không hợp lệ: ${name}`);
    }
    await admin.query(`CREATE DATABASE "${name}"`);
    console.log(`+ đã tạo database "${name}"`);
    return true;
  } finally {
    await admin.end();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Thiếu DATABASE_URL");

  await ensureDatabase(connectionString);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query<{ name: string }>("SELECT name FROM schema_migrations"))
        .rows.map((row) => row.name)
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`→ ${file} ... `);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
        console.log("xong");
        ran++;
      } catch (error) {
        await client.query("ROLLBACK");
        console.log("LỖI");
        throw error;
      }
    }

    console.log(
      ran === 0
        ? "Schema đã ở phiên bản mới nhất."
        : `Đã chạy ${ran}/${files.length} migration.`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
