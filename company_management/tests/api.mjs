import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import net from "node:net";
import { totp } from "../lib/totp.ts";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_USER = "__smoketest_admin@example.test";
const ADMIN_PASS = "SmokeTest12345";
const EMP_EMAIL = "__smoketest_employee@example.test";
const EMP_PASS = "SmokeTest12345";

// Ngày "có lịch mà không chấm công" phải khác hôm nay, vì phần chấm công ở
// dưới bấm giờ vào đúng ngày hôm nay và sẽ biến ngày đó thành thiếu giờ.
const TODAY_VN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const ABSENT_DATE = ["2026-09-03", "2026-09-04", "2026-09-07"].find((d) => d !== TODAY_VN);

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

/// Máy chủ SMTP giả chạy ngay trong test: app gửi email thông báo vào đây,
/// không đụng máy chủ mail thật. Chỉ đủ lệnh cho nodemailer (không STARTTLS).
function startSmtpSink() {
  const messages = [];
  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    let inData = false;
    let current = { to: [], raw: "" };
    socket.on("error", () => {});
    socket.write("220 smoketest ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk;
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          current.raw = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          messages.push(decodeMail(current));
          current = { to: [], raw: "" };
          socket.write("250 OK\r\n");
          continue;
        }
        const eol = buffer.indexOf("\r\n");
        if (eol === -1) return;
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        const command = line.slice(0, 4).toUpperCase();
        if (command === "RCPT") current.to.push(line.match(/<([^>]*)>/)?.[1] ?? "");
        if (command === "DATA") {
          inData = true;
          socket.write("354 go ahead\r\n");
        } else if (command === "QUIT") {
          socket.end("221 bye\r\n");
        } else {
          socket.write(command === "EHLO" || command === "HELO" ? "250 smoketest\r\n" : "250 OK\r\n");
        }
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, messages }))
  );
}

