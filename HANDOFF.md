# Bàn giao cho phiên tiếp theo (đọc trước khi làm gì)

Repo: `company_management/` (Next.js 15 + Postgres, SQL viết tay). Đọc
`company_management/README.md` để nắm nghiệp vụ. Không dùng ORM.

## Trạng thái hiện tại (03/09/2026)

Toàn bộ code đang **chưa commit** (~60 file thay đổi/mới). Đã kiểm chứng:
`npm run typecheck`, `npm run lint`, `npm run build` sạch; `test:logic` 54/54,
`test:api` 77/77, `test:routes` 42/42 (hai test sau cần `npm run dev` đang chạy).

Việc đã làm trong phiên này:
- Trang đăng ký lịch chuyển sang chỉ xem ngoài cửa sổ 20 → cuối tháng.
- Admin xếp lịch được cho cả nhân viên full-time (tháng nào admin xếp thì dùng
  lịch đó, không thì tự sinh).
- Xoá cứng nhân viên (đã ngừng, chưa có công) trên UI.
- Nhân viên đã ngừng hoạt động bị chặn ngay ở API kế tiếp, cookie bị xoá.
- Nhân viên tự đổi mật khẩu: `/dashboard/change-password`.
- Quên mật khẩu qua email: `/forgot-password` → `/reset-password?token=` (bảng
  `PasswordReset`, migration 007).
- Admin cấu hình SMTP ở `/admin/email` (lưu bảng `Settings`, mật khẩu mã hoá
  AES bằng khoá từ `AUTH_SECRET`). Có nút gửi thử và "Gửi nhắc ngay".
- Email nhắc đăng ký lịch tự động từ ngày 20: `instrumentation.ts` →
  `lib/reminder-scheduler.ts` → `lib/reminder.ts`, kiểm tra mỗi giờ, mỗi tháng
  gửi một lần (đánh dấu ở `Settings.schedule_reminder_sent`).
- Chặn điện thoại/máy tính bảng: `middleware.ts` đưa sang `/desktop-only`
  (theo User-Agent; iPad đời mới tự nhận là Mac nên không chặn được).

## Đợt 08/09/2026 (sau khi chủ dự án thử app)

- `AUTH_SECRET` đã đổi (64 ký tự). Lưu ý: sửa `.env` khi dev server đang chạy
  thì middleware giữ khoá cũ còn API dùng khoá mới → đăng nhập xong bị đá về
  trang login. Phải khởi động lại `npm run dev`.
- Hai trang đăng nhập chuyển hướng bằng `window.location.assign` (tải lại cả
  trang) để không kẹt ở "Đang đăng nhập...".
- SMTP OneMail đã gửi được (SPF/DKIM/DMARC đều pass); thư đầu vào Spam Gmail
  do uy tín tên miền mới, không phải lỗi cấu hình.
- Header hiện đủ tên công ty; bỏ chú thích "Ô nền vàng" ở trang đăng ký lịch.
- **Luật mới**: ngày quên đăng ký mà có đủ vào/ra vẫn tính ngày công
  (`countsAsWorkDay` trong `evaluateDay`), tô vàng; vắng tô đỏ.
- **Yêu cầu đổi ca** (bảng `ShiftChangeRequest`, migration 009): nhân viên gửi
  ở `/dashboard/shift-requests`, admin duyệt ở `/admin/shift-requests`; duyệt
  → ghi `DayMark` như admin chấm tay; đang chờ → ô vàng. Chi tiết trong README.

## Đợt 12/09/2026 — Nội dung công việc hằng ngày

- Nhân viên khai việc theo **chuỗi khoảng thời gian liền mạch** ở tab mới
  `/dashboard/work-reports`; admin xem ở `/admin/work-reports` (lọc tháng /
  nhân viên / ngày, xuất CSV) và ở nút nội dung công việc trong trang chi tiết
  nhân viên. Bảng `WorkReportEntry` (migration 010), luật ở `lib/work-reports.ts`.
- Chỉ khai và sửa được **trong ngày hôm nay**; hết ngày là chốt sổ, không ai
  sửa được nữa (kể cả admin — cố tình, xem "Chưa làm" trong README).
- Sửa được mọi khoảng trong ngày: dời giờ kết thúc của khoảng i cũng dời giờ
  bắt đầu của khoảng i+1; nuốt trọn khoảng kế tiếp thì API từ chối và nói rõ.
  Xoá khoảng giữa thì khoảng sau hút phần thời gian đó.
