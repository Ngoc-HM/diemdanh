import "dotenv/config";

/// Quét mọi đường dẫn của giao diện: đăng nhập thật rồi tải từng trang,
/// kiểm tra không có 404 / 500 / lỗi render, và bám đúng redirect.
/// Đây là loại lỗi mà test API không bắt được.

const BASE = process.env.BASE_URL || "http://localhost:3000";
let pass = 0, fail = 0;
const bad = [];

function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; bad.push(`${name} ${detail}`); console.log(`  FAIL ${name} ${detail}`); }
}

function makeJar() {
  const jar = new Map();
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const i = pair.indexOf("=");
        jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
  };
}

async function visit(jar, path) {
  const res = await fetch(BASE + path, {
    headers: jar.header() ? { Cookie: jar.header() } : {},
    redirect: "follow",
  });
  const html = await res.text();
  // Next ở chế độ dev nhúng payload của trang 404 vào flight data của MỌI
  // trang, nên không thể dò 404 bằng cách tìm chuỗi trong toàn bộ HTML.
  // Thẻ <title> mới là thứ phản ánh trang thực sự được render.
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "";
  return { status: res.status, url: new URL(res.url).pathname, html, title };
}

const ADMIN_PAGES = [
  ["/admin/attendance/monthly", "Bảng chấm công"],
  ["/admin/schedules", "Lịch làm việc"],
  ["/admin/shift-requests", "Duyệt đổi ca"],
  ["/admin/overtime", "Làm thêm giờ (OT)"],
  ["/admin/payroll", "Bảng lương"],
  ["/admin/payroll/settings", "Cài đặt lương"],
  ["/admin/work-reports", "Báo cáo công việc"],
  ["/admin/users", "Nhân viên"],
  ["/admin/sessions", "Ca làm việc"],
  ["/admin/locations", "Vị trí làm việc"],
  ["/admin/holidays", "Ngày lễ"],
  ["/admin/company", "Thiết lập công ty"],
  ["/admin/change-password", "Đổi mật khẩu"],
  ["/admin/email", "Email (SMTP)"],
  ["/admin/access-violations", "Truy cập lạ"],
];

const EMPLOYEE_PAGES = [
  ["/dashboard", "Chấm công"],
  ["/dashboard/schedule", "Đăng ký lịch"],
  ["/dashboard/history", "Lịch sử chấm công"],
  ["/dashboard/work-reports", "Nội dung công việc hằng ngày"],
  ["/dashboard/shift-requests", "Chỉnh sửa ca"],
  ["/dashboard/overtime", "Làm thêm giờ (OT)"],
  ["/dashboard/settings", "Cài đặt"],
];

