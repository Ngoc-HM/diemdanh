import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_USER = "__smoketest_admin";
const ADMIN_PASS = "SmokeTest12345";
const EMP_EMAIL = "__smoketest_employee@example.test";
const EMP_PASS = "SmokeTest12345";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    failures.push(`${name} ${detail}`);
    console.log(`  FAIL ${name} ${detail}`);
  }
}

function makeJar() {
  const jar = new Map();
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const idx = pair.indexOf("=");
        jar.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
  };
}

async function call(jar, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(jar.header() ? { Cookie: jar.header() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  jar.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function main() {
  await client.connect();

  // ---- dựng tài khoản admin tạm ----
  await client.query(`DELETE FROM "Admin" WHERE "username" = $1`, [ADMIN_USER]);
  await client.query(
    `INSERT INTO "Admin" ("username", "password") VALUES ($1, $2)`,
    [ADMIN_USER, await bcrypt.hash(ADMIN_PASS, 10)]
  );
  await client.query(`DELETE FROM "User" WHERE "email" = $1`, [EMP_EMAIL]);

  const admin = makeJar();
  const emp = makeJar();
  let employeeId = null;
  let holidayId = null;
  let locationId = null;

  try {
    console.log("\n== xác thực ==");
    let r = await call(admin, "POST", "/api/auth/admin-login", {
      username: ADMIN_USER,
      password: "sai-mat-khau",
    });
    check("từ chối mật khẩu sai", r.status === 401, `(${r.status})`);

    r = await call(admin, "POST", "/api/auth/admin-login", {
      username: ADMIN_USER,
      password: ADMIN_PASS,
    });
    check("admin đăng nhập", r.status === 200 && r.json.success, `(${r.status})`);

    r = await call(admin, "GET", "/api/auth/session");
    check("session trả về vai trò admin", r.json?.user?.role === "admin");

    console.log("\n== ca làm việc ==");
    r = await call(admin, "GET", "/api/admin/work-sessions");
    const sessions = r.json.sessions ?? [];
    check("liệt kê ca", r.status === 200 && sessions.length > 0, `(${sessions.length} ca)`);
    const defaultFull = sessions.filter((s) => s.isDefaultFull);
    check("có nhiều nhất 1 ca mặc định full-time", defaultFull.length <= 1);

    console.log("\n== vị trí ==");
    r = await call(admin, "POST", "/api/locations", {
      name: "__smoketest_loc",
      latitude: 21.0,
      longitude: 105.8,
      radius: 200,
    });
    locationId = r.json.location?.id;
    check("tạo vị trí", r.status === 200 && locationId, `(${r.status})`);

    r = await call(admin, "POST", "/api/locations", {
      name: "sai toạ độ",
      latitude: 999,
      longitude: 105.8,
      radius: 200,
    });
    check("chặn vĩ độ ngoài khoảng", r.status === 400, `(${r.status})`);

    console.log("\n== nhân viên ==");
    r = await call(admin, "POST", "/api/users", {
      name: "Nhân viên smoke test",
      email: EMP_EMAIL,
      password: EMP_PASS,
      employmentType: "part_time",
      employeeCode: "__ST001",
      department: "QA",
      phone: "0900000000",
    });
    employeeId = r.json.user?.id;
    check("tạo nhân viên part-time", r.status === 200 && employeeId, JSON.stringify(r.json).slice(0, 120));

    r = await call(admin, "POST", "/api/users", {
      name: "Trùng email",
      email: EMP_EMAIL,
      password: EMP_PASS,
      employmentType: "intern",
    });
    check("chặn email trùng", r.status === 409, `(${r.status})`);

    r = await call(admin, "POST", "/api/users", {
      name: "Sai loại hợp đồng",
      email: "__st2@example.test",
      password: EMP_PASS,
      employmentType: "khong_ton_tai",
    });
    check("chặn loại hợp đồng lạ", r.status === 400, `(${r.status})`);

    r = await call(admin, "GET", "/api/users");
    check(
      "nhân viên mới có trong danh sách",
      r.json.users?.some((u) => u.id === employeeId)
    );

    r = await call(admin, "PUT", `/api/users/${employeeId}`, {
      name: "Nhân viên smoke test đã sửa",
      email: EMP_EMAIL,
      employmentType: "part_time",
      department: "QA2",
      isActive: true,
    });
    check("sửa hồ sơ nhân viên", r.status === 200 && r.json.user?.department === "QA2");

    console.log("\n== ngày lễ ==");
    r = await call(admin, "POST", "/api/holidays", {
      date: "2026-09-02",
      name: "__smoketest Quốc khánh",
    });
    holidayId = r.json.holiday?.id;
    check("tạo ngày lễ", r.status === 200 && holidayId, `(${r.status})`);

    r = await call(admin, "POST", "/api/holidays", {
      date: "2026-09-02",
      name: "trùng",
    });
    check("chặn ngày lễ trùng", r.status === 409, `(${r.status})`);

    r = await call(admin, "POST", "/api/holidays", { date: "2026-02-31", name: "x" });
    check("chặn ngày không tồn tại (31/02)", r.status === 400, `(${r.status})`);

    console.log("\n== lịch làm việc (admin xếp) ==");
    const morning = sessions.find((s) => !s.isDefaultFull) ?? sessions[0];
    const afternoon = sessions.filter((s) => s.id !== morning.id)[0] ?? morning;
    r = await call(admin, "PUT", "/api/admin/schedules", {
      userId: employeeId,
      month: "2026-09",
      days: {
        "2026-09-01": [morning.id, afternoon.id],
        "2026-09-03": [morning.id],
      },
    });
    check("admin xếp lịch tháng 9", r.status === 200 && r.json.savedDays === 3, JSON.stringify(r.json).slice(0, 120));

    r = await call(admin, "PUT", "/api/admin/schedules", {
      userId: employeeId,
      month: "2026-09",
      days: { "2026-10-01": [morning.id] },
    });
    check("chặn ngày ngoài tháng", r.status === 400, `(${r.status})`);

    r = await call(admin, "GET", "/api/admin/schedules?month=2026-09");
    const row = r.json.rows?.find((x) => x.user.id === employeeId);
    check("lưới lịch hiện đúng ca", row?.totalShifts === 3, `(${row?.totalShifts})`);
    check("đánh dấu nhân viên tự đăng ký", row?.selfScheduled === true);
    const fullTimeRow = r.json.rows?.find((x) => !x.selfScheduled);
    check(
      "full-time được sinh lịch T2–T6 tự động",
      fullTimeRow ? fullTimeRow.totalShifts === 22 : true,
      `(tháng 9/2026 có 22 ngày T2-T6, thực tế ${fullTimeRow?.totalShifts})`
    );

    console.log("\n== nhân viên đăng nhập ==");
    r = await call(emp, "POST", "/api/auth/login", {
      email: EMP_EMAIL,
      password: "sai",
    });
    check("từ chối mật khẩu nhân viên sai", r.status === 401, `(${r.status})`);

    r = await call(emp, "POST", "/api/auth/login", {
      email: EMP_EMAIL,
      password: EMP_PASS,
    });
    check("nhân viên đăng nhập", r.status === 200, `(${r.status})`);

    r = await call(emp, "GET", "/api/schedule?month=2026-09");
    check("nhân viên xem được lịch đã xếp", Object.keys(r.json.days ?? {}).length === 2);
    check("ngoài hạn thì không cho sửa", r.json.canEdit === false, `(canEdit=${r.json.canEdit})`);

    r = await call(emp, "PUT", "/api/schedule", {
      month: "2026-09",
      days: { "2026-09-05": [morning.id] },
    });
    check("chặn đăng ký ngoài cửa sổ", r.status === 400, `(${r.status})`);

    console.log("\n== phân quyền ==");
    r = await call(emp, "GET", "/api/users");
    check("nhân viên không xem được danh sách NV", r.status === 401, `(${r.status})`);
    r = await call(emp, "PUT", "/api/settings/company", { value: "hack" });
    check("nhân viên không đổi được tên công ty", r.status === 401, `(${r.status})`);
    const anon = makeJar();
    r = await call(anon, "GET", "/api/locations/active");
    check("khách vãng lai không xem được toạ độ", r.status === 401, `(${r.status})`);
    r = await call(anon, "PUT", "/api/settings/company", { value: "hack" });
    check("khách vãng lai không đổi được tên công ty", r.status === 401, `(${r.status})`);

    console.log("\n== chấm công ==");
    r = await call(emp, "POST", "/api/attendance/punch", {
      type: "out",
      latitude: 21.0,
      longitude: 105.8,
    });
    check("không cho check-out khi chưa check-in", r.status === 400, `(${r.status})`);

    r = await call(emp, "POST", "/api/attendance/punch", {
      type: "in",
      latitude: 10.0,
      longitude: 106.0,
    });
    check("chặn chấm công ngoài bán kính", r.status === 400, `(${r.status})`);
    check(
      "báo lỗi có kèm khoảng cách",
      /km|m,/.test(r.json.error ?? ""),
      `("${(r.json.error ?? "").slice(0, 60)}")`
    );

    r = await call(emp, "POST", "/api/attendance/punch", {
      type: "in",
      latitude: 21.0,
      longitude: 105.8,
    });
    check("check-in trong bán kính", r.status === 200, JSON.stringify(r.json).slice(0, 120));

    r = await call(emp, "POST", "/api/attendance/punch", {
      type: "in",
      latitude: 21.0,
      longitude: 105.8,
    });
    check("không cho check-in hai lần liên tiếp", r.status === 400, `(${r.status})`);

    r = await call(emp, "POST", "/api/attendance/punch", {
      type: "out",
      latitude: 21.0,
      longitude: 105.8,
    });
    check("check-out", r.status === 200, `(${r.status})`);

    r = await call(emp, "GET", "/api/attendance");
    check("ca đã đóng nên openShift = null", r.json.openShift === null);
    check("hôm nay có 2 lần bấm giờ", r.json.todayEntry?.punches?.length === 2, `(${r.json.todayEntry?.punches?.length})`);

    console.log("\n== sửa công thủ công ==");
    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, {
      date: "2026-09-01",
      punches: [
        { type: "in", time: "08:00" },
        { type: "out", time: "12:00" },
        { type: "in", time: "13:00" },
        { type: "out", time: "17:00" },
      ],
      note: "__smoketest bổ sung công",
    });
    check("nhập tay 2 ca trong ngày", r.status === 200 && r.json.punches === 4, JSON.stringify(r.json).slice(0, 120));

    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, {
      date: "2026-09-01",
      punches: [{ type: "in", time: "08:00" }],
    });
    check("chặn số lần vào/ra lệch nhau", r.status === 400, `(${r.status})`);

    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, {
      date: "2026-09-01",
      punches: [
        { type: "out", time: "08:00" },
        { type: "in", time: "12:00" },
      ],
    });
    check("chặn thứ tự vào/ra sai", r.status === 400, `(${r.status})`);

    r = await call(admin, "GET", `/api/admin/attendance/user/${employeeId}?month=2026-09`);
    const day1 = r.json.days?.find((d) => d.date === "2026-09-01");
    check("giờ công = 8h, không tính giờ nghỉ trưa", day1?.workedHours === 8, `(${day1?.workedHours}h)`);
    check("giờ hiển thị đúng múi giờ VN", day1?.punches?.[0]?.time === "08:00", `(${day1?.punches?.[0]?.time})`);
    check("ngày đủ công", day1?.status === "passed", `(${day1?.status})`);
    const holiday = r.json.days?.find((d) => d.date === "2026-09-02");
    check("ngày lễ không bị tính vắng", holiday?.status === "holiday", `(${holiday?.status})`);
    const noSchedule = r.json.days?.find((d) => d.date === "2026-09-10");
    check("ngày không lịch, không chấm công = off", noSchedule?.status === "off", `(${noSchedule?.status})`);
    const day3 = r.json.days?.find((d) => d.date === "2026-09-03");
    check("có lịch mà không chấm công = vắng", day3?.status === "absent", `(${day3?.status})`);

    console.log("\n== báo cáo tháng ==");
    r = await call(admin, "GET", "/api/admin/attendance/monthly?month=2026-09");
    const summary = r.json.summary?.find((s) => s.user.id === employeeId);
    check("bảng tháng có nhân viên", Boolean(summary));
    check("đếm đúng 1 ngày công", summary?.passedDays === 1, `(${summary?.passedDays})`);
    check("đếm đúng 1 ngày vắng", summary?.absentDays === 1, `(${summary?.absentDays})`);
    check("tổng giờ = 8h", summary?.totalHours === 8, `(${summary?.totalHours})`);

    const csv = await fetch(
      BASE + "/api/admin/attendance/monthly?month=2026-09&export=csv",
      { headers: { Cookie: admin.header() } }
    );
    const csvText = await csv.text();
    check("xuất CSV", csv.status === 200 && csvText.includes("Nhân viên"), `(${csv.status})`);

    r = await call(admin, "GET", "/api/admin/attendance/monthly?month=2026-13");
    check("chặn tháng không hợp lệ", r.status === 400, `(${r.status})`);

    console.log("\n== xoá ==");
    r = await call(admin, "DELETE", `/api/holidays/${holidayId}`);
    check("xoá ngày lễ", r.status === 200);
    holidayId = null;

    r = await call(admin, "DELETE", `/api/users/${employeeId}?hard=true`);
    check("không xoá cứng được NV đã có công", r.status === 409, `(${r.status})`);

    r = await call(admin, "DELETE", `/api/users/${employeeId}`);
    check("ngừng hoạt động nhân viên", r.status === 200 && r.json.deleted === false);

    r = await call(emp, "POST", "/api/auth/login", {
      email: EMP_EMAIL,
      password: EMP_PASS,
    });
    check("NV đã ngừng không đăng nhập được", r.status === 403, `(${r.status})`);

    r = await call(admin, "DELETE", `/api/locations/${locationId}`);
    check("xoá vị trí", r.status === 200);
    locationId = null;
  } finally {
    console.log("\n== dọn dẹp ==");
    if (employeeId) {
      await client.query(`DELETE FROM "User" WHERE "id" = $1`, [employeeId]);
    }
    await client.query(`DELETE FROM "User" WHERE "email" LIKE '__smoketest%'`);
    await client.query(`DELETE FROM "Holiday" WHERE "name" LIKE '__smoketest%'`);
    await client.query(`DELETE FROM "WorkLocation" WHERE "name" LIKE '__smoketest%'`);
    await client.query(`DELETE FROM "Admin" WHERE "username" = $1`, [ADMIN_USER]);
    const left = await client.query(
      `SELECT (SELECT count(*) FROM "User" WHERE "email" LIKE '__smoketest%')
            + (SELECT count(*) FROM "Admin" WHERE "username" LIKE '__smoketest%')
            + (SELECT count(*) FROM "Holiday" WHERE "name" LIKE '__smoketest%')
            + (SELECT count(*) FROM "WorkLocation" WHERE "name" LIKE '__smoketest%') AS n`
    );
    console.log("  dữ liệu test còn sót:", left.rows[0].n);
    await client.end();
  }

  console.log(`\n===== ${pass} đạt / ${fail} hỏng =====`);
  if (failures.length) {
    console.log("Hỏng:");
    failures.forEach((f) => console.log(" -", f));
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("LỖI SMOKE TEST:", error);
  process.exit(1);
});