- Không đụng vào `evaluateDay` / cách tính giờ công. `ui.tsx` có thêm
  `Textarea` dùng chung (trang Chỉnh sửa ca đã chuyển sang dùng).
- Test: `test:logic` 95/95, `test:api` 148/148, `test:routes` 61/61 (routes giờ
  dựng một nhân viên tạm để kiểm cả các trang `/dashboard/*`).

## Đợt 12/09/2026 — Cửa sổ đăng ký lịch đặt được

- Ngày mở/đóng đăng ký lịch tháng sau không còn chôn cứng ngày 20: admin đặt ở
  trang **Lịch làm việc** (thẻ "Cửa sổ đăng ký lịch tháng sau"), lưu ở Settings
  `schedule_registration_window` dạng `"20-31"` (migration 011 seed mặc định).
- Ngày lớn hơn số ngày của tháng thì tự lùi về ngày cuối tháng, nên 31 = hết
  tháng kể cả tháng 2. Ngày đóng phải >= ngày mở.
- `lib/schedule.ts`: các hàm `openRegistrationMonth` / `isRegistrationOpen` /
  `registrationWindow` / `scheduleWindowState` giờ nhận thêm tham số cấu hình
  (vẫn thuần, test được); route và `lib/reminder.ts` đọc cấu hình qua
  `getRegistrationWindowConfig()` trong `lib/attendance-service.ts`.
- Email nhắc đăng ký và các câu mô tả trên giao diện đi theo cấu hình này.
- **Không** mở đăng ký cho full-time: họ vẫn dùng lịch tự sinh trừ ngày nghỉ
  hằng tuần (quyết định của chủ dự án).
- Test: `test:logic` 113/113, `test:api` 161/161, `test:routes` 61/61.

## Đợt 12/09/2026 — Rà soát trước khi lên production

Đã sửa:

- **Cấu hình chấm công trên DB** (qua API admin, không sửa thẳng DB). Trước khi
  sửa: nghỉ trưa 12:00–13:30 nhưng ca chiều bắt đầu 13:00, nên khoảng 13:00–13:30
  vừa nằm trong ca vừa bị trừ như giờ nghỉ; cộng thêm ngưỡng đặt bằng đúng độ
  dài ca nên **mọi ngày công đều bị chấm "Thiếu giờ"** (cả ngày 08:00–17:00 chỉ
  được 7,5h so với ngưỡng 8h). Chủ dự án xác nhận công ty nghỉ trưa tới 13:30,
  nên dời ca chiều cho khớp thay vì rút giờ nghỉ:

  | | Trước | Sau |
  |---|---|---|
  | Nghỉ trưa | 12:00–13:30 | 12:00–13:30 (giữ) |
  | S | 08:00–12:00 · 4h | 08:00–12:00 · **3,5h** |
  | C | 13:00–17:00 · 4h | **13:30**–17:00 · **3h** |
  | CN | 08:00–17:00 · 8h | 08:00–17:00 · **7h** |
  | T | 18:00–21:00 · 3h | 18:00–21:00 · **2,5h** |

  Ngưỡng thấp hơn giờ làm thực 30 phút để ra sớm một chút vẫn đủ công. Đổi lại
  được bất cứ lúc nào ở `/admin/sessions` — **luật bất di bất dịch: giờ tan nghỉ
  trưa phải bằng giờ vào ca chiều**, lệch là giờ công sai.
- **Bỏ hẳn mật khẩu quản trị mặc định `admin123`**: `scripts/seed.ts` dừng nếu
  thiếu `AUTH_ADMIN_PASSWORD`, và `/api/auth/admin-login` không còn đường khởi
  tạo bằng mật khẩu đoán được (mục 4 phần "Việc còn lại" cũ coi như đã xử lý).
- `AUTH_SECRET` phải **≥ 32 ký tự** ở production, nếu không app dừng khi khởi
  động (`lib/session-token.ts`).
- Thêm `.env.example` và mục **Triển khai production** trong README (biến môi
  trường, thứ tự chạy, HTTPS bắt buộc, việc phải làm trong giao diện sau khi bật).
- `POST /api/work-reports` bấm lưu hai lần cùng lúc trả 409 thay vì 500.

Còn phải làm bằng tay khi lên production (không làm hộ được):

1. Điền **Đường dẫn ứng dụng** ở `/admin/email` bằng tên miền thật, rồi bấm
   "Gửi thử" và thử luồng quên mật khẩu.