async function main() {
  const anon = makeJar();
  const admin = makeJar();

  console.log("\n== trang công khai ==");
  for (const [path, marker] of [
    ["/login", "Chấm công nội bộ"],
    ["/forgot-password", "Quên mật khẩu"],
    ["/desktop-only", "Chỉ hỗ trợ máy tính"],
  ]) {
    const r = await visit(anon, path);
    check(`${path} tải được`, r.status === 200, `(${r.status})`);
    check(`${path} render đúng trang`, r.html.includes(marker) && !r.title.startsWith("404"), `(title="${r.title}")`);
  }
  let r = await visit(anon, "/");
  check("/ chuyển về /login", r.url === "/login", `(-> ${r.url})`);
  r = await visit(anon, "/admin-login-app");
  check("/admin-login-app (link cũ) về /login", r.url === "/login", `(-> ${r.url})`);
  r = await visit(anon, "/reset-password");
  check("/reset-password (link cũ) về /forgot-password", r.url === "/forgot-password", `(-> ${r.url})`);

  console.log("\n== chặn điện thoại ==");
  const mobile = await fetch(BASE + "/login", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    },
    redirect: "follow",
  });
  const mobilePath = new URL(mobile.url).pathname;
  check("điện thoại bị đưa sang /desktop-only", mobilePath === "/desktop-only", `(-> ${mobilePath})`);
  const android = await fetch(BASE + "/forgot-password", {
    headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36" },
    redirect: "follow",
  });
  check("Android cũng bị chặn", new URL(android.url).pathname === "/desktop-only");
  const desktop = await visit(anon, "/login");
  check("máy tính vào /login bình thường", desktop.url === "/login", `(-> ${desktop.url})`);

  console.log("\n== chặn khi chưa đăng nhập ==");
  r = await visit(anon, "/admin/attendance/monthly");
  check("/admin/* đá về /login", r.url === "/login", `(-> ${r.url})`);
  r = await visit(anon, "/dashboard");
  check("/dashboard đá về /login", r.url === "/login", `(-> ${r.url})`);

  console.log("\n== đăng nhập admin ==");
  const login = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: process.env.AUTH_ADMIN_USERNAME,
      password: process.env.AUTH_ADMIN_PASSWORD,
    }),
  });
  admin.absorb(login);
  check("đăng nhập bằng tài khoản trong .env", login.status === 200, `(${login.status})`);

  console.log("\n== các trang quản trị ==");
  for (const [path, marker] of ADMIN_PAGES) {
    const page = await visit(admin, path);
    check(`${path}`, page.status === 200 && page.url === path, `(${page.status} -> ${page.url})`);
    check(
      `  └ hiện đúng nội dung "${marker}"`,
      page.html.includes(marker) && !page.title.startsWith("404"),
      `(title="${page.title}")`
    );
  }

  const sessionsPage = await visit(admin, "/admin/sessions");
  check("trang ca làm việc có thẻ giờ nghỉ trưa", sessionsPage.html.includes("Giờ nghỉ trưa"));
  check("trang ca làm việc không còn cột nhận check-in", !sessionsPage.html.includes("Nhận check-in"));
  const clickupTag = sessionsPage.html.match(/<a[^>]*app\.clickup\.com[^>]*>/)?.[0] ?? "";
  check(
    "menu quản trị có link ClickUp mở tab mới",
    clickupTag.includes('target="_blank"') && clickupTag.includes("noopener"),
    `(${clickupTag.slice(0, 200) || "không thấy link"})`
  );

  console.log("\n== đường dẫn rút gọn & link cũ ==");
  const shortcuts = [
    ["/admin", "/admin/attendance/monthly"],
    ["/admin/attendance", "/admin/attendance/monthly"],
    ["/admin-dashboard", "/admin/attendance/monthly"],
    ["/admin-dashboard/attendance", "/admin/attendance/monthly"],
    ["/admin-dashboard/attendance/monthly", "/admin/attendance/monthly"],
    ["/admin-dashboard/company", "/admin/attendance/monthly"],
  ];
  for (const [from, to] of shortcuts) {
    const page = await visit(admin, from);
    check(`${from} -> ${to}`, page.url === to && page.status === 200, `(${page.status} -> ${page.url})`);
  }

  console.log("\n== các trang nhân viên ==");
  // Trang nhân viên chỉ mở được khi đã đăng nhập, nên dựng một tài khoản tạm
  // rồi xoá cứng ngay sau đó (chưa có ngày công nên xoá được).
  const EMP_EMAIL = "__smoketest_routes@example.test";
  const EMP_PASS = "SmokeTest12345";
  let tempUserId = null;
  try {
    const created = await fetch(BASE + "/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: admin.header() },
      body: JSON.stringify({
        name: "__smoketest routes",
        email: EMP_EMAIL,
        password: EMP_PASS,
        employmentType: "full_time",
      }),
    });
    const createdJson = await created.json().catch(() => ({}));
    tempUserId = createdJson?.user?.id ?? null;
    check("tạo được nhân viên tạm để kiểm trang", created.status === 200 && Boolean(tempUserId), `(${created.status})`);

    if (tempUserId) {
      const employee = makeJar();
      const empLogin = await fetch(BASE + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMP_EMAIL, password: EMP_PASS }),
      });
      employee.absorb(empLogin);
      check("nhân viên tạm đăng nhập được", empLogin.status === 200, `(${empLogin.status})`);

      for (const [path, marker] of EMPLOYEE_PAGES) {
        const page = await visit(employee, path);
        check(`${path}`, page.status === 200 && page.url === path, `(${page.status} -> ${page.url})`);
        check(
          `  └ hiện đúng nội dung "${marker}"`,
          page.html.includes(marker) && !page.title.startsWith("404"),
          `(title="${page.title}")`
        );
      }
    }
  } finally {
    if (tempUserId) {
      await fetch(BASE + `/api/users/${tempUserId}?hard=true`, {
        method: "DELETE",
        headers: { Cookie: admin.header() },
      });
    }
  }

  console.log("\n== trang không tồn tại & cảnh báo ==");
  const missing = await fetch(BASE + "/admin/khong-co-trang-nay", {
    headers: { Cookie: admin.header() },
  });
  const missingHtml = await missing.text();
  check("đường dẫn lạ trả 404 đúng cách", missing.status === 404, `(${missing.status})`);
  check(
    "404 hiện trang cảnh báo",
    missingHtml.includes("đã được ghi lại và báo cáo với quản trị viên"),
    "(không thấy nội dung cảnh báo)"
  );
  const warned = await visit(anon, "/canh-bao?path=/admin/users");
  check("trang cảnh báo mở được", warned.status === 200 && warned.url === "/canh-bao", `(${warned.status} -> ${warned.url})`);
  check("cảnh báo nói rõ không đủ quyền", warned.html.includes("Bạn không có quyền vào khu vực này"));

  console.log(`\n===== ${pass} đạt / ${fail} hỏng =====`);
  if (bad.length) bad.forEach((f) => console.log(" -", f));
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("LỖI:", e);
  process.exit(1);
});
