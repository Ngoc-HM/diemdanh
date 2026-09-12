import "dotenv/config";
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { DEFAULT_LUNCH_BREAK, DEFAULT_WORK_SESSIONS } from "../lib/validation";
import {
  DEFAULT_REGISTRATION_WINDOW,
  formatRegistrationWindow,
} from "../lib/schedule";

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
             ("code", "name", "workStart", "workEnd",
              "minHours", "sortOrder", "isDefaultFull")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            preset.code,
            preset.name,
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

    // Giờ nghỉ trưa chung: admin đổi hoặc tắt ở /admin/sessions. Đã có dòng
    // (kể cả khi admin đã tắt, giá trị rỗng) thì không đụng vào.
    const lunch = await client.query(
      `INSERT INTO "Settings" ("key", "value") VALUES ('lunch_break', $1)
       ON CONFLICT ("key") DO NOTHING RETURNING "key"`,
      [DEFAULT_LUNCH_BREAK]
    );
    if (lunch.rowCount) created.push("giờ nghỉ trưa mặc định 12:00–13:30");

    // Cửa sổ đăng ký lịch tháng sau: admin đổi ở /admin/schedules. Đã có dòng
    // thì không đụng vào.
    const registrationWindow = await client.query(
      `INSERT INTO "Settings" ("key", "value")
       VALUES ('schedule_registration_window', $1)
       ON CONFLICT ("key") DO NOTHING RETURNING "key"`,
      [formatRegistrationWindow(DEFAULT_REGISTRATION_WINDOW)]
    );
    if (registrationWindow.rowCount) {
      created.push("cửa sổ đăng ký lịch mặc định 20 → hết tháng");
    }

    // Tài khoản quản trị đầu tiên lấy thẳng từ .env, lưu dạng bcrypt.
    // Đã có admin rồi thì không đụng vào — tránh ghi đè mật khẩu người dùng
    // đã tự đổi trong giao diện.
    // Không có mật khẩu mặc định: một lần chạy seed thiếu .env là đủ để tạo
    // tài khoản quản trị yếu trên database thật.
    const username = process.env.AUTH_ADMIN_USERNAME || "admin";
    const password = process.env.AUTH_ADMIN_PASSWORD;
    if (!password) {
      throw new Error(
        "Thiếu AUTH_ADMIN_PASSWORD trong .env — không tạo được tài khoản quản trị."
      );
    }
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