2. Upload lại logo ở `/admin/company` (file nằm ở `UPLOAD_DIR`, mặc định
   `storage/uploads/`, không commit).
3. Chạy sau HTTPS, và backup database trước khi migrate.

## Đợt 29/09/2026 — Rà soát trước triển khai (lần 2)

- Logo và ảnh đại diện chuyển từ `public/uploads/` sang `UPLOAD_DIR` (mặc định
  `storage/uploads/`), phục vụ qua `app/uploads/[file]/route.ts`. Lý do: `next
  start` chỉ quét `public/` lúc khởi động, ảnh upload sau đó 404 tới khi restart.
- `/api/auth/reset-password` giữ lượt thử bằng một câu UPDATE trước khi so mã;
  trước đây bắn song song thì mỗi request được một lượt, vượt ngưỡng 5.
- `lib/db.ts` nghe `pool.on("error")` để Postgres rớt kết nối không làm sập Node.
- Test: `test:logic` 113/113, `test:api` 212/212, `test:routes` 67/67, chạy trên
  bản `next start` với `TZ=UTC` và Postgres chạy trong Docker.
- **Gộp đăng nhập**: admin và nhân viên dùng chung `/login`, một ô "Email hoặc
  tên đăng nhập"; `/api/auth/login` (logic ở `lib/auth-login.ts`) tìm tên đăng
  nhập trong bảng `Admin` trước (admin cũ `admin` vẫn dùng được), không có thì
  tìm email nhân viên; trả `redirect` theo vai trò. Bỏ trang `/admin-login-app`
  (chuyển hướng về `/login`) và API `/api/auth/admin-login`. Email nhân viên
  không được trùng tên đăng nhập admin (409).
- **Deploy bằng Docker, khép kín trên một máy**: `docker-compose.yml` gồm app
  (`Dockerfile`: build, mỗi lần start `npm run db && npm start`), db (Postgres
  18, volume `db-data`, chỉ mở 127.0.0.1:5433) và proxy (Caddy HTTPS, profile
  `proxy`, `Caddyfile`). App luôn dùng container db; cần `POSTGRES_PASSWORD`.
  Cookie phiên vẫn `secure` — không có HTTPS thật thì dùng Caddy `tls internal`.
- **Đã deploy 29/09/2026** lên VPS `dev_teams@100.116.216.43` (Ubuntu 24.04, vào
  bằng SSH key, không có sudo), thư mục `~/company_management`, `.env` riêng trên
  VPS (khoá sinh ngẫu nhiên, chmod 600). Truy cập https://100.116.216.43 (Tailscale)
  hoặc https://192.168.1.28 (LAN), chứng chỉ tự ký. Database mới trống, chưa cấu
  hình SMTP nên chưa gửi email. VPS còn chạy bộ `cer-*` (cổng 3030) — không đụng.
  Cập nhật: rsync code (bỏ node_modules, .next, .env, storage) rồi
  `docker compose up -d --build` trên VPS.

## Đợt 05/10/2026 — Chuẩn hoá ngày công (bước A của phân hệ lương)

Chủ dự án gửi file bảng lương kế toán (T9.2026, có dữ liệu cá nhân — không đưa
vào repo). Đã chốt và làm xong phần chấm công, chi tiết luật ở README → "Ngày
công":
- Ca có `workdayValue` (migration 016): S/C = 0,5, CN = 1, T = 0. Ngày công cộng
  theo số này; ngày công tháng = ngày không phải nghỉ hằng tuần, tính cả lễ.
- Nghỉ lễ có lịch vẫn được công. Thiếu giờ vẫn đủ công, admin xem lại ✓/✗ (bảng
  `DayReview`, API `/api/admin/attendance/day-review`). Full-time làm ngày nghỉ
  không lịch = 0 công (phải có phiếu OT).
- Excel cả công ty theo ký hiệu kế toán (`x`, `x/2`, mã ca) + cột Ngày công tháng;
  thêm Excel từng nhân viên. Ngày nghỉ hằng tuần chuyển sang trang Lịch làm việc.
- Test: `test:logic` 145/145, `test:api` 235/235, `test:routes` 66/66.

