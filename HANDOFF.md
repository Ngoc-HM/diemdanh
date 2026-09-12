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
2. Upload lại logo ở `/admin/company` (file nằm ở `public/uploads/`, không commit).
3. Chạy sau HTTPS, và backup database trước khi migrate.

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

Luật UI nằm ở `DESIGN/UI_STYLE_GUIDE.md` — đọc trước khi đụng vào giao diện.
