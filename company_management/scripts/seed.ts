import "dotenv/config";
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { DEFAULT_WORK_SESSIONS } from "../lib/validation";

/// Tạo dữ liệu tối thiểu để đăng nhập và cấu hình được: bộ ca mặc định,
/// tên công ty, tài khoản quản trị lấy từ .env.
/// Cái gì đã có thì bỏ qua, nên chạy lại bao nhiêu lần cũng không đổi gì.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Thiếu DATABASE_URL");

  const client = new Client({ connectionString });
  await client.connect();
  const created: string[] = [];

  try {
    const sessions = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "WorkSession"`
    );
    if (sessions.rows[0].n === 0) {
      for (const preset of DEFAULT_WORK_SESSIONS) {
        await client.query(
          `INSERT INTO "WorkSession"
             ("code", "name", "checkInStart", "checkInEnd", "workStart", "workEnd",
              "minHours", "sortOrder", "isDefaultFull")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            preset.code,
            preset.name,
            preset.checkInStart,
            preset.checkInEnd,
            preset.workStart,
            preset.workEnd,
            preset.minHours,
            preset.sortOrder,
            preset.isDefaultFull,
          ]
        );
      }
      created.push(`${DEFAULT_WORK_SESSIONS.length} ca làm việc mặc định`);
    }

    const settings = await client.query(
      `INSERT INTO "Settings" ("key", "value") VALUES ('company_name', $1)
       ON CONFLICT ("key") DO NOTHING RETURNING "key"`,
      ["Công ty của bạn"]
    );
    if (settings.rowCount) created.push("tên công ty mặc định");

    // Tài khoản quản trị đầu tiên lấy thẳng từ .env, lưu dạng bcrypt.
    // Đã có admin rồi thì không đụng vào — tránh ghi đè mật khẩu người dùng
    // đã tự đổi trong giao diện.
    const username = process.env.AUTH_ADMIN_USERNAME || "admin";
    const password = process.env.AUTH_ADMIN_PASSWORD || "admin123";
    const admin = await client.query(
      `INSERT INTO "Admin" ("username", "password") VALUES ($1, $2)
       ON CONFLICT ("username") DO NOTHING RETURNING "username"`,
      [username, await bcrypt.hash(password, 10)]
    );
    if (admin.rowCount) created.push(`tài khoản quản trị "${username}"`);

    const locations = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "WorkLocation"`
    );

    if (created.length > 0) {
      console.log("Đã tạo: " + created.join(", "));
    } else {
      console.log("Dữ liệu khởi tạo đã có sẵn.");
    }

    if (locations.rows[0].n === 0) {
      console.log(
        "Lưu ý: chưa có vị trí làm việc nào — nhân viên chưa chấm công được. Thêm ở /admin/locations."
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