**Còn làm (đã chốt với chủ dự án):**
- ~~B. Phiếu OT~~ **xong** (xem dưới).
- ~~C. Lương~~ **xong 06/10/2026, chưa deploy** — xem dưới.
- **Đã deploy bước A + B lên VPS 06/10/2026** (migration 016, 017 chạy xong). Backup trước khi deploy: `~/backups/company_mana-20261006-030508.sql` trên VPS. Lệnh rsync dùng `--include .env.example --exclude ".env*"` để không xoá `.env` và `.env.bak-*` trên VPS.

**Bước B — Phiếu OT (xong 05/10/2026):** bảng `OvertimeRequest` + Settings
`overtime_config` (migration 017), `lib/overtime.ts` (thuần, có test) và
`lib/overtime-service.ts`. Trang `/dashboard/overtime`, `/admin/overtime`. Luật ở
README → "Làm thêm giờ (OT)". Ca `T` (Tăng ca) cũ vẫn còn trong danh mục ca với
số công 0 — nên tắt để khỏi lẫn với ký hiệu OT `T` (chưa tắt, chờ chủ dự án).
Test: `test:logic` 166/166, `test:api` 262/262, `test:routes` 70/70.

**Bước C — Bảng lương (xong 06/10/2026, chưa deploy):** migration 018
(`PayProfile`, `Allowance`, `EmployeeAllowance`, `PayrollClosing`, Settings
`payroll_config`). `lib/payroll.ts` (thuần, test đối chiếu file kế toán T9 khớp
từng đồng), `lib/payroll-service.ts`, `lib/payroll-export.ts`; phần tính bảng công
tháng tách ra `lib/attendance-month.ts` dùng chung. Trang `/admin/payroll`,
`/admin/payroll/settings`. Luật ở README → "Bảng lương". Test: `test:logic`
203/203, `test:api` 288/288, `test:routes` 74/74.
Thêm GROSS / NET từng người (migration 019): NET quy ngược ra gross, công ty
chịu thuế và BH phần người lao động. Test sau khi thêm: `test:logic` 213/213,
`test:api` 289/289, `test:routes` 74/74.
Cần kế toán xác nhận: giảm trừ 15,5tr / 6,2tr, biểu thuế 5 bậc 5–35%, ngưỡng
khấu trừ 10% (đang để 0 cho khớp file, luật là 2tr), BH tính trên lương cơ bản
không chặn trần.

## Việc còn lại

1. **Chưa test gửi email thật.** Cần vào `/admin/email`, nhập SMTP thật, bấm
   "Gửi thử", rồi thử luồng quên mật khẩu và "Gửi nhắc ngay" với một hộp thư
   thật. Nếu SMTP báo lỗi, thông báo lỗi gốc của nodemailer được trả nguyên
   về UI để dễ chỉnh cổng/TLS.
2. **Đã quyết định (06/09/2026)** về hai cột giờ check-in: nhân viên bấm giờ
   lúc nào cũng được, bỏ hẳn `checkInStart`/`checkInEnd` (migration 008). Giờ
   công = vào → ra muộn nhất, **trừ giờ nghỉ trưa chung** (Settings
   `lunch_break`, admin đặt hoặc tắt ở `/admin/sessions`, seed mặc định
   12:00–13:30). Ngưỡng `minHours` của ca phải đặt theo giờ làm thực; bộ ca mặc
   định đã đổi theo (S 08:30–12:00/3h, C 13:30–17:30/3.5h, CN 08:30–17:30/7h).
   Ngưỡng trên DB đã hạ theo luật mới ngày 12/09 (xem đợt rà soát ở trên).
   Cùng đợt: thêm mục **ClickUp** (mở app.clickup.com ở tab mới) vào menu admin
   và nhân viên.
3. Không cần: rate-limit, CI, giao diện điện thoại, ràng buộc DB cho check-in
   trùng (đã quyết định giữ ở tầng ứng dụng).

## Cách chạy nhanh

```bash
cd company_management && npm run dev      # tự migrate + seed
npm run test:logic && npm run test:api && npm run test:routes
```

**Không chạy hai tiến trình Next cùng lúc trên repo này.** `next build` hoặc một
`next dev` thứ hai (dù ở cổng khác) đều ghi đè thư mục `.next` mà dev server đang
dùng, làm server đang chạy trả 500 hàng loạt và test hỏng theo. Muốn build hoặc
soi header thì tắt dev server trước.

Luật UI nằm ở `DESIGN/DESIGN_SYSTEM_VN.md` (bản tiếng Anh: `DESIGN_SYSTEM.md`) — đọc trước khi đụng vào giao diện.