function qpBytes(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const hex = text.slice(i + 1, i + 3);
    if (text[i] === "=" && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(text.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

/// Giải mã tiêu đề (encoded-word) và thân thư (quoted-printable / base64).
function decodeMail({ to, raw }) {
  const split = raw.indexOf("\r\n\r\n");
  const headers = raw.slice(0, split).replace(/\r\n[ \t]+/g, " ");
  const body = raw.slice(split + 4);
  const header = (name) => headers.match(new RegExp(`^${name}:\\s*(.*)$`, "im"))?.[1] ?? "";
  const subject = header("Subject").replace(/=\?UTF-8\?([BQ])\?([^?]*)\?=\s*/gi, (_, enc, text) =>
    enc.toUpperCase() === "B" ? Buffer.from(text, "base64").toString("utf8") : qpBytes(text.replace(/_/g, " "))
  );
  const encoding = header("Content-Transfer-Encoding").toLowerCase();
  const text =
    encoding === "base64"
      ? Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8")
      : encoding === "quoted-printable"
        ? qpBytes(body.replace(/=\r\n/g, ""))
        : body;
  return { to, subject, text: text.replace(/\r\n/g, "\n") };
}

function mailsTo(sink, to, subjectPart) {
  return sink.messages.filter((mail) => mail.to.includes(to) && mail.subject.includes(subjectPart));
}

/// Chờ email thông báo (app gửi nền nên tới sau response vài trăm ms).
async function waitForMail(sink, to, subjectPart, timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = mailsTo(sink, to, subjectPart);
    if (found.length > 0) return found[found.length - 1];
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
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
  // Giờ nghỉ trưa của DB trước khi test đổi; null = chưa kịp đọc.
  let previousLunch = null;
  // Cửa sổ đăng ký lịch trước khi test đổi; null = chưa kịp đọc.
  let previousWindow = null;
  // Cấu hình SMTP trước khi test trỏ sang máy chủ giả; null = chưa kịp đọc.
  let previousEmail = null;
  let sink = null;

  try {
    console.log("\n== xác thực ==");
    // Admin và nhân viên đăng nhập chung /api/auth/login bằng email.
    let r = await call(admin, "POST", "/api/auth/login", {
      identifier: ADMIN_USER,
      password: "sai-mat-khau",
    });
    check("từ chối mật khẩu sai", r.status === 401, `(${r.status})`);
    const wrongAdmin = r.json.error;

    r = await call(makeJar(), "POST", "/api/auth/login", {
      identifier: "__smoketest_khong_co@example.test",
      password: "sai-mat-khau",
    });
    check("sai admin hay email lạ đều cùng một câu", r.json.error === wrongAdmin, `("${r.json.error}" / "${wrongAdmin}")`);

    r = await call(admin, "POST", "/api/auth/login", {
      identifier: ADMIN_USER.toUpperCase(),
      password: ADMIN_PASS,
    });
    check("admin đăng nhập (không phân biệt hoa thường)", r.status === 200 && r.json.success, `(${r.status})`);
    check("admin được đưa vào khu quản trị", r.json.role === "admin" && r.json.redirect?.startsWith("/admin"), `(${r.json.role} ${r.json.redirect})`);

    r = await call(admin, "GET", "/api/auth/session");
    check("session trả về vai trò admin", r.json?.user?.role === "admin");

    console.log("\n== cấu hình email ==");
    r = await call(admin, "GET", "/api/admin/email-settings");
    check("đọc cấu hình email", r.status === 200 && typeof r.json.config?.hasPassword === "boolean", `(${r.status})`);
    check("không trả mật khẩu SMTP về client", r.json.config && !("password" in r.json.config));
    r = await call(admin, "PUT", "/api/admin/email-settings", { host: "", port: 587, from: "a@b.c" });
    check("chặn thiếu máy chủ SMTP", r.status === 400, `(${r.status})`);
    r = await call(admin, "PUT", "/api/admin/email-settings", { host: "smtp.example.test", port: 99999, from: "a@b.c" });
    check("chặn cổng sai", r.status === 400, `(${r.status})`);
    r = await call(emp, "POST", "/api/auth/forgot-password", { email: "khong-phai-email" });
    check("quên mật khẩu: chặn email sai định dạng", r.status === 400, `(${r.status})`);
    r = await call(emp, "POST", "/api/auth/reset-password", { email: "khong-co@example.test", code: "12345678", password: "MatKhau123" });
    check("đặt lại mật khẩu: chặn mã của email lạ", r.status === 400, `(${r.status})`);
    r = await call(emp, "POST", "/api/auth/reset-password", { email: "a@b.c", code: "123", password: "MatKhau123" });
    check("đặt lại mật khẩu: chặn mã không đủ 8 số", r.status === 400, `(${r.status})`);

    console.log("\n== ca làm việc ==");
    r = await call(admin, "GET", "/api/admin/work-sessions");
    const sessions = r.json.sessions ?? [];
    check("liệt kê ca", r.status === 200 && sessions.length > 0, `(${sessions.length} ca)`);
    const defaultFull = sessions.filter((s) => s.isDefaultFull);
    check("có nhiều nhất 1 ca mặc định full-time", defaultFull.length <= 1);
    check("không còn cột khung giờ check-in", !("checkInStart" in sessions[0]));
    check("ca nào cũng có số công", sessions.every((s) => typeof s.workdayValue === "number"));
    r = await call(admin, "POST", "/api/admin/work-sessions", {
      code: "ZZ", name: "__smoketest ca lạ", workStart: "08:00", workEnd: "12:00",
      minHours: 3, workdayValue: 1.5,
    });
    check("chặn số công ngoài 0–1", r.status === 400, `(${r.status})`);

    console.log("\n== giờ nghỉ trưa ==");
    previousLunch = {
      value: (await client.query(`SELECT "value" FROM "Settings" WHERE "key" = 'lunch_break'`)).rows[0]?.value,
    };
    r = await call(admin, "GET", "/api/settings/lunch-break");
    check("đọc giờ nghỉ trưa", r.status === 200 && "start" in r.json, `(${r.status})`);
    r = await call(admin, "PUT", "/api/settings/lunch-break", { start: "13:00", end: "12:00" });
    check("chặn nghỉ trưa kết thúc trước khi bắt đầu", r.status === 400, `(${r.status})`);
    r = await call(admin, "PUT", "/api/settings/lunch-break", { start: "12h", end: "13:00" });
    check("chặn giờ sai dạng", r.status === 400, `(${r.status})`);
    r = await call(admin, "PUT", "/api/settings/lunch-break", { start: "", end: "" });
    check("tắt nghỉ trưa", r.status === 200 && r.json.start === null, JSON.stringify(r.json));
    r = await call(admin, "PUT", "/api/settings/lunch-break", { start: "12:00", end: "13:00" });
    check("đặt nghỉ trưa 12:00–13:00", r.status === 200 && r.json.start === "12:00" && r.json.end === "13:00", JSON.stringify(r.json));
    r = await call(admin, "GET", "/api/settings/lunch-break");
    check("đọc lại đúng giá trị vừa lưu", r.json.start === "12:00" && r.json.end === "13:00", JSON.stringify(r.json));
    r = await call(makeJar(), "PUT", "/api/settings/lunch-break", { start: "", end: "" });
    check("khách vãng lai không đổi được giờ nghỉ trưa", r.status === 401, `(${r.status})`);

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
      name: "Trùng email admin",
      email: ADMIN_USER,
      password: EMP_PASS,
      employmentType: "intern",
    });
    check("chặn tạo nhân viên trùng email admin", r.status === 409, `(${r.status})`);

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

    console.log("\n== lịch full-time (admin xếp riêng) ==");
    const profile = {
      name: "Nhân viên smoke test đã sửa",
      email: EMP_EMAIL,
      department: "QA2",
      isActive: true,
    };
    r = await call(admin, "PUT", `/api/users/${employeeId}`, { ...profile, employmentType: "full_time" });
    check("đổi tạm sang full-time", r.status === 200, `(${r.status})`);

    r = await call(admin, "GET", "/api/admin/schedules?month=2026-09");
    let ftRow = r.json.rows?.find((x) => x.user.id === employeeId);
    check(
      "full-time chưa xếp riêng thì dùng lịch cố định",
      ftRow?.selfScheduled === false && ftRow?.registered === false && ftRow?.totalShifts > 0,
      `(registered=${ftRow?.registered}, ${ftRow?.totalShifts} ca)`
    );

    const ftSession = sessions.find((s) => !s.isDefaultFull) ?? sessions[0];
    r = await call(admin, "PUT", "/api/admin/schedules", {
      userId: employeeId,
      month: "2026-09",
      days: { "2026-09-01": [ftSession.id] },
    });
    check("admin xếp riêng được lịch cho full-time", r.status === 200 && r.json.savedDays === 1, JSON.stringify(r.json).slice(0, 120));

    r = await call(admin, "GET", "/api/admin/schedules?month=2026-09");
    ftRow = r.json.rows?.find((x) => x.user.id === employeeId);
    check(
      "tháng đã xếp riêng dùng đúng lịch admin xếp",
      ftRow?.registered === true && ftRow?.totalShifts === 1,
      `(registered=${ftRow?.registered}, ${ftRow?.totalShifts} ca)`
    );

    r = await call(admin, "PUT", `/api/users/${employeeId}`, { ...profile, employmentType: "part_time" });
    check("đổi lại part-time", r.status === 200, `(${r.status})`);

    console.log("\n== lịch làm việc (admin xếp) ==");
    const morning = sessions.find((s) => !s.isDefaultFull) ?? sessions[0];
    const afternoon = sessions.filter((s) => s.id !== morning.id)[0] ?? morning;
    r = await call(admin, "PUT", "/api/admin/schedules", {
      userId: employeeId,
      month: "2026-09",
      days: {
        "2026-09-01": [morning.id, afternoon.id],
        [ABSENT_DATE]: [morning.id],
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
    check("nhân viên được đưa vào /dashboard", r.json.role === "employee" && r.json.redirect === "/dashboard", `(${r.json.role} ${r.json.redirect})`);

    r = await call(emp, "GET", "/api/schedule?month=2026-09");
    check("nhân viên xem được lịch đã xếp", Object.keys(r.json.days ?? {}).length === 2);
    check("ngoài hạn thì không cho sửa", r.json.canEdit === false, `(canEdit=${r.json.canEdit})`);

    r = await call(emp, "PUT", "/api/schedule", {
      month: "2026-09",
      days: { "2026-09-05": [morning.id] },
    });
    check("chặn đăng ký ngoài cửa sổ", r.status === 400, `(${r.status})`);

    console.log("\n== cửa sổ đăng ký lịch (admin đặt) ==");
    previousWindow = {
      value: (
        await client.query(
          `SELECT "value" FROM "Settings" WHERE "key" = 'schedule_registration_window'`
        )
      ).rows[0]?.value,
    };

    r = await call(admin, "GET", "/api/settings/schedule-window");
    check(
      "admin đọc được cửa sổ đăng ký",
      r.status === 200 && Number.isInteger(r.json.openDay) && Number.isInteger(r.json.closeDay),
      `(${r.status} ${JSON.stringify(r.json)})`
    );
    r = await call(emp, "GET", "/api/settings/schedule-window");
    check("nhân viên không đọc được cửa sổ", r.status === 401, `(${r.status})`);
    r = await call(emp, "PUT", "/api/settings/schedule-window", { openDay: 1, closeDay: 31 });
    check("nhân viên không đổi được cửa sổ", r.status === 401, `(${r.status})`);

    r = await call(admin, "PUT", "/api/settings/schedule-window", { openDay: 0, closeDay: 10 });
    check("chặn ngày mở 0", r.status === 400, `(${r.status})`);
    r = await call(admin, "PUT", "/api/settings/schedule-window", { openDay: 1, closeDay: 32 });
    check("chặn ngày đóng 32", r.status === 400, `(${r.status})`);
    r = await call(admin, "PUT", "/api/settings/schedule-window", { openDay: 20, closeDay: 10 });
    check("chặn ngày đóng trước ngày mở", r.status === 400, `(${r.status})`);

    // Mở cả tháng thì hôm nay chắc chắn nằm trong cửa sổ.
    const NEXT_MONTH = (() => {
      const [year, month] = TODAY_VN.slice(0, 7).split("-").map(Number);
      const shifted = new Date(Date.UTC(year, month, 1));
      return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
    })();

    r = await call(admin, "PUT", "/api/settings/schedule-window", { openDay: 1, closeDay: 31 });
    check("đặt cửa sổ 1 → 31", r.status === 200 && r.json.openDay === 1 && r.json.closeDay === 31, `(${r.status})`);

    r = await call(emp, "GET", `/api/schedule?month=${NEXT_MONTH}`);
    check("mở cả tháng thì nhân viên sửa được", r.json.canEdit === true, `(canEdit=${r.json.canEdit})`);
    r = await call(emp, "PUT", "/api/schedule", {
      month: NEXT_MONTH,
      days: { [`${NEXT_MONTH}-05`]: [morning.id] },
    });
    check("đăng ký được lịch tháng sau trong cửa sổ", r.status === 200, `(${r.status})`);

    // Thu hẹp cửa sổ về đúng một ngày khác hôm nay: phải đóng lại ngay.
    const todayDay = Number(TODAY_VN.slice(8, 10));
    const otherDay = todayDay === 1 ? 2 : 1;
    r = await call(admin, "PUT", "/api/settings/schedule-window", { openDay: otherDay, closeDay: otherDay });
    check("thu hẹp cửa sổ còn một ngày", r.status === 200, `(${r.status})`);

    r = await call(emp, "GET", `/api/schedule?month=${NEXT_MONTH}`);
    check("ngoài cửa sổ thì khoá sửa", r.json.canEdit === false, `(canEdit=${r.json.canEdit})`);
    check(
      "hiện đúng mốc cửa sổ mới",
      r.json.window?.opensOn?.endsWith(String(otherDay).padStart(2, "0")),
      `(${r.json.window?.opensOn} → ${r.json.window?.closesOn})`
    );
    r = await call(emp, "PUT", "/api/schedule", { month: NEXT_MONTH, days: {} });
    check("ngoài cửa sổ thì không lưu được", r.status === 400, `(${r.status})`);

    console.log("\n== nhân viên đổi mật khẩu ==");
    const NEW_PASS = "MatKhauMoi123";
    r = await call(emp, "POST", "/api/auth/password", { currentPassword: "sai-mat-khau", newPassword: NEW_PASS });
    check("sai mật khẩu hiện tại thì từ chối", r.status === 401, `(${r.status})`);
    r = await call(emp, "POST", "/api/auth/password", { currentPassword: EMP_PASS, newPassword: "abc" });
    check("chặn mật khẩu mới quá ngắn", r.status === 400, `(${r.status})`);
    const empOther = makeJar();
    r = await call(empOther, "POST", "/api/auth/login", { email: EMP_EMAIL, password: EMP_PASS });
    check("nhân viên đăng nhập thêm ở máy khác", r.status === 200, `(${r.status})`);
    r = await call(emp, "POST", "/api/auth/password", { currentPassword: EMP_PASS, newPassword: NEW_PASS });
    check("nhân viên tự đổi mật khẩu", r.status === 200, `(${r.status})`);
    r = await call(empOther, "GET", "/api/attendance");
    check("đổi mật khẩu thì phiên ở máy khác bị đăng xuất", r.status === 401, `(${r.status})`);
    r = await call(empOther, "GET", "/api/auth/session");
    check("session của máy khác trả về rỗng", r.json?.user === null, JSON.stringify(r.json).slice(0, 80));
    r = await call(emp, "GET", "/api/attendance");
    check("phiên đang thao tác vẫn dùng được", r.status === 200, `(${r.status})`);
    r = await call(emp, "POST", "/api/auth/login", { email: EMP_EMAIL, password: NEW_PASS });
    check("đăng nhập được bằng mật khẩu mới", r.status === 200, `(${r.status})`);
    r = await call(emp, "POST", "/api/auth/password", { currentPassword: NEW_PASS, newPassword: EMP_PASS });
    check("đổi lại mật khẩu cũ", r.status === 200, `(${r.status})`);

    console.log("\n== hồ sơ nhân viên (tab Cài đặt) ==");
    r = await call(emp, "GET", "/api/auth/profile");
    check("đọc được hồ sơ của chính mình", r.status === 200 && r.json.profile?.email === EMP_EMAIL, `(${r.status})`);
    check("chưa đặt ảnh thì avatarUrl rỗng", r.json.profile?.avatarUrl === null, `(${r.json.profile?.avatarUrl})`);

    r = await call(makeJar(), "GET", "/api/auth/profile");
    check("chưa đăng nhập thì không đọc được hồ sơ", r.status === 401, `(${r.status})`);
    r = await call(admin, "GET", "/api/auth/profile");
    check("admin không dùng hồ sơ nhân viên", r.status === 403, `(${r.status})`);

    // Ảnh upload lúc server đang chạy phải mở được ngay. Trước đây ảnh nằm ở
    // public/, mà `next start` chỉ quét public/ lúc khởi động nên ảnh mới 404.
    const PNG_1PX = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const avatarForm = new FormData();
    avatarForm.append("file", new Blob([PNG_1PX], { type: "image/png" }), "a.png");
    const uploaded = await fetch(BASE + "/api/auth/profile", {
      method: "POST",
      headers: { Cookie: emp.header() },
      body: avatarForm,
    });
    const avatarUrl = (await uploaded.json()).profile?.avatarUrl ?? "";
    check("upload được ảnh đại diện", uploaded.status === 200 && avatarUrl.startsWith("/uploads/avatar-"), `(${uploaded.status} ${avatarUrl})`);
    const served = await fetch(BASE + avatarUrl);
    check(
      "ảnh vừa upload mở được ngay",
      served.status === 200 && served.headers.get("content-type") === "image/png",
      `(${served.status} ${served.headers.get("content-type")})`
    );
    r = await call(emp, "DELETE", "/api/auth/profile");
    const gone = await fetch(BASE + avatarUrl);
    check("gỡ ảnh thì đường dẫn ảnh hết mở được", gone.status === 404, `(${gone.status})`);
    const traversal = await fetch(BASE + "/uploads/..%2F..%2F.env");
    check("không mò được file ngoài thư mục upload", traversal.status === 404, `(${traversal.status})`);

    r = await call(emp, "PUT", "/api/auth/profile", { name: "   ", email: EMP_EMAIL });
    check("chặn tên rỗng", r.status === 400, `(${r.status})`);
    r = await call(emp, "PUT", "/api/auth/profile", { name: "Tên Mới", email: "khong-phai-email" });
    check("chặn email sai định dạng", r.status === 400, `(${r.status})`);

    const NEW_EMAIL = "__smoketest_employee_moi@example.test";
    r = await call(emp, "PUT", "/api/auth/profile", { name: "Nhân Viên Đổi Tên", email: NEW_EMAIL });
    check("đổi được tên và email", r.status === 200 && r.json.profile?.name === "Nhân Viên Đổi Tên", `(${r.status})`);

    // Cookie phiên phải mang tên mới ngay, không đợi JWT hết hạn.
    r = await call(emp, "GET", "/api/auth/session");
    check("phiên cập nhật theo tên mới", r.json.user?.name === "Nhân Viên Đổi Tên", `(${r.json.user?.name})`);
    check("phiên cập nhật theo email mới", r.json.user?.email === NEW_EMAIL, `(${r.json.user?.email})`);

    // Toàn hệ thống đọc từ database nên bảng công của admin phải thấy tên mới.
    r = await call(admin, "GET", "/api/admin/attendance/monthly?month=2026-09");
    const renamed = r.json.summary?.find((item) => item.user.id === employeeId);
    check("bảng chấm công của admin thấy tên mới", renamed?.user.name === "Nhân Viên Đổi Tên", `(${renamed?.user.name})`);

    r = await call(emp, "POST", "/api/auth/login", { email: NEW_EMAIL, password: EMP_PASS });
    check("đăng nhập được bằng email mới", r.status === 200, `(${r.status})`);

    // Email trùng người khác thì phải chặn, vì email là tên đăng nhập.
    const otherEmail = "__smoketest_khac@example.test";
    await client.query(
      `INSERT INTO "User" ("name","email","password","role") VALUES ('__smoketest khác', $1, 'x', 'employee')`,
      [otherEmail]
    );
    r = await call(emp, "PUT", "/api/auth/profile", { name: "Nhân Viên Đổi Tên", email: otherEmail });
    check("chặn email đã có người dùng", r.status === 409, `(${r.status})`);
    r = await call(emp, "PUT", "/api/auth/profile", { name: "Nhân Viên Đổi Tên", email: ADMIN_USER });
    check("chặn đổi email sang email admin", r.status === 409, `(${r.status})`);
    await client.query(`DELETE FROM "User" WHERE "email" = $1`, [otherEmail]);

    // Trả lại email cũ để các bước sau vẫn đăng nhập được như cũ.
    r = await call(emp, "PUT", "/api/auth/profile", { name: "__smoketest Nhân viên", email: EMP_EMAIL });
    check("trả lại email cũ", r.status === 200, `(${r.status})`);

    console.log("\n== quên mật khẩu bằng mã 8 số ==");
    // Không gửi mail thật: lấy thẳng mã từ database rồi kiểm luồng đổi mật khẩu.
    const RESET_PASS = "MatKhauQuen123";
    const otp = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
    const otpHash = createHash("sha256").update(otp).digest("hex");
    await client.query(`DELETE FROM "PasswordReset" WHERE "userId" = $1`, [employeeId]);
    await client.query(
      `INSERT INTO "PasswordReset" ("userId", "tokenHash", "expiresAt")
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [employeeId, otpHash]
    );

    const wrong = otp === "00000000" ? "11111111" : "00000000";
    r = await call(makeJar(), "POST", "/api/auth/reset-password", { email: EMP_EMAIL, code: wrong, password: RESET_PASS });
    check("mã sai bị từ chối", r.status === 400, `(${r.status})`);
    check("báo còn bao nhiêu lần thử", /còn \d+ lần thử/.test(r.json.error ?? ""), `("${r.json.error}")`);

    r = await call(makeJar(), "POST", "/api/auth/reset-password", { email: EMP_EMAIL, code: otp, password: "123" });
    check("chặn mật khẩu mới quá ngắn", r.status === 400, `(${r.status})`);

    r = await call(makeJar(), "POST", "/api/auth/reset-password", { email: EMP_EMAIL, code: otp, password: RESET_PASS });
    check("đúng mã thì đổi được mật khẩu", r.status === 200, `(${r.status})`);

    const reset = makeJar();
    r = await call(reset, "POST", "/api/auth/login", { email: EMP_EMAIL, password: RESET_PASS });
    check("đăng nhập bằng mật khẩu mới", r.status === 200, `(${r.status})`);

    r = await call(makeJar(), "POST", "/api/auth/reset-password", { email: EMP_EMAIL, code: otp, password: RESET_PASS });
    check("mã đã dùng không dùng lại được", r.status === 400, `(${r.status})`);

    // Sai 5 lần thì mã bị huỷ, không để ai dò hết 8 chữ số.
    await client.query(`DELETE FROM "PasswordReset" WHERE "userId" = $1`, [employeeId]);
    await client.query(
      `INSERT INTO "PasswordReset" ("userId", "tokenHash", "expiresAt")
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [employeeId, otpHash]
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      r = await call(makeJar(), "POST", "/api/auth/reset-password", { email: EMP_EMAIL, code: wrong, password: RESET_PASS });
    }
    check("sai 5 lần thì huỷ mã", (r.json.error ?? "").includes("huỷ"), `("${r.json.error}")`);
    r = await call(makeJar(), "POST", "/api/auth/reset-password", { email: EMP_EMAIL, code: otp, password: RESET_PASS });
    check("mã đã huỷ thì không dùng được nữa", r.status === 400, `(${r.status})`);

    // Bắn nhiều lần đoán cùng lúc cũng chỉ được tối đa 5 lượt thử, không phải
    // mỗi request một lượt như khi đọc attempts ra rồi mới ghi lại.
    await client.query(`DELETE FROM "PasswordReset" WHERE "userId" = $1`, [employeeId]);
    await client.query(
      `INSERT INTO "PasswordReset" ("userId", "tokenHash", "expiresAt")
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [employeeId, otpHash]
    );
    const burst = await Promise.all(
      Array.from({ length: 20 }, () =>
        call(makeJar(), "POST", "/api/auth/reset-password", { email: EMP_EMAIL, code: wrong, password: RESET_PASS })
      )
    );
    const judged = burst.filter((item) => /còn \d+ lần thử/.test(item.json.error ?? "")).length;
    check("20 lần đoán song song chỉ được chấm tối đa 4 lượt sai", judged <= 4, `(${judged} lượt)`);
    r = await call(makeJar(), "POST", "/api/auth/reset-password", { email: EMP_EMAIL, code: otp, password: RESET_PASS });
    check("sau loạt đoán song song thì mã đã bị huỷ", r.status === 400, `(${r.status})`);

    // Trả mật khẩu về như cũ cho các bước sau.
    await client.query(`DELETE FROM "PasswordReset" WHERE "userId" = $1`, [employeeId]);
    r = await call(admin, "POST", `/api/users/${employeeId}/reset-password`, { password: EMP_PASS });
    check("admin đặt lại mật khẩu cũ", r.status === 200, `(${r.status})`);

    console.log("\n== chặn dò mật khẩu ==");
    const LOCK_EMAIL = "__smoketest_khoa@example.test";
    await client.query(`DELETE FROM "LoginAttempt" WHERE "identifier" LIKE '@_@_smoketest%' ESCAPE '@'`);
    for (let attempt = 0; attempt < 5; attempt++) {
      r = await call(makeJar(), "POST", "/api/auth/login", { email: LOCK_EMAIL, password: "sai" });
    }
    check("5 lần sai vẫn trả 401 (chưa lộ gì)", r.status === 401, `(${r.status})`);
    r = await call(makeJar(), "POST", "/api/auth/login", { email: LOCK_EMAIL, password: "sai" });
    check("lần thứ 6 bị khoá tạm", r.status === 429, `(${r.status})`);
    check("báo còn bao nhiêu phút", /\d+ phút/.test(r.json.error ?? ""), `("${r.json.error}")`);
    check("mách cách tự mở khoá", (r.json.error ?? "").includes("Quên mật khẩu"), `("${r.json.error}")`);

    // Email không có tài khoản cũng bị đếm y hệt, để không suy ra được email
    // nào có thật qua việc có bị khoá hay không.
    const locked = await client.query(
      `SELECT "failedCount" FROM "LoginAttempt" WHERE "identifier" = $1`,
      [LOCK_EMAIL]
    );
    check("có ghi nhận dù email không tồn tại", locked.rows[0]?.failedCount >= 5, `(${locked.rows[0]?.failedCount})`);

    // Đăng nhập đúng thì bộ đếm phải sạch, không để dồn sang lần sau.
    await client.query(`DELETE FROM "LoginAttempt" WHERE "identifier" = $1`, [EMP_EMAIL]);
    r = await call(makeJar(), "POST", "/api/auth/login", { email: EMP_EMAIL, password: "sai-mat-khau" });
    check("đăng nhập sai được ghi nhận", r.status === 401, `(${r.status})`);
    r = await call(makeJar(), "POST", "/api/auth/login", { email: EMP_EMAIL, password: EMP_PASS });
    check("đăng nhập đúng", r.status === 200, `(${r.status})`);
    const cleared = await client.query(
      `SELECT count(*)::int AS n FROM "LoginAttempt" WHERE "identifier" = $1`,
      [EMP_EMAIL]
    );
    check("đăng nhập đúng thì xoá bộ đếm", cleared.rows[0].n === 0, `(${cleared.rows[0].n})`);
    // Khoá tài khoản thật rồi đổi mật khẩu bằng mã: khoá phải được gỡ.
    for (let attempt = 0; attempt < 6; attempt++) {
      r = await call(makeJar(), "POST", "/api/auth/login", { email: EMP_EMAIL, password: "sai" });
    }
    check("tài khoản thật bị khoá", r.status === 429, `(${r.status})`);

    const unlockCode = "87654321";
    await client.query(`DELETE FROM "PasswordReset" WHERE "userId" = $1`, [employeeId]);
    await client.query(
      `INSERT INTO "PasswordReset" ("userId", "tokenHash", "expiresAt")
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [employeeId, createHash("sha256").update(unlockCode).digest("hex")]
    );
    r = await call(makeJar(), "POST", "/api/auth/reset-password", { email: EMP_EMAIL, code: unlockCode, password: EMP_PASS });
    check("đổi mật khẩu bằng mã khi đang bị khoá", r.status === 200, `(${r.status})`);
    r = await call(makeJar(), "POST", "/api/auth/login", { email: EMP_EMAIL, password: EMP_PASS });
    check("đổi mật khẩu xong là đăng nhập được ngay", r.status === 200, `(${r.status})`);
    // Đặt lại mật khẩu (qua email hay do admin) đá mọi phiên cũ của nhân viên ra.
    r = await call(emp, "GET", "/api/attendance");
    check("đặt lại mật khẩu thì phiên cũ hết hiệu lực", r.status === 401, `(${r.status})`);
    r = await call(emp, "POST", "/api/auth/login", { email: EMP_EMAIL, password: EMP_PASS });
    check("nhân viên đăng nhập lại", r.status === 200, `(${r.status})`);

    await client.query(`DELETE FROM "LoginAttempt" WHERE "identifier" LIKE '@_@_smoketest%' ESCAPE '@'`);

    console.log("\n== phân quyền ==");
    // Cookie admin còn hạn nhưng tài khoản admin đã bị xoá thì phải chặn.
    const ghost = makeJar();
    await client.query(`DELETE FROM "Admin" WHERE "username" = '__smoketest_ghost'`);
    await client.query(
      `INSERT INTO "Admin" ("username", "password") VALUES ('__smoketest_ghost', $1)`,
      [await bcrypt.hash(ADMIN_PASS, 10)]
    );
    r = await call(ghost, "POST", "/api/auth/login", { identifier: "__smoketest_ghost", password: ADMIN_PASS });
    check("admin tạm đăng nhập bằng tên đăng nhập (không phải email)", r.status === 200 && r.json.role === "admin", `(${r.status})`);
    await client.query(`DELETE FROM "Admin" WHERE "username" = '__smoketest_ghost'`);
    r = await call(ghost, "GET", "/api/users");
    check("admin đã bị xoá thì cookie cũ hết tác dụng", r.status === 401, `(${r.status})`);

    r = await call(emp, "GET", "/api/users");
    check("nhân viên không xem được danh sách NV", r.status === 401, `(${r.status})`);
    r = await call(emp, "PUT", "/api/settings/company", { value: "hack" });
    check("nhân viên không đổi được tên công ty", r.status === 401, `(${r.status})`);
    const anon = makeJar();
    r = await call(anon, "GET", "/api/locations/active");
    check("khách vãng lai không xem được toạ độ", r.status === 401, `(${r.status})`);
    r = await call(anon, "PUT", "/api/settings/company", { value: "hack" });
    check("khách vãng lai không đổi được tên công ty", r.status === 401, `(${r.status})`);

    console.log("\n== ghi nhận truy cập lạ ==");
    await client.query(`DELETE FROM "AccessViolation" WHERE "path" LIKE '/smoketest%'`);
    r = await call(emp, "POST", "/api/access-violation", { path: "/smoketest/admin", kind: "forbidden" });
    check("ghi nhận khi nhân viên mò đường dẫn lạ", r.status === 200 && r.json.recorded === true, `(${r.status})`);
    r = await call(makeJar(), "POST", "/api/access-violation", { path: "/smoketest/khach", kind: "not_found" });
    check("khách vãng lai thì không ghi (tránh rác)", r.status === 200 && r.json.recorded === false, `(${r.status})`);
    r = await call(emp, "POST", "/api/access-violation", { path: "https://ngoai.test", kind: "not_found" });
    check("chặn đường dẫn ra ngoài", r.json.recorded === false);

    r = await call(admin, "GET", "/api/admin/access-violations");
    const logged = r.json.items?.find((item) => item.path === "/smoketest/admin");
    check("admin xem được nhật ký", r.status === 200 && Boolean(logged), `(${r.status})`);
    check("nhật ký ghi đúng người", logged?.actorName === "__smoketest Nhân viên", `(${logged?.actorName})`);
    r = await call(emp, "GET", "/api/admin/access-violations");
    check("nhân viên không xem được nhật ký", r.status === 401, `(${r.status})`);
    await client.query(`DELETE FROM "AccessViolation" WHERE "path" LIKE '/smoketest%'`);

    console.log("\n== xác thực 2 lớp ==");
    const login = (jar) => call(jar, "POST", "/api/auth/login", { identifier: ADMIN_USER, password: ADMIN_PASS });
    /// Mã chắc chắn sai: lệch mã hiện tại một đơn vị.
    const wrongOf = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

    const admin2 = makeJar();
    r = await login(admin2);
    check("admin đăng nhập ở máy thứ hai", r.status === 200 && !r.json.twoFactorRequired, `(${r.status})`);
    r = await call(admin, "GET", "/api/auth/2fa");
    check("mặc định chưa bật 2 lớp", r.status === 200 && r.json.enabled === false, JSON.stringify(r.json));
    r = await call(admin, "POST", "/api/auth/2fa", { action: "setup", password: "sai-mat-khau" });
    check("tạo mã QR phải đúng mật khẩu", r.status === 400, `(${r.status})`);
    r = await call(admin, "POST", "/api/auth/2fa", { action: "setup", password: ADMIN_PASS });
    const adminSecret = r.json.secret ?? "";
    check(
      "tạo mã QR (chưa bật)",
      r.status === 200 && /^[A-Z2-7]{32}$/.test(adminSecret) && r.json.qrSvg?.startsWith("<svg"),
      `(${r.status})`
    );
    r = await call(admin, "GET", "/api/auth/2fa");
    check("chưa nhập mã xác nhận thì vẫn chưa bật", r.json.enabled === false);
    r = await call(admin, "POST", "/api/auth/2fa", { action: "confirm", code: wrongOf(totp(adminSecret)) });
    check("nhập sai mã thì không bật", r.status === 400, `(${r.status})`);
    r = await call(admin, "POST", "/api/auth/2fa", { action: "confirm", code: totp(adminSecret) });
    const adminBackup = r.json.backupCodes ?? [];
    check("nhập đúng mã thì bật, nhận 10 mã dự phòng", r.status === 200 && adminBackup.length === 10, `(${r.status} ${adminBackup.length})`);
    r = await call(admin, "GET", "/api/admin/security/log?tab=login&days=1");
    check("phiên đang thao tác vẫn dùng được sau khi bật", r.status === 200, `(${r.status})`);
    r = await call(admin2, "GET", "/api/admin/security/log?tab=login&days=1");
    check("bật 2 lớp thì phiên ở máy khác bị đăng xuất", r.status === 401, `(${r.status})`);

    const admin3 = makeJar();
    r = await login(admin3);
    check(
      "đúng mật khẩu thì đòi mã, chưa cấp phiên",
      r.status === 200 && r.json.twoFactorRequired === true && !admin3.header().includes("session="),
      `(${r.status} ${admin3.header().slice(0, 40)})`
    );
    r = await call(admin3, "GET", "/api/admin/security/log?tab=login&days=1");
    check("vé tạm không dùng thay phiên được", r.status === 401, `(${r.status})`);
    r = await call(makeJar(), "POST", "/api/auth/login/2fa", { code: totp(adminSecret) });
    check("không có vé tạm thì không nhập mã được", r.status === 401, `(${r.status})`);
    r = await call(admin3, "POST", "/api/auth/login/2fa", { code: wrongOf(totp(adminSecret)) });
    check("sai mã 2 lớp bị từ chối", r.status === 401, `(${r.status})`);
    // Mã lúc xác nhận đã bị ghi là "đã dùng": lấy mã của 30 giây kế (vẫn trong
    // khoảng lệch cho phép) để không phải chờ.
    const nextCode = totp(adminSecret, Date.now() + 30_000);
    r = await call(admin3, "POST", "/api/auth/login/2fa", { code: nextCode });
    check("đúng mã thì vào khu quản trị", r.status === 200 && r.json.redirect?.startsWith("/admin"), JSON.stringify(r.json).slice(0, 100));
    r = await call(admin3, "GET", "/api/admin/security/log?tab=login&days=1");
    check("có phiên sau bước 2", r.status === 200, `(${r.status})`);

    const admin4 = makeJar();
    await login(admin4);
    r = await call(admin4, "POST", "/api/auth/login/2fa", { code: nextCode });
    check("một mã 6 số không đăng nhập được hai lần", r.status === 401, `(${r.status})`);
    r = await call(admin4, "POST", "/api/auth/login/2fa", { code: adminBackup[0].toLowerCase() });
    check("mã dự phòng đăng nhập được (không phân biệt hoa thường)", r.status === 200, `(${r.status})`);
    const admin5 = makeJar();
    await login(admin5);
    r = await call(admin5, "POST", "/api/auth/login/2fa", { code: adminBackup[0] });
    check("mã dự phòng chỉ dùng được một lần", r.status === 401, `(${r.status})`);
    r = await call(admin, "GET", "/api/auth/2fa");
    check("còn 9 mã dự phòng", r.json.backupCodesRemaining === 9, `(${r.json.backupCodesRemaining})`);

    r = await call(admin, "POST", "/api/auth/2fa", { action: "disable", password: ADMIN_PASS, code: "000" });
    check("tắt 2 lớp phải có mã đúng", r.status === 400, `(${r.status})`);
    r = await call(admin, "POST", "/api/auth/2fa", { action: "disable", password: ADMIN_PASS, code: adminBackup[1] });
    check("tắt 2 lớp bằng mật khẩu + mã dự phòng", r.status === 200 && r.json.status?.enabled === false, `(${r.status})`);
    r = await login(makeJar());
    check("tắt xong đăng nhập lại chỉ cần mật khẩu", r.status === 200 && !r.json.twoFactorRequired, `(${r.status})`);

    r = await call(emp, "POST", "/api/auth/2fa", { action: "setup", password: EMP_PASS });
    const empSecret = r.json.secret ?? "";
    r = await call(emp, "POST", "/api/auth/2fa", { action: "confirm", code: totp(empSecret) });
    check("nhân viên tự bật 2 lớp", r.status === 200 && r.json.backupCodes?.length === 10, `(${r.status})`);
    r = await call(admin, "GET", "/api/users");
    check(
      "danh sách nhân viên có cờ 2 lớp",
      r.json.users?.find((user) => user.id === employeeId)?.twoFactorEnabled === true
    );
    check(
      "danh sách nhân viên không lộ khoá 2 lớp",
      !JSON.stringify(r.json).includes("totpSecret") && !JSON.stringify(r.json).includes(empSecret)
    );
    r = await call(emp, "DELETE", `/api/users/${employeeId}/two-factor`);
    check("nhân viên không gọi được API tắt hộ", r.status === 401, `(${r.status})`);
    r = await call(admin, "DELETE", `/api/users/${employeeId}/two-factor`);
    check("admin tắt 2 lớp hộ nhân viên", r.status === 200, `(${r.status})`);
    r = await call(emp, "GET", "/api/attendance");
    check("admin tắt hộ thì phiên nhân viên bị đăng xuất", r.status === 401, `(${r.status})`);
    r = await call(emp, "POST", "/api/auth/login", { email: EMP_EMAIL, password: EMP_PASS });
    check("nhân viên đăng nhập lại chỉ bằng mật khẩu", r.status === 200 && !r.json.twoFactorRequired, `(${r.status})`);

    r = await call(emp, "GET", "/api/admin/security/log?tab=login");
    check("nhân viên không xem được nhật ký bảo mật", r.status === 401, `(${r.status})`);
    r = await call(admin, "GET", "/api/admin/security/log?tab=login&days=1");
    const events = (r.json.rows ?? []).filter((row) => (row.identifier ?? "").toLowerCase().includes("__smoketest"));
    for (const [event, label] of [
      ["login", "đăng nhập"],
      ["login_failed", "sai mật khẩu"],
      ["2fa_enabled", "bật 2 lớp"],
      ["2fa_failed", "sai mã 2 lớp"],
      ["2fa_disabled", "tắt 2 lớp"],
      ["2fa_reset_by_admin", "admin tắt hộ"],
      ["password_changed", "đổi mật khẩu"],
      ["password_reset", "đặt lại mật khẩu"],
    ]) {
      check(`nhật ký có sự kiện ${label}`, events.some((row) => row.event === event));
    }
    await client.query(`DELETE FROM "LoginAttempt" WHERE "identifier" LIKE '%@_@_smoketest%' ESCAPE '@'`);

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
    check("mỗi ngày chỉ check-in một lần", r.status === 400, `(${r.status})`);

    r = await call(emp, "POST", "/api/attendance/punch", {
      type: "out",
      latitude: 21.0,
      longitude: 105.8,
    });
    check("check-out", r.status === 200, `(${r.status})`);

    r = await call(emp, "POST", "/api/attendance/punch", {
      type: "out",
      latitude: 21.0,
      longitude: 105.8,
    });
    check("check-out lần hai vẫn được", r.status === 200, `(${r.status})`);

    r = await call(emp, "GET", "/api/attendance");
    check("đã check-in nên checkInAt khác null", r.json.checkInAt !== null);
    check("lastOutAt lấy lần ra muộn nhất", r.json.lastOutAt !== null);
    check("hôm nay có 3 lần bấm giờ", r.json.todayEntry?.punches?.length === 3, `(${r.json.todayEntry?.punches?.length})`);

    console.log("\n== nhật ký chấm công ==");
    r = await call(emp, "POST", "/api/attendance/punch", { type: "out", latitude: 21.0, longitude: 105.8, accuracy: 900 });
    check("check-out kèm GPS kém chính xác vẫn nhận", r.status === 200, `(${r.status})`);
    r = await call(emp, "POST", "/api/attendance/punch", { type: "out" });
    check("không gửi vị trí thì từ chối", r.status === 400, `(${r.status})`);
    const attempts = (
      await client.query(`SELECT "result", "reason", "flags" FROM "PunchAttempt" WHERE "userId" = $1`, [employeeId])
    ).rows;
    check("nhật ký có lần từ chối ngoài bán kính", attempts.some((a) => a.reason === "outside_radius"));
    check("nhật ký có lần từ chối vì chưa check-in", attempts.some((a) => a.reason === "not_checked_in"));
    check("nhật ký có lần từ chối vì đã check-in", attempts.some((a) => a.reason === "already_checked_in"));
    check("nhật ký có lần từ chối vì không có vị trí", attempts.some((a) => a.reason === "no_location"));
    check("nhật ký gắn cờ GPS kém chính xác", attempts.some((a) => a.result === "accepted" && a.flags.includes("low_accuracy")));
    check("nhật ký có lần nhận bình thường", attempts.some((a) => a.result === "accepted"));
    r = await call(emp, "GET", "/api/admin/security/log?tab=punch");
    check("nhân viên không xem được nhật ký chấm công", r.status === 401, `(${r.status})`);
    r = await call(admin, "GET", "/api/admin/security/log?tab=punch&only=suspicious&days=1");
    const suspiciousRows = (r.json.rows ?? []).filter((row) => row.userEmail === EMP_EMAIL);
    check(
      "lọc bất thường chỉ còn lần bị từ chối hoặc có cờ",
      suspiciousRows.length > 0 && suspiciousRows.every((row) => row.result === "rejected" || row.flags.length > 0),
      `(${suspiciousRows.length})`
    );

    console.log("\n== email thông báo nhân viên (máy chủ SMTP giả) ==");
    previousEmail = (await client.query(`SELECT "value" FROM "Settings" WHERE "key" = 'email_config'`)).rows[0] ?? { value: undefined };
    sink = await startSmtpSink();
    const sinkConfig = {
      host: "127.0.0.1",
      port: sink.port,
      secure: false,
      from: "Chấm công <noreply@example.test>",
      appUrl: "https://cham-cong.example.test",
      reminderEnabled: false,
    };
    r = await call(admin, "PUT", "/api/admin/email-settings", { ...sinkConfig, notifyEnabled: true });
    check("trỏ SMTP sang máy chủ giả, bật thông báo", r.status === 200 && r.json.config?.notifyEnabled === true, `(${r.status})`);

    console.log("\n== sửa công thủ công ==");
    const editDay = {
      date: "2026-09-01",
      punches: [
        { type: "in", time: "08:00" },
        { type: "out", time: "12:00" },
        { type: "out", time: "17:00" },
      ],
      note: "__smoketest bổ sung công",
    };
    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, editDay);
    check("nhập tay 1 vào + 2 ra", r.status === 200 && r.json.punches === 3, JSON.stringify(r.json).slice(0, 120));
    let mail = await waitForMail(sink, EMP_EMAIL, "Giờ chấm công ngày 01/09 đã được điều chỉnh");
    check("sửa giờ thì nhân viên nhận email", Boolean(mail), `(${sink.messages.length} thư)`);
    check("email có giờ trước / sau", mail?.text.includes("Trước: không có giờ chấm công") && mail?.text.includes("Sau: Vào 08:00 · Ra 12:00 · Ra 17:00"), mail?.text);
    check("email có ghi chú của admin", mail?.text.includes("Ghi chú của quản trị viên: __smoketest bổ sung công"));
    check("email có link xem lại", mail?.text.includes("https://cham-cong.example.test/dashboard/history"));
    check("tiêu đề email có tiền tố [Chấm công]", mail?.subject.startsWith("[Chấm công] "), `(${mail?.subject})`);
    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, editDay);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    check("lưu lại y hệt thì không gửi thêm email", mailsTo(sink, EMP_EMAIL, "ngày 01/09 đã được điều chỉnh").length === 1, `(${mailsTo(sink, EMP_EMAIL, "ngày 01/09 đã được điều chỉnh").length})`);

    r = await call(admin, "PUT", "/api/admin/email-settings", { ...sinkConfig, notifyEnabled: false });
    check("tắt thông báo ở trang Email", r.status === 200 && r.json.config?.notifyEnabled === false, `(${r.status})`);
    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, { ...editDay, note: "__smoketest đã tắt thông báo" });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    check("tắt thông báo thì không gửi email", mailsTo(sink, EMP_EMAIL, "ngày 01/09 đã được điều chỉnh").length === 1);
    r = await call(admin, "PUT", "/api/admin/email-settings", { ...sinkConfig, notifyEnabled: true });
    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, editDay);

    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, {
      date: "2026-09-01",
      punches: [
        { type: "in", time: "08:00" },
        { type: "in", time: "13:00" },
        { type: "out", time: "17:00" },
      ],
    });
    check("chặn hai giờ vào trong một ngày", r.status === 400, `(${r.status})`);

    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, {
      date: "2026-09-01",
      punches: [
        { type: "out", time: "08:00" },
        { type: "in", time: "12:00" },
      ],
    });
    check("chặn giờ ra trước giờ vào", r.status === 400, `(${r.status})`);

    // Khôi phục lại dữ liệu hợp lệ cho các kiểm tra phía dưới.
    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, {
      date: "2026-09-01",
      punches: [
        { type: "in", time: "08:00" },
        { type: "out", time: "12:00" },
        { type: "out", time: "17:00" },
      ],
      note: "__smoketest bổ sung công",
    });
    check("khôi phục dữ liệu ngày 01/09", r.status === 200, `(${r.status})`);

    r = await call(admin, "GET", `/api/admin/attendance/user/${employeeId}?month=2026-09`);
    const day1 = r.json.days?.find((d) => d.date === "2026-09-01");
    check("giờ công = 8h: 08:00–17:00 trừ 1h nghỉ trưa 12:00–13:00", day1?.workedHours === 8, `(${day1?.workedHours}h)`);
    check("giờ hiển thị đúng múi giờ VN", day1?.punches?.[0]?.time === "08:00", `(${day1?.punches?.[0]?.time})`);
    check("ngày đủ công", day1?.status === "passed", `(${day1?.status})`);
    const holiday = r.json.days?.find((d) => d.date === "2026-09-02");
    check("ngày lễ không bị tính vắng", holiday?.status === "holiday", `(${holiday?.status})`);
    const noSchedule = r.json.days?.find((d) => d.date === "2026-09-10");
    check("ngày không lịch, không chấm công = off", noSchedule?.status === "off", `(${noSchedule?.status})`);
    const day3 = r.json.days?.find((d) => d.date === ABSENT_DATE);
    check("có lịch mà không chấm công = vắng", day3?.status === "absent", `(${day3?.status})`);

    console.log("\n== báo cáo tháng ==");
    r = await call(admin, "GET", "/api/admin/attendance/monthly?month=2026-09");
    const summary = r.json.summary?.find((s) => s.user.id === employeeId);
    check("bảng tháng có nhân viên", Boolean(summary));
    // 01/09 làm đủ S + C = 0,5 + 0,5 = 1 công. Khối chấm công ở trên bấm vào/ra
    // hôm nay, ngày không có lịch và chỉ vài phút, nên nếu hôm nay thuộc tháng
    // 9/2026 thì cộng thêm nửa công (ngoài lịch, chưa đủ ngưỡng cả ngày).
    const expectedWorkdays = 1 + (TODAY_VN.startsWith("2026-09") ? 0.5 : 0);
    check(`đếm đúng ${expectedWorkdays} ngày công`, summary?.workdays === expectedWorkdays, `(${summary?.workdays})`);
    check("ngày công tháng 9/2026 = 22", r.json.standardWorkdays === 22, `(${r.json.standardWorkdays})`);
    check("đếm đúng 1 ngày vắng", summary?.absentDays === 1, `(${summary?.absentDays})`);
    check("tổng giờ = 8h (đã trừ nghỉ trưa)", summary?.totalHours === 8, `(${summary?.totalHours})`);

    const xlsx = await fetch(
      BASE + "/api/admin/attendance/monthly?month=2026-09&export=xlsx",
      { headers: { Cookie: admin.header() } }
    );
    const xlsxBuffer = Buffer.from(await xlsx.arrayBuffer());
    check(
      "xuất Excel",
      xlsx.status === 200 &&
        (xlsx.headers.get("content-type") ?? "").includes("spreadsheetml"),
      `(${xlsx.status} ${xlsx.headers.get("content-type")})`
    );
    // File .xlsx là một file zip: hai byte đầu luôn là "PK".
    check("file .xlsx hợp lệ", xlsxBuffer.subarray(0, 2).toString() === "PK", `(${xlsxBuffer.length} byte)`);
    check(
      "đặt tên file theo tháng",
      (xlsx.headers.get("content-disposition") ?? "").includes("cham-cong-2026-09.xlsx"),
      `(${xlsx.headers.get("content-disposition")})`
    );
    // Link cũ ?export=csv vẫn trả file Excel thay vì 200 rỗng.
    const legacy = await fetch(
      BASE + "/api/admin/attendance/monthly?month=2026-09&export=csv",
      { headers: { Cookie: admin.header() } }
    );
    check(
      "link export=csv cũ vẫn tải được file",
      legacy.status === 200 &&
        (legacy.headers.get("content-type") ?? "").includes("spreadsheetml"),
      `(${legacy.status})`
    );

    r = await call(admin, "GET", "/api/admin/attendance/monthly?month=2026-13");
    check("chặn tháng không hợp lệ", r.status === 400, `(${r.status})`);

    const empXlsx = await fetch(
      BASE + `/api/admin/attendance/user/${employeeId}?month=2026-09&export=xlsx`,
      { headers: { Cookie: admin.header() } }
    );
    const empXlsxBuffer = Buffer.from(await empXlsx.arrayBuffer());
    check(
      "xuất Excel chấm công từng nhân viên",
      empXlsx.status === 200 &&
        (empXlsx.headers.get("content-type") ?? "").includes("spreadsheetml") &&
        empXlsxBuffer.subarray(0, 2).toString() === "PK",
      `(${empXlsx.status} ${empXlsxBuffer.length} byte)`
    );
    check(
      "tên file theo tháng + mã NV (không có mã thì lấy ID)",
      /cham-cong-2026-09-[\w-]+\.xlsx/.test(empXlsx.headers.get("content-disposition") ?? ""),
      `(${empXlsx.headers.get("content-disposition")})`
    );
    r = await call(emp, "GET", `/api/admin/attendance/user/${employeeId}?month=2026-09&export=xlsx`);
    check("nhân viên không tải được file chi tiết của admin", r.status === 401 || r.status === 403, `(${r.status})`);

    console.log("\n== xem lại ngày thiếu giờ ==");
    // Ngày ABSENT_DATE có lịch ca sáng; chấm tay 08:00–09:00 cho thành thiếu giờ.
    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, {
      date: ABSENT_DATE,
      punches: [{ type: "in", time: "08:00" }, { type: "out", time: "09:00" }],
      note: "__smoketest thiếu giờ",
    });
    check("tạo ngày thiếu giờ", r.status === 200, `(${r.status})`);
    const shortDayOf = async () => {
      const detail = await call(admin, "GET", `/api/admin/attendance/user/${employeeId}?month=2026-09`);
      return { day: detail.json.days?.find((d) => d.date === ABSENT_DATE), totals: detail.json.totals };
    };
    let short = await shortDayOf();
    check("thiếu giờ vẫn tính đủ nửa công ca sáng", short.day?.status === "insufficient" && short.day?.workdayValue === 0.5, `(${short.day?.status} ${short.day?.workdayValue})`);
    check("thiếu giờ chờ admin xem lại", short.day?.needsReview === true && short.totals?.reviewDays >= 1);
    check("chi tiết có ngày công tháng", short.totals?.standardWorkdays === 22, `(${short.totals?.standardWorkdays})`);
    r = await call(admin, "PUT", "/api/admin/attendance/day-review", { userId: employeeId, date: ABSENT_DATE, decision: "exclude" });
    check("admin chọn không tính công", r.status === 200 && r.json.decision === "exclude", `(${r.status})`);
    const absentShort = `${ABSENT_DATE.slice(8, 10)}/${ABSENT_DATE.slice(5, 7)}`;
    mail = await waitForMail(sink, EMP_EMAIL, `Ngày ${absentShort} làm thiếu giờ đã được xem lại`);
    check("quyết định ngày thiếu giờ thì báo nhân viên", mail?.text.includes("Quản trị viên không tính công."), mail?.text);

    console.log("\n== chấm lại ô ngày ==");
    r = await call(admin, "PUT", "/api/admin/attendance/day-mark", { userId: employeeId, date: "2026-09-29", leaveCode: "O" });
    check("admin chấm ô ngày là Ốm", r.status === 200 && r.json.leaveCode === "O", `(${r.status})`);
    mail = await waitForMail(sink, EMP_EMAIL, "Bảng chấm công ngày 29/09 đã được điều chỉnh");
    check("chấm lại ô thì báo nhân viên", mail?.text.includes("được ghi là Ốm (O)"), mail?.text);
    r = await call(admin, "PUT", "/api/admin/attendance/day-mark", { userId: employeeId, date: "2026-09-29", leaveCode: null, sessionIds: [] });
    check("xoá đánh dấu ô", r.status === 200 && r.json.cleared === true, `(${r.status})`);
    await waitForMail(sink, EMP_EMAIL, "__không-có__", 1500);
    check("xoá đánh dấu cũng báo nhân viên", mailsTo(sink, EMP_EMAIL, "Bảng chấm công ngày 29/09").some((item) => item.text.includes("Đã bỏ đánh dấu")));
    r = await call(admin, "PUT", "/api/admin/attendance/day-mark", { userId: employeeId, date: "2026-09-29", leaveCode: null, sessionIds: [] });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    check("xoá ô vốn không có đánh dấu thì không gửi", mailsTo(sink, EMP_EMAIL, "Bảng chấm công ngày 29/09").length === 2, `(${mailsTo(sink, EMP_EMAIL, "Bảng chấm công ngày 29/09").length})`);
    short = await shortDayOf();
    check("không tính thì về 0 công, hết chờ xem", short.day?.workdayValue === 0 && short.day?.needsReview === false, `(${short.day?.workdayValue})`);
    r = await call(admin, "PUT", "/api/admin/attendance/day-review", { userId: employeeId, date: ABSENT_DATE, decision: "count" });
    short = await shortDayOf();
    check("đổi sang tính công thì lại có nửa công", short.day?.workdayValue === 0.5 && short.day?.reviewDecision === "count");
    r = await call(admin, "PUT", "/api/admin/attendance/day-review", { userId: employeeId, date: ABSENT_DATE, decision: null });
    short = await shortDayOf();
    check("bỏ quyết định thì quay về chờ xem lại", short.day?.needsReview === true && short.day?.reviewDecision === null);
    r = await call(admin, "PUT", "/api/admin/attendance/day-review", { userId: employeeId, date: ABSENT_DATE, decision: "bừa" });
    check("chặn quyết định lạ", r.status === 400, `(${r.status})`);
    r = await call(admin, "PUT", "/api/admin/attendance/day-review", { userId: employeeId, date: "2026-02-31", decision: "count" });
    check("chặn ngày không hợp lệ", r.status === 400, `(${r.status})`);
    r = await call(emp, "PUT", "/api/admin/attendance/day-review", { userId: employeeId, date: ABSENT_DATE, decision: "count" });
    check("nhân viên không tự duyệt được", r.status === 401 || r.status === 403, `(${r.status})`);
    // Trả ngày về như cũ (vắng) cho các bước sau.
    r = await call(admin, "PUT", `/api/admin/attendance/user/${employeeId}`, { date: ABSENT_DATE, punches: [], note: "" });
    short = await shortDayOf();
    check("khôi phục ngày vắng", short.day?.status === "absent", `(${short.day?.status})`);

    console.log("\n== phiếu làm thêm giờ (OT) ==");
    r = await call(admin, "GET", "/api/settings/overtime");
    check("đọc hệ số OT mặc định 150/200/300",
      r.json.config?.weekdayRate === 150 && r.json.config?.weeklyOffRate === 200 && r.json.config?.holidayRate === 300,
      JSON.stringify(r.json.config));
    r = await call(emp, "GET", "/api/settings/overtime");
    check("nhân viên không xem cấu hình OT", r.status === 401 || r.status === 403, `(${r.status})`);
    r = await call(admin, "PUT", "/api/settings/overtime", { weekdayRate: 50, weeklyOffRate: 200, holidayRate: 300, hoursPerDay: 8 });
    check("chặn hệ số dưới 100%", r.status === 400, `(${r.status})`);

    r = await call(emp, "POST", "/api/overtime", { date: "2026-09-01", plannedStart: "21:00", plannedEnd: "18:00", content: "Làm báo cáo" });
    check("chặn giờ kết thúc trước giờ bắt đầu", r.status === 400, `(${r.status})`);
    r = await call(emp, "POST", "/api/overtime", { date: "2026-09-01", plannedStart: "18:00", plannedEnd: "21:00", content: "ok" });
    check("chặn nội dung quá ngắn", r.status === 400, `(${r.status})`);
    r = await call(admin, "POST", "/api/overtime", { date: "2026-09-01", plannedStart: "18:00", plannedEnd: "21:00", content: "Làm báo cáo" });
    check("admin không làm phiếu OT thay nhân viên ở API nhân viên", r.status === 401 || r.status === 403, `(${r.status})`);

    r = await call(emp, "POST", "/api/overtime", { date: "2026-09-01", plannedStart: "17:30", plannedEnd: "20:00", content: "Hoàn thiện báo cáo tháng" });
    const weekdayOt = r.json.request;
    check("gửi phiếu OT ngày thường", r.status === 200 && weekdayOt?.status === "pending", `(${r.status})`);
    check("ngày thường tự gắn T, hệ số 150%", weekdayOt?.code === "T" && weekdayOt?.rate === 150, `(${weekdayOt?.code} ${weekdayOt?.rate})`);
    check("ra đúng 17:00 (trước giờ hết ca) thì chấm công ra 0 giờ OT",
      weekdayOt?.computedSource === "punches" && weekdayOt?.computedMinutes === 0, `(${weekdayOt?.computedSource} ${weekdayOt?.computedMinutes})`);
    r = await call(emp, "POST", "/api/overtime", { date: "2026-09-01", plannedStart: "17:30", plannedEnd: "21:00", content: "Sửa lại giờ dự kiến" });
    check("gửi lại cùng ngày thì sửa phiếu đang chờ", r.status === 200 && r.json.request?.id === weekdayOt?.id && r.json.request?.plannedEnd === "21:00");

    r = await call(emp, "POST", "/api/overtime", {
      date: "2026-09-05", plannedStart: "08:00", plannedEnd: "12:00",
      place: "Văn phòng → khách hàng", content: "Đi lắp đặt cho khách",
    });
    const weekendOt = r.json.request;
    check("thứ 7 tự gắn T1, hệ số 200%", weekendOt?.code === "T1" && weekendOt?.rate === 200, `(${weekendOt?.code} ${weekendOt?.rate})`);
    check("không chấm công thì lấy giờ dự kiến 4h", weekendOt?.computedSource === "planned" && weekendOt?.minutes === 240, `(${weekendOt?.computedSource} ${weekendOt?.minutes})`);

    r = await call(admin, "GET", "/api/admin/overtime?month=2026-09&status=pending");
    check("admin thấy phiếu đang chờ", r.json.requests?.some((item) => item.id === weekendOt?.id) && r.json.pendingTotal >= 2, `(${r.json.pendingTotal})`);
    r = await call(admin, "PATCH", `/api/admin/overtime/${weekendOt?.id}`, { action: "approve", approvedHours: 30 });
    check("chặn số giờ chốt quá 24", r.status === 400, `(${r.status})`);
    r = await call(admin, "PATCH", `/api/admin/overtime/${weekendOt?.id}`, { action: "bừa" });
    check("chặn thao tác lạ", r.status === 400, `(${r.status})`);
    r = await call(admin, "PATCH", "/api/admin/overtime/khong-co", { action: "approve" });
    check("phiếu không tồn tại = 404", r.status === 404, `(${r.status})`);
    r = await call(admin, "PATCH", `/api/admin/overtime/${weekendOt?.id}`, { action: "approve", approvedHours: 3.5, adminNote: "Chốt 3,5h" });
    check("admin duyệt và chốt 3,5 giờ", r.status === 200 && r.json.request?.status === "approved" && r.json.request?.minutes === 210, `(${r.status} ${r.json.request?.minutes})`);
    mail = await waitForMail(sink, EMP_EMAIL, "Phiếu OT ngày 05/09 đã được duyệt");
    check("duyệt OT thì báo nhân viên kèm số giờ", mail?.text.includes("3,5 giờ, loại T1"), mail?.text);

    r = await call(emp, "POST", "/api/overtime", { date: "2026-09-05", plannedStart: "08:00", plannedEnd: "17:00", content: "Muốn sửa phiếu đã duyệt" });
    check("ngày đã có phiếu duyệt thì không làm phiếu mới", r.status === 409, `(${r.status})`);
    r = await call(emp, "DELETE", `/api/overtime/${weekendOt?.id}`);
    check("không huỷ được phiếu đã duyệt", r.status === 409, `(${r.status})`);
    r = await call(emp, "DELETE", `/api/overtime/${weekdayOt?.id}`);
    check("huỷ được phiếu đang chờ", r.status === 200, `(${r.status})`);

    r = await call(admin, "GET", "/api/admin/attendance/monthly?month=2026-09");
    let otSummary = r.json.summary?.find((item) => item.user.id === employeeId);
    check("bảng công cộng 3,5h OT loại T1", otSummary?.overtimeMinutes?.T1 === 210, JSON.stringify(otSummary?.overtimeMinutes));
    check("ô ngày 05/09 hiện ký hiệu T1", otSummary?.days?.["2026-09-05"]?.label === "T1", `(${otSummary?.days?.["2026-09-05"]?.label})`);
    r = await call(admin, "GET", `/api/admin/attendance/user/${employeeId}?month=2026-09`);
    check("chi tiết nhân viên có tổng OT", r.json.totals?.overtimeMinutes === 210, `(${r.json.totals?.overtimeMinutes})`);

    r = await call(admin, "PATCH", `/api/admin/overtime/${weekendOt?.id}`, { action: "update", approvedHours: null });
    check("bỏ số giờ chốt thì quay về giờ tính được (4h)", r.json.request?.minutes === 240 && r.json.request?.approvedMinutes === null, `(${r.json.request?.minutes})`);
    r = await call(admin, "PATCH", `/api/admin/overtime/${weekendOt?.id}`, { action: "reject", adminNote: "Không cần đi" });
    check("admin từ chối phiếu", r.json.request?.status === "rejected", `(${r.json.request?.status})`);
    mail = await waitForMail(sink, EMP_EMAIL, "Phiếu OT ngày 05/09 bị từ chối");
    check("từ chối OT thì báo nhân viên kèm lý do", mail?.text.includes("Không cần đi"), mail?.text);
    r = await call(admin, "GET", "/api/admin/attendance/monthly?month=2026-09");
    otSummary = r.json.summary?.find((item) => item.user.id === employeeId);
    check("phiếu bị từ chối không còn tính giờ OT", (otSummary?.overtimeMinutes?.T1 ?? 0) === 0, JSON.stringify(otSummary?.overtimeMinutes));
    r = await call(emp, "POST", "/api/overtime", { date: "2026-09-05", plannedStart: "08:00", plannedEnd: "12:00", content: "Làm lại phiếu sau khi bị từ chối" });
    check("bị từ chối thì làm phiếu mới được", r.status === 200 && r.json.request?.status === "pending", `(${r.status})`);
    await client.query(`DELETE FROM "OvertimeRequest" WHERE "userId" = $1`, [employeeId]);

    console.log("\n== bảng lương ==");
    const PAY_MONTH = "2026-09";
    const alreadyClosed = (await client.query(`SELECT 1 FROM "PayrollClosing" WHERE "month" = $1`, [PAY_MONTH])).rowCount > 0;
    const payRow = async () => {
      const result = await call(admin, "GET", `/api/admin/payroll?month=${PAY_MONTH}`);
      return { sheet: result.json, row: result.json.rows?.find((item) => item.user.id === employeeId) };
    };
    let pr = await payRow();
    check("bảng lương có nhân viên chưa có hồ sơ (0 đồng)", pr.row && pr.row.hasProfile === false && pr.row.payroll.net === 0, `(${pr.row?.payroll?.net})`);
    check("cảnh báo người chưa có hồ sơ lương", pr.sheet.warnings?.missingProfiles?.includes("__smoketest Nhân viên"), JSON.stringify(pr.sheet.warnings?.missingProfiles));
    check("tháng đã qua thì không tạm tính", pr.sheet.projected === false);
    r = await call(emp, "GET", `/api/admin/payroll?month=${PAY_MONTH}`);
    check("nhân viên không xem được bảng lương", r.status === 401 || r.status === 403, `(${r.status})`);

    r = await call(admin, "POST", "/api/admin/allowances", { name: "__smoketest Hỗ trợ AI", amount: 300000, mode: "bừa" });
    check("chặn cách tính hỗ trợ lạ", r.status === 400, `(${r.status})`);
    r = await call(admin, "POST", "/api/admin/allowances", { name: "__smoketest Hỗ trợ AI", amount: 300000, mode: "monthly" });
    const aiId = r.json.allowance?.id;
    check("tạo khoản hỗ trợ", r.status === 200 && aiId, `(${r.status})`);
    r = await call(admin, "POST", "/api/admin/allowances", { name: "__SMOKETEST hỗ trợ ai", amount: 1, mode: "monthly" });
    check("chặn khoản hỗ trợ trùng tên", r.status === 409, `(${r.status})`);

    r = await call(admin, "PUT", `/api/admin/payroll/profile/${employeeId}`, {
      payBasis: "net", salaryType: "monthly", baseSalary: 15000000, contractType: "official", taxMode: "progressive", hasInsurance: true,
    });
    check("NET có BH mà không nhập lương đóng BH thì chặn", r.status === 400, `(${r.status})`);
    r = await call(admin, "PUT", `/api/admin/payroll/profile/${employeeId}`, { salaryType: "bừa", baseSalary: 1 });
    check("chặn kiểu lương lạ", r.status === 400, `(${r.status})`);
    r = await call(admin, "PUT", `/api/admin/payroll/profile/${employeeId}`, {
      salaryType: "monthly", baseSalary: 8800000, contractType: "collaborator", taxMode: "flat10",
      annualLeave: true, bankAccount: "0123456789", allowances: [{ allowanceId: aiId, amount: null }],
    });
    check("lưu hồ sơ lương", r.status === 200, `(${r.status} ${r.json.error ?? ""})`);
    check("CTV không có phép năm dù bật", r.json.profile?.annualLeave === false);
    r = await call(admin, "GET", `/api/admin/payroll/profile/${employeeId}`);
    check("đọc lại hồ sơ lương", r.json.hasProfile === true && r.json.profile?.baseSalary === 8800000 && r.json.allowances?.find((a) => a.id === aiId)?.assigned === true);

    // 01/09 làm S + C = 1 công / 22: 8.800.000 / 22 = 400.000; + hỗ trợ 300.000; thuế 10%.
    pr = await payRow();
    check("thành tiền = 8.800.000 × 1/22 = 400.000", pr.row?.payroll?.earned === 400000, `(${pr.row?.payroll?.earned})`);
    check("hỗ trợ AI 300.000", pr.row?.payroll?.allowanceTotal === 300000, `(${pr.row?.payroll?.allowanceTotal})`);
    check("thuế 10% = 70.000, thực nhận 630.000", pr.row?.payroll?.tax === 70000 && pr.row?.payroll?.net === 630000, `(${pr.row?.payroll?.tax} ${pr.row?.payroll?.net})`);

    const payXlsx = await fetch(BASE + `/api/admin/payroll/export?month=${PAY_MONTH}`, { headers: { Cookie: admin.header() } });
    const payBuf = Buffer.from(await payXlsx.arrayBuffer());
    check("tải bảng lương toàn công ty", payXlsx.status === 200 && payBuf.subarray(0, 2).toString() === "PK" &&
      (payXlsx.headers.get("content-disposition") ?? "").includes("bang-luong-2026-09.xlsx"), `(${payXlsx.status})`);
    const slip = await fetch(BASE + `/api/admin/payroll/export?month=${PAY_MONTH}&userId=${employeeId}`, { headers: { Cookie: admin.header() } });
    const slipBuf = Buffer.from(await slip.arrayBuffer());
    check("tải phiếu lương từng người", slip.status === 200 && slipBuf.subarray(0, 2).toString() === "PK" &&
      (slip.headers.get("content-disposition") ?? "").includes("phieu-luong-2026-09-"), `(${slip.status})`);
    r = await call(admin, "GET", `/api/admin/payroll/export?month=${PAY_MONTH}&userId=khong-co`);
    check("phiếu lương người lạ = 404", r.status === 404, `(${r.status})`);

    if (!alreadyClosed) {
      r = await call(admin, "POST", "/api/admin/payroll/close", { month: PAY_MONTH });
      check("chốt lương tháng", r.status === 200 && r.json.closedAt, `(${r.status})`);
      r = await call(admin, "POST", "/api/admin/payroll/close", { month: PAY_MONTH });
      check("không chốt hai lần", r.status === 409, `(${r.status})`);
      await call(admin, "PUT", `/api/admin/payroll/profile/${employeeId}`, {
        salaryType: "monthly", baseSalary: 17600000, contractType: "collaborator", taxMode: "flat10",
        allowances: [{ allowanceId: aiId, amount: null }],
      });
      pr = await payRow();
      check("đã chốt: đổi lương cơ bản không làm đổi bảng lương", pr.sheet.closed && pr.row?.payroll?.net === 630000, `(${pr.row?.payroll?.net})`);
      r = await call(admin, "DELETE", `/api/admin/payroll/close?month=${PAY_MONTH}`);
      check("mở chốt", r.status === 200, `(${r.status})`);
      pr = await payRow();
      // 17.600.000 / 22 = 800.000 + 300.000 = 1.100.000, thuế 110.000.
      check("mở chốt thì tính lại theo lương mới: thực nhận 990.000", !pr.sheet.closed && pr.row?.payroll?.net === 990000, `(${pr.row?.payroll?.net})`);
      r = await call(admin, "DELETE", `/api/admin/payroll/close?month=${PAY_MONTH}`);
      check("mở chốt tháng chưa chốt = 404", r.status === 404, `(${r.status})`);
    }

    r = await call(admin, "GET", "/api/settings/payroll");
    check("đọc cấu hình lương mặc định (BHXH 8%)", r.json.config?.insurance?.bhxh === 8, JSON.stringify(r.json.config?.insurance));
    r = await call(admin, "PUT", "/api/settings/payroll", { ...r.json.config, taxBrackets: [{ upTo: 30, rate: 5 }, { upTo: 10, rate: 10 }, { upTo: null, rate: 20 }] });
    check("chặn biểu thuế không tăng dần", r.status === 400, `(${r.status})`);
    r = await call(admin, "DELETE", `/api/admin/allowances/${aiId}`);
    check("xoá khoản hỗ trợ", r.status === 200, `(${r.status})`);

    // Đặt sau các kiểm tra "ngày đủ công" / "tổng giờ" ở trên: duyệt đổi ca sẽ
    // ghi DayMark cho ngày 01/09 và làm đổi lịch của ngày đó.
    console.log("\n== yêu cầu đổi ca ==");
    const fullDay =
      sessions.find((s) => s.isDefaultFull) ??
      sessions.find((s) => s.id !== morning.id && s.id !== afternoon.id) ??
      afternoon;
    r = await call(emp, "POST", "/api/shift-requests", {
      date: "2026-09-01",
      sessionIds: [fullDay.id],
      reason: "__smoketest làm cả ngày",
    });
    const requestId = r.json.request?.id;
    check(
      "nhân viên gửi yêu cầu đổi ca -> pending",
      r.status === 200 && r.json.request?.status === "pending" && Boolean(requestId),
      JSON.stringify(r.json).slice(0, 120)
    );
    r = await call(emp, "POST", "/api/shift-requests", {
      date: "2026-09-01",
      sessionIds: [fullDay.id, fullDay.id],
      reason: "__smoketest gửi lại, ghi đè",
    });
    check(
      "gửi lại cùng ngày thì ghi đè yêu cầu đang chờ (giữ id)",
      r.status === 200 && r.json.request?.id === requestId && r.json.request?.reason === "__smoketest gửi lại, ghi đè",
      `(${r.status}, id ${r.json.request?.id === requestId ? "giữ nguyên" : "khác"})`
    );
    check("ca trùng được gộp lại", r.json.request?.sessionIds?.length === 1, `(${r.json.request?.sessionIds?.length})`);
    r = await call(emp, "POST", "/api/shift-requests", { date: "2026-09-01", sessionIds: [fullDay.id], reason: "  " });
    check("chặn thiếu lý do", r.status === 400, `(${r.status})`);
    r = await call(emp, "POST", "/api/shift-requests", {
      date: "2026-09-01",
      leaveCode: "N",
      sessionIds: [fullDay.id],
      reason: "vừa nghỉ vừa đổi ca",
    });
    check("chặn vừa xin nghỉ vừa đổi ca", r.status === 400, `(${r.status})`);
    r = await call(emp, "POST", "/api/shift-requests", { date: "2026-09-01", reason: "không chọn gì cả" });
    check("chặn không chọn ca lẫn nghỉ", r.status === 400, `(${r.status})`);
    r = await call(emp, "POST", "/api/shift-requests", { date: "2026-09-01", sessionIds: ["khong-ton-tai"], reason: "ca lạ" });
    check("chặn ca không tồn tại", r.status === 400, `(${r.status})`);
    r = await call(emp, "POST", "/api/shift-requests", { date: "2026-02-31", sessionIds: [fullDay.id], reason: "ngày lạ" });
    check("chặn ngày không tồn tại", r.status === 400, `(${r.status})`);

    r = await call(emp, "GET", "/api/shift-requests?month=2026-09");
    check(
      "nhân viên thấy đúng 1 yêu cầu trong tháng",
      r.status === 200 && r.json.requests?.length === 1 && r.json.requests[0].id === requestId,
      `(${r.json.requests?.length})`
    );
    check("nhân viên không nhận hồ sơ của chính mình trong view", r.json.requests?.[0] && !("user" in r.json.requests[0]));

    const expectedCurrent = [morning, afternoon]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.code);
    r = await call(admin, "GET", "/api/admin/shift-requests");
    const pendingItem = r.json.requests?.find((x) => x.id === requestId);
    check("admin thấy yêu cầu đang chờ kèm nhân viên", r.status === 200 && pendingItem?.user?.id === employeeId, `(${r.status})`);
    check("pendingCount đếm được yêu cầu", r.json.pendingCount >= 1, `(${r.json.pendingCount})`);
    check(
      "currentCodes = ca đang xếp cho ngày đó",
      JSON.stringify(pendingItem?.currentCodes) === JSON.stringify(expectedCurrent),
      `(${JSON.stringify(pendingItem?.currentCodes)} vs ${JSON.stringify(expectedCurrent)})`
    );
    check(
      "requestedCodes = ca muốn đổi sang",
      JSON.stringify(pendingItem?.requestedCodes) === JSON.stringify([fullDay.code]),
      `(${JSON.stringify(pendingItem?.requestedCodes)})`
    );
    check("view admin có nhãn loại hợp đồng", pendingItem?.user?.employmentLabel === "Bán thời gian", `(${pendingItem?.user?.employmentLabel})`);

    r = await call(makeJar(), "PUT", `/api/admin/shift-requests/${requestId}`, { action: "approve" });
    check("khách vãng lai không duyệt được", r.status === 401, `(${r.status})`);
    r = await call(emp, "PUT", `/api/admin/shift-requests/${requestId}`, { action: "approve" });
    check("nhân viên không tự duyệt được", r.status === 401, `(${r.status})`);
    r = await call(admin, "PUT", `/api/admin/shift-requests/${requestId}`, { action: "bay" });
    check("chặn hành động lạ", r.status === 400, `(${r.status})`);
    r = await call(admin, "PUT", `/api/admin/shift-requests/khong-ton-tai`, { action: "approve" });
    check("duyệt yêu cầu không tồn tại -> 404", r.status === 404, `(${r.status})`);

    r = await call(admin, "PUT", `/api/admin/shift-requests/${requestId}`, { action: "approve" });
    check("admin duyệt -> approved", r.status === 200 && r.json.request?.status === "approved", JSON.stringify(r.json).slice(0, 120));
    check(
      "sau duyệt currentCodes = ca mới",
      JSON.stringify(r.json.request?.currentCodes) === JSON.stringify([fullDay.code]),
      `(${JSON.stringify(r.json.request?.currentCodes)})`
    );
    check("có reviewedAt sau khi duyệt", typeof r.json.request?.reviewedAt === "string");
    mail = await waitForMail(sink, EMP_EMAIL, "Yêu cầu đổi ca ngày 01/09 đã được duyệt");
    check("duyệt đổi ca thì báo nhân viên", mail?.text.includes(`sang ${fullDay.code}`), mail?.text);
    r = await call(admin, "PUT", `/api/admin/shift-requests/${requestId}`, { action: "reject" });
    check("yêu cầu đã duyệt không xử lý lại được", r.status === 409, `(${r.status})`);

    r = await call(emp, "GET", "/api/schedule?month=2026-09");
    check(
      "lịch ngày 01/09 đổi sang ca mới",
      JSON.stringify(r.json.days?.["2026-09-01"]) === JSON.stringify([fullDay.id]),
      `(${JSON.stringify(r.json.days?.["2026-09-01"])})`
    );
    check("ngày 01/09 được đánh dấu admin sửa", r.json.adminEdited?.includes("2026-09-01"), `(${JSON.stringify(r.json.adminEdited)})`);

    r = await call(admin, "GET", `/api/admin/attendance/user/${employeeId}?month=2026-09`);
    const day1After = r.json.days?.find((d) => d.date === "2026-09-01");
    check(
      "bảng công ngày 01/09 tính theo ca mới",
      day1After?.adminEdited === true && day1After?.scheduled?.map((s) => s.code).join() === fullDay.code,
      `(${JSON.stringify(day1After?.scheduled?.map((s) => s.code))})`
    );
    // 8h công (08:00–17:00 trừ nghỉ trưa) so với ngưỡng của ca cả ngày.
    check(
      "01/09 vẫn đủ công sau khi đổi ca",
      fullDay.minHours <= 8 ? day1After?.status === "passed" : day1After?.status === "insufficient",
      `(${day1After?.status}, ngưỡng ${fullDay.minHours}h)`
    );

    r = await call(emp, "POST", "/api/shift-requests", { date: ABSENT_DATE, leaveCode: "N", reason: "__smoketest xin nghỉ" });
    const leaveId = r.json.request?.id;
    check(
      "nhân viên xin nghỉ N -> pending",
      r.status === 200 && r.json.request?.status === "pending" && r.json.request?.requestedCodes?.[0] === "N" && Boolean(leaveId),
      JSON.stringify(r.json).slice(0, 120)
    );
    check("xin nghỉ thì sessionIds = null", r.json.request?.sessionIds === null);
    r = await call(admin, "PUT", `/api/admin/shift-requests/${leaveId}`, { action: "reject", note: "  __smoketest thiếu người  " });
    check(
      "admin từ chối kèm ghi chú -> rejected",
      r.status === 200 && r.json.request?.status === "rejected" && r.json.request?.adminNote === "__smoketest thiếu người",
      JSON.stringify(r.json).slice(0, 120)
    );
    mail = await waitForMail(sink, EMP_EMAIL, "Yêu cầu xin nghỉ ngày");
    check("từ chối xin nghỉ thì báo nhân viên kèm ghi chú", mail?.subject.includes("bị từ chối") && mail?.text.includes("__smoketest thiếu người"), mail?.subject);
    r = await call(emp, "GET", "/api/schedule?month=2026-09");
    check(
      "từ chối thì lịch ngày đó giữ nguyên",
      JSON.stringify(r.json.days?.[ABSENT_DATE]) === JSON.stringify([morning.id]) && !r.json.offDays?.includes(ABSENT_DATE),
      `(${JSON.stringify(r.json.days?.[ABSENT_DATE])})`
    );

    r = await call(emp, "POST", "/api/shift-requests", { date: "2026-09-15", sessionIds: [morning.id], reason: "__smoketest sẽ huỷ" });
    const cancelId = r.json.request?.id;
    check("gửi yêu cầu để huỷ", r.status === 200 && Boolean(cancelId), `(${r.status})`);
    r = await call(emp, "DELETE", `/api/shift-requests/${cancelId}`);
    check("nhân viên huỷ yêu cầu đang chờ", r.status === 200 && r.json.success === true, `(${r.status})`);
    r = await call(emp, "DELETE", `/api/shift-requests/${cancelId}`);
    check("huỷ lần nữa -> 404", r.status === 404, `(${r.status})`);
    r = await call(emp, "DELETE", `/api/shift-requests/${requestId}`);
    check("không huỷ được yêu cầu đã duyệt -> 409", r.status === 409, `(${r.status})`);

    r = await call(emp, "GET", "/api/shift-requests?month=2026-09");
    check("nhân viên thấy 2 yêu cầu (đã duyệt + đã từ chối)", r.json.requests?.length === 2, `(${r.json.requests?.length})`);
    r = await call(admin, "GET", "/api/admin/shift-requests?status=all&month=2026-09");
    check(
      "admin xem mọi trạng thái trong tháng",
      r.status === 200 && r.json.requests?.filter((x) => x.user.id === employeeId).length === 2,
      `(${r.json.requests?.filter((x) => x.user?.id === employeeId).length})`
    );
    r = await call(admin, "GET", "/api/admin/shift-requests");
    check("danh sách chờ không còn yêu cầu của nhân viên test", !r.json.requests?.some((x) => x.user.id === employeeId));
    r = await call(admin, "GET", "/api/admin/shift-requests?status=xyz");
    check("chặn bộ lọc trạng thái lạ", r.status === 400, `(${r.status})`);
    r = await call(admin, "GET", "/api/admin/shift-requests?status=all&month=2026-13");
    check("chặn tháng không hợp lệ ở danh sách admin", r.status === 400, `(${r.status})`);

    console.log("\n== nội dung công việc hằng ngày ==");
    // Mọi mốc phải <= giờ hiện tại nên dựng giờ bằng cách lùi từ "bây giờ"
    // theo giờ VN; chạy quá sớm trong ngày thì không đủ chỗ lùi, bỏ qua.
    const nowVN = (() => {
      const [h, m] = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).format(new Date()).split(":").map(Number);
      return h * 60 + m;
    })();
    const hhmm = (minutes) =>
      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

    if (nowVN < 300) {
      console.log("  (bỏ qua: chưa qua 05:00 giờ VN, không đủ chỗ lùi giờ)");
    } else {
      await client.query(`DELETE FROM "WorkReportEntry" WHERE "userId" = $1`, [employeeId]);
      const t0 = hhmm(nowVN - 240);
      const t1 = hhmm(nowVN - 180);
      const t2 = hhmm(nowVN - 120);
      const t3 = hhmm(nowVN - 60);

      r = await call(emp, "POST", "/api/work-reports", { endTime: t1, content: "__smoketest việc 1" });
      check("khoảng đầu tiên thiếu giờ bắt đầu -> 400", r.status === 400, `(${r.status})`);

      r = await call(emp, "POST", "/api/work-reports", { startTime: t0, endTime: t1, content: "ok" });
      check("nội dung quá ngắn -> 400", r.status === 400, `(${r.status})`);

      r = await call(emp, "POST", "/api/work-reports", { startTime: t0, endTime: t1, content: "__smoketest việc 1" });
      check("thêm khoảng đầu tiên", r.status === 200 && r.json.entries?.length === 1, `(${r.status})`);
      check("giờ lưu đúng như khai", r.json.entries?.[0]?.start === t0 && r.json.entries?.[0]?.end === t1);

      r = await call(emp, "POST", "/api/work-reports", { startTime: "00:30", endTime: t2, content: "__smoketest việc 2" });
      check(
        "khoảng sau tự nối tiếp, bỏ qua startTime client gửi",
        r.status === 200 && r.json.entries?.[1]?.start === t1,
        `(${r.json.entries?.[1]?.start})`
      );

      r = await call(emp, "POST", "/api/work-reports", { endTime: t3, content: "__smoketest việc 3" });
      check("thêm khoảng thứ ba", r.status === 200 && r.json.entries?.length === 3, `(${r.status})`);
      const entries = r.json.entries ?? [];

      r = await call(emp, "POST", "/api/work-reports", { endTime: hhmm(Math.min(nowVN + 30, 1439)), content: "__smoketest tương lai" });
      check("chặn khai giờ tương lai", r.status === 400, `(${r.status})`);

      r = await call(emp, "POST", "/api/work-reports", { date: "2026-01-05", endTime: t3, content: "__smoketest ngày cũ" });
      check("chặn khai cho ngày khác hôm nay", r.status === 400, `(${r.status})`);

      // Sửa khoảng 1 (nội dung + co giờ kết thúc): khoảng 2 phải dời theo.
      r = await call(emp, "PATCH", `/api/work-reports/${entries[0].id}`, {
        content: "__smoketest việc 1 (đã sửa)",
        endTime: hhmm(nowVN - 200),
      });
      check("sửa được khoảng đã khai xong", r.status === 200, `(${r.status})`);
      check("khoảng 2 dời giờ bắt đầu theo", r.json.entries?.[1]?.start === hhmm(nowVN - 200), `(${r.json.entries?.[1]?.start})`);
      check("khoảng 3 không bị đụng tới", r.json.entries?.[2]?.start === t2, `(${r.json.entries?.[2]?.start})`);

      r = await call(emp, "PATCH", `/api/work-reports/${entries[0].id}`, { endTime: hhmm(nowVN - 110) });
      check("sửa khoảng 1 nuốt trọn khoảng 2 bị chặn", r.status === 400, `(${r.status})`);
      check("lỗi nói rõ đụng khoảng kế tiếp", (r.json.error ?? "").includes("khoảng kế tiếp"), `("${r.json.error}")`);

      r = await call(emp, "PATCH", `/api/work-reports/${entries[1].id}`, { startTime: t0 });
      check("không sửa được giờ bắt đầu của khoảng giữa", r.status === 400, `(${r.status})`);

      r = await call(emp, "DELETE", `/api/work-reports/${entries[1].id}`);
      check("xoá khoảng giữa", r.status === 200 && r.json.entries?.length === 2, `(${r.status})`);
      check(
        "khoảng sau hút phần thời gian của khoảng đã xoá",
        r.json.entries?.[1]?.start === hhmm(nowVN - 200),
        `(${r.json.entries?.[1]?.start})`
      );

      r = await call(emp, "GET", "/api/work-reports");
      check("nhân viên xem lại tháng này", r.status === 200 && r.json.days?.[0]?.entries?.length === 2, `(${r.status})`);

      r = await call(makeJar(), "GET", "/api/work-reports");
      check("chưa đăng nhập thì không xem được", r.status === 401, `(${r.status})`);

      r = await call(admin, "GET", `/api/admin/work-reports?userId=${employeeId}`);
      check("admin xem được nội dung công việc", r.status === 200 && r.json.entries?.length === 2, `(${r.status})`);
      r = await call(admin, "GET", "/api/admin/work-reports?month=2026-13");
      check("chặn tháng không hợp lệ", r.status === 400, `(${r.status})`);
      r = await call(emp, "GET", "/api/admin/work-reports");
      check("nhân viên không vào được API admin", r.status === 401, `(${r.status})`);

      const csv = await fetch(BASE + `/api/admin/work-reports?userId=${employeeId}&export=csv`, {
        headers: { Cookie: admin.header() },
      });
      const csvText = await csv.text();
      check(
        "xuất CSV",
        csv.status === 200 && (csv.headers.get("content-type") ?? "").includes("text/csv"),
        `(${csv.status})`
      );
      check("CSV có nội dung đã khai", csvText.includes("__smoketest việc 1 (đã sửa)"));
    }

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

    // Cookie cũ của nhân viên vẫn còn hạn nhưng tài khoản đã ngừng: API phải chặn.
    r = await call(emp, "GET", "/api/attendance");
    check("phiên cũ của NV đã ngừng bị chặn", r.status === 403, `(${r.status})`);

    r = await call(admin, "DELETE", `/api/locations/${locationId}`);
    check("xoá vị trí", r.status === 200);
    locationId = null;
  } finally {
    console.log("\n== dọn dẹp ==");
    if (employeeId) {
      // FK cascade cũng xoá theo, nhưng dọn tường minh để không phụ thuộc vào đó.
      await client.query(`DELETE FROM "ShiftChangeRequest" WHERE "userId" = $1`, [employeeId]);
      await client.query(`DELETE FROM "LoginAttempt" WHERE "identifier" LIKE '@_@_smoketest%' ESCAPE '@'`);
      await client.query(`DELETE FROM "WorkReportEntry" WHERE "userId" = $1`, [employeeId]);
      await client.query(`DELETE FROM "User" WHERE "id" = $1`, [employeeId]);
    }
    await client.query(`DELETE FROM "User" WHERE "email" LIKE '__smoketest%'`);
    await client.query(`DELETE FROM "Holiday" WHERE "name" LIKE '__smoketest%'`);
    await client.query(`DELETE FROM "Allowance" WHERE "name" ILIKE '__smoketest%'`);
    await client.query(`DELETE FROM "WorkLocation" WHERE "name" LIKE '__smoketest%'`);
    await client.query(`DELETE FROM "Admin" WHERE "username" = $1`, [ADMIN_USER]);
    if (previousEmail) {
      if (previousEmail.value === undefined) {
        await client.query(`DELETE FROM "Settings" WHERE "key" = 'email_config'`);
      } else {
        await client.query(`UPDATE "Settings" SET "value" = $1 WHERE "key" = 'email_config'`, [previousEmail.value]);
      }
    }
    sink?.server.close();
    await client.query(`DELETE FROM "LoginEvent" WHERE "identifier" ILIKE '%@_@_smoketest%' ESCAPE '@'`);
    // Trả lại cửa sổ đăng ký lịch như trước khi test.
    if (previousWindow) {
      if (previousWindow.value === undefined) {
        await client.query(`DELETE FROM "Settings" WHERE "key" = 'schedule_registration_window'`);
      } else {
        await client.query(
          `UPDATE "Settings" SET "value" = $1 WHERE "key" = 'schedule_registration_window'`,
          [previousWindow.value]
        );
      }
    }
    // Trả lại giờ nghỉ trưa như trước khi test.
    if (previousLunch) {
      if (previousLunch.value === undefined) {
        await client.query(`DELETE FROM "Settings" WHERE "key" = 'lunch_break'`);
      } else {
        await client.query(`UPDATE "Settings" SET "value" = $1 WHERE "key" = 'lunch_break'`, [previousLunch.value]);
      }
    }
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
