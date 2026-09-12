# Hệ thống chấm công nội bộ

Đăng ký lịch làm việc theo tháng + chấm công bằng GPS, cho doanh nghiệp nhỏ.
Next.js 15 (App Router) · PostgreSQL (driver `pg`, SQL viết tay) · Tailwind CSS 4.

Không dùng ORM: mọi truy vấn là SQL trong route, đi qua `lib/db.ts`.

## Nghiệp vụ

### Ba loại hợp đồng

| Loại | Lịch làm việc |
|---|---|
| Toàn thời gian (`full_time`) | Hệ thống tự sinh cho mọi ngày không phải ngày nghỉ hằng tuần (mặc định T7 và CN, admin chỉnh ở trang Ngày lễ) với ca được đánh dấu "mặc định full-time". Không phải đăng ký. Admin xếp lịch riêng cho một tháng thì tháng đó dùng lịch admin xếp. |
| Bán thời gian (`part_time`) | Tự đăng ký từng ca cho từng ngày trong tháng. |
| Thực tập (`intern`) | Như bán thời gian. |

### Cửa sổ đăng ký lịch

Nhân viên bán thời gian và thực tập đăng ký lịch của **tháng T+1** trong một
khoảng ngày của **tháng T**. Ngoài khoảng đó API từ chối lưu và giao diện chuyển
sang chế độ chỉ xem. Admin sửa được lịch bất cứ lúc nào.

Khoảng này do admin đặt ở trang **Lịch làm việc** (`/admin/schedules`): ngày mở
và ngày đóng, mặc định **20 → 31** tức từ ngày 20 đến hết tháng. Giá trị lưu ở
Settings `schedule_registration_window` dạng `"20-31"`.

- Đặt ngày nào lớn hơn số ngày của tháng thì hệ thống tự lùi về ngày cuối tháng
  — vì vậy 31 luôn có nghĩa là "hết tháng", kể cả tháng 2.
- Ngày đóng phải từ ngày mở trở đi; đặt hai ngày bằng nhau là cửa sổ chỉ mở
  đúng một ngày.
- Email nhắc đăng ký lịch đi theo đúng ngày mở này, không còn chôn cứng ngày 20.
- Full-time **không** đăng ký: lịch do hệ thống sinh theo ngày nghỉ hằng tuần,
  nên cửa sổ này không liên quan tới họ.

Không có bước duyệt: nhân viên lưu là lịch có hiệu lực ngay.

### Chấm công

Mỗi lần bấm giờ là một dòng `AttendancePunch` (`in` hoặc `out`). Mỗi ngày chỉ
check-in **một lần**; check-out bấm bao nhiêu lần cũng được và hệ thống lấy lần
muộn nhất làm giờ ra. Không giới hạn giờ được bấm: vào lúc nào cũng được, chỉ có
mốc `workStart` của ca dùng để ghi nhận đi muộn.

Giờ công = **từ lúc vào tới lần ra muộn nhất, trừ phần rơi vào giờ nghỉ trưa**
(`pairPunches` trong `lib/attendance-rules.ts`). Giờ nghỉ trưa là một mốc chung
của công ty (Settings `lunch_break`), admin đặt hoặc tắt ở trang Ca làm việc,
mặc định 12:00–13:30. Ai làm cả ngày chỉ cần vào buổi sáng và ra buổi chiều,
không phải bấm giờ cho bữa trưa: vào 08:30 ra 17:30 được tính 7,5 giờ. Ngày đủ
công khi giờ công đạt tổng `minHours` của các ca đã đăng ký — ngưỡng này vì thế
phải đặt theo giờ làm thực, ví dụ ca sáng 08:30–12:00 dài 3,5 giờ thì đặt 3 giờ.

Vị trí bắt buộc nằm trong bán kính của một `WorkLocation` đang bật, nếu không API
từ chối. Trường hợp sai vị trí hoặc quên bấm giờ thì admin bổ sung tay ở trang chi
tiết nhân viên (các dòng nhập tay được đánh dấu `isManual`).

### Bảng chấm công gửi kế toán

`/admin/attendance/monthly` → nút **Xuất Excel** tải file `.xlsx` của tháng đang
xem: mỗi nhân viên một dòng (mã NV, họ tên, email, loại hợp đồng), mỗi ngày một
ô ký hiệu, rồi các cột tổng **Ngày công · Đi muộn · Vắng · Nghỉ (N) · Ốm (O) ·
Tổng giờ** và số ngày theo từng mã ca. Không có giờ vào/ra chi tiết — muốn xem
thì vào trang chi tiết nhân viên.

Ô ngày tô màu theo trạng thái (xanh đủ công, vàng cần để ý, đỏ vắng, xám nghỉ),
dòng tiêu đề và hai cột đầu được khoá để cuộn ngang qua 31 ngày vẫn đọc được.
Ký hiệu trong ô lấy từ `dayCellLabel` (`lib/attendance-rules.ts`): mã ca (`S`,
`C`, `CN`, ghép `S+C`), `*` đi muộn, `!` thiếu giờ, `N` nghỉ, `O` ốm, `V` vắng,
`NL` làm ngoài lịch, `L` nghỉ lễ, `?` quên checkout, ô trống là không có lịch.

### Cách xếp loại một ngày

| Trạng thái | Điều kiện |
|---|---|
| Đủ công | Có lịch, đủ số giờ tối thiểu, vào ca đúng giờ |
| Đi muộn | Đủ giờ nhưng check-in sau `workStart` quá 5 phút |
| Thiếu giờ | Có lịch, giờ làm chưa đạt tổng `minHours` của các ca đăng ký |
| Đang làm | Hôm nay đã check-in, chưa có lần check-out nào |
| Quên checkout | Ngày đã qua mà chỉ có `in`, không có `out` — không tính giờ công, chờ admin bổ sung giờ ra |
| Vắng | Có lịch nhưng không có lần bấm giờ nào — tô **đỏ** ở mọi bảng để phân biệt với nghỉ N đã xin |
| Nghỉ | Nhân viên tự chọn `N` khi đăng ký lịch, hoặc admin đánh dấu `N` — không đòi giờ công, không tính là ngày công |
| Ốm | Admin đánh dấu `O` — xử lý như ngày nghỉ |
| Ngoài lịch | Quên đăng ký nhưng vẫn đi làm, có cả giờ vào lẫn giờ ra — **vẫn tính đủ một ngày công** theo giờ thực tế (không có ngưỡng để so), tô **vàng** để admin để ý; admin muốn có mã ca cho bảng lương thì bấm vào ô để gán ca |
| Nghỉ lễ | Ngày nằm trong bảng `Holiday` — không bị tính vắng |
| Không có lịch | Không đăng ký ca nào và cũng không có lần bấm giờ nào |

Mọi chỗ đếm "ngày công" dùng cờ `countsAsWorkDay` của `evaluateDay`, không so
sánh trạng thái bằng tay.

Múi giờ chốt cứng ở `Asia/Ho_Chi_Minh` (`lib/datetime.ts`), không phụ thuộc giờ
máy chủ — đây là lý do mọi khoá ngày đều đi qua `dateKeyVN()`.

### Yêu cầu đổi ca

Nhân viên muốn đổi ca đã đăng ký của một ngày (ví dụ đăng ký S nhưng làm CN)
hoặc xin nghỉ N một ngày đã có lịch thì vào tab **Chỉnh sửa ca**
(`/dashboard/shift-requests`): chọn ngày, chọn ca muốn đổi sang hoặc N, ghi lý
do. Mỗi ngày chỉ có một yêu cầu đang chờ; gửi lại thì ghi đè. Admin duyệt ở
**Duyệt đổi ca** (`/admin/shift-requests`):

- **Duyệt** → hệ thống ghi một `DayMark` y như admin tự chấm lại ô đó
  (`isAdminEdit = true`), lịch ngày đó đổi theo và ô thành màu vàng.
- **Từ chối** (có thể kèm ghi chú) → lịch giữ nguyên, không tô gì.
- **Đang chờ** → ô ngày đó tô vàng ở mọi lưới để cả hai bên biết đang treo.

Bảng `ShiftChangeRequest` (migration 009). Quên đăng ký mà vẫn đi làm thì
**không cần** gửi yêu cầu: ngày đó tự tính công (xem "Ngoài lịch" ở trên).

Màu nền dùng thống nhất: **vàng** = admin đã sửa, chờ duyệt đổi ca, hoặc làm
ngoài lịch; **đỏ** = có lịch mà không đi.

### Nội dung công việc hằng ngày

Nhân viên khai ngày làm việc thành một **chuỗi khoảng thời gian liền mạch** ở
tab **Nội dung công việc** (`/dashboard/work-reports`): ngồi vào làm lúc 08:25,
xong việc đầu lúc 09:30 thì việc kế tiếp bắt đầu đúng 09:30, cứ thế tiếp. Mỗi
khoảng kèm một ô mô tả việc đã làm.

- Chỉ khoảng **đầu tiên** trong ngày mới nhập giờ bắt đầu (gợi ý sẵn giờ
  check-in); các khoảng sau nối thẳng vào giờ kết thúc của khoảng trước.
- Không có kẽ hở: nghỉ trưa hay ra ngoài cũng khai thành một khoảng.
- Không khai được giờ **tương lai**; ca qua nửa đêm chưa hỗ trợ.
- **Chỉ khai và sửa được trong ngày hôm nay** (giờ VN). Hết ngày là chốt sổ,
  hôm sau chỉ còn xem lại — kể cả nhân viên lẫn admin đều không sửa được nữa.
- Sửa được **mọi khoảng** trong ngày, không chỉ khoảng cuối. Dời giờ kết thúc
  của một khoảng cũng là dời giờ bắt đầu của khoảng kế tiếp; nếu giờ mới nuốt
  trọn khoảng kế tiếp thì hệ thống từ chối và chỉ rõ đụng vào đâu.
- Xoá một khoảng ở giữa thì khoảng kế tiếp hút phần thời gian đó, chuỗi vẫn
  liền mạch.

Admin chỉ xem: trang **Báo cáo công việc** (`/admin/work-reports`) lọc theo
tháng / nhân viên / ngày và xuất CSV; trang chi tiết nhân viên có nút mở nội
dung công việc của từng ngày. Bảng `WorkReportEntry` (migration 010). Phần này
**không** tham gia vào việc tính giờ công hay xếp loại ngày.

### Email

Admin cấu hình SMTP ở `/admin/email`. Cấu hình lưu trong bảng `Settings`, mật
khẩu SMTP mã hoá bằng khoá dẫn xuất từ `AUTH_SECRET` (đổi `AUTH_SECRET` thì
phải nhập lại mật khẩu SMTP). Email dùng cho hai việc:

- **Quên mật khẩu**: nhân viên nhập email ở `/forgot-password`, nhận link đặt
  lại có hiệu lực 60 phút (bảng `PasswordReset`, chỉ lưu băm của token).
- **Nhắc đăng ký lịch**: từ ngày 20 hằng tháng, server tự gửi email cho nhân viên
  bán thời gian và thực tập, mỗi tháng một lần. Bộ đếm chạy trong tiến trình
  server (`instrumentation.ts` → `lib/reminder.ts`), kiểm tra mỗi giờ. Admin
  bật/tắt hoặc bấm "Gửi nhắc ngay" ở trang Email.

Nhân viên tự đổi mật khẩu ở `/dashboard/change-password`.

## Cài đặt

### 1. Cấu hình `.env`

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/company_mana"
AUTH_SECRET="chuỗi ngẫu nhiên đủ dài"
AUTH_ADMIN_USERNAME="admin"
AUTH_ADMIN_PASSWORD="đổi-mật-khẩu-này"
```

Có sẵn mẫu ở [.env.example](./.env.example).

`AUTH_ADMIN_*` chỉ dùng để tạo tài khoản quản trị **lần đầu**. Sau khi bảng
`Admin` đã có bản ghi, đổi mật khẩu phải làm ở `/admin/change-password` — sửa
`.env` lúc đó không còn tác dụng. Không có mật khẩu mặc định: thiếu
`AUTH_ADMIN_PASSWORD` thì `npm run seed` dừng lại và trang đăng nhập quản trị
từ chối mọi lần thử.

### 2. Cài đặt và khởi tạo database

```bash
npm install
npm run dev
```

Chỉ vậy thôi. `npm run dev` tự chạy `npm run db` trước, việc này sẽ:

1. tạo database nếu chưa có
2. chạy các migration còn thiếu trong `db/migrations/` (theo thứ tự tên, mỗi
   file một transaction, ghi nhận vào bảng `schema_migrations`)
3. tạo bộ ca mặc định, tên công ty và tài khoản quản trị từ `.env`

Cái gì đã có thì bỏ qua, nên chạy lại bao nhiêu lần cũng không đổi gì. Trên
server thì gọi `npm run db` trước khi `npm start`.

Thêm thay đổi schema: tạo file mới `db/migrations/012_<mô_tả>.sql`, không sửa
file cũ đã chạy.

### 3. Thiết lập lần đầu trong giao diện admin

Đăng nhập `/admin-login-app` rồi làm theo thứ tự:

1. **Vị trí** — thêm ít nhất một vị trí, nếu không nhân viên không chấm công được
2. **Ca làm việc** — đặt giờ nghỉ trưa, chỉnh khung giờ từng ca, đặt số giờ tối
   thiểu theo giờ làm thực (đã trừ nghỉ trưa), đánh dấu một ca là mặc định cho
   full-time
3. **Ngày lễ** — khai báo ngày nghỉ trong năm
4. **Nhân viên** — thêm nhân viên và chọn đúng loại hợp đồng
5. **Công ty** — đặt tên hiển thị trên trang đăng nhập nhân viên
6. **Email** — nhập máy chủ SMTP để dùng quên mật khẩu và nhắc đăng ký lịch

## Trang

| Route | Ai dùng |
|---|---|
| `/login`, `/admin-login-app`, `/forgot-password`, `/reset-password`, `/desktop-only` | Công khai |
| `/dashboard` | Nhân viên — check in / check out |
| `/dashboard/schedule` | Nhân viên — đăng ký lịch tháng |
| `/dashboard/history` | Nhân viên — lịch sử chấm công |
| `/dashboard/work-reports` | Nhân viên — khai nội dung công việc theo khoảng thời gian |
| `/dashboard/shift-requests` | Nhân viên — gửi yêu cầu đổi ca / xin nghỉ một ngày |
| `/dashboard/change-password` | Nhân viên — đổi mật khẩu |
| `/admin/attendance/monthly` | Admin — bảng chấm công tháng, xuất Excel |
| `/admin/attendance/user/[userId]` | Admin — chi tiết theo ngày, sửa công tay |
| `/admin/schedules` | Admin — lịch cả công ty, xếp lịch cho nhân viên |
| `/admin/shift-requests` | Admin — duyệt / từ chối yêu cầu đổi ca |
| `/admin/work-reports` | Admin — xem nội dung công việc nhân viên khai, xuất CSV |
| `/admin/users` | Admin — hồ sơ nhân viên |
| `/admin/sessions` | Admin — danh mục ca |
| `/admin/locations` | Admin — vị trí GPS |
| `/admin/holidays` | Admin — ngày lễ |
| `/admin/company`, `/admin/email`, `/admin/change-password` | Admin |

Menu của cả hai khu vực có thêm mục **ClickUp** mở `https://app.clickup.com` ở
tab mới.

`middleware.ts` chặn `/admin/*` và `/dashboard/*` ở tầng edge theo vai trò, và đưa
mọi truy cập từ điện thoại hoặc máy tính bảng sang `/desktop-only` — hệ thống chỉ
dùng trên máy tính.

## Cấu trúc

```
app/
├── _components/        # UI dùng chung (Button, Input, Modal, Badge...)
├── api/                # Route handlers — SQL nằm trực tiếp ở đây
├── admin/              # Khu vực quản trị (layout + sidebar)
└── dashboard/          # Khu vực nhân viên

lib/
├── db.ts               # Pool pg + query / queryOne / execute / transaction
├── types.ts            # Kiểu của từng dòng trả về từ Postgres
├── datetime.ts         # Mọi thứ liên quan múi giờ VN
├── schedule.ts         # Loại hợp đồng + cửa sổ đăng ký
├── attendance-rules.ts # Ghép cặp punch, xếp loại ngày công
├── attendance-service.ts # Truy vấn lịch thực tế của nhân viên theo tháng
├── work-reports.ts     # Luật chuỗi khoảng thời gian của báo cáo công việc
├── attendance-export.ts # Dựng file Excel bảng chấm công tháng
├── auth-guard.ts       # requireAdmin / requireEmployee / handle
├── validation.ts       # Chuẩn hoá + kiểm tra input dùng chung
├── session.ts          # JWT session qua cookie
├── mailer.ts           # Cấu hình SMTP trong Settings + gửi email
└── reminder.ts         # Email nhắc đăng ký lịch theo ngày mở cửa sổ

instrumentation.ts      # Khởi động bộ đếm nhắc đăng ký khi server chạy

db/migrations/          # Migration SQL thuần, chạy theo thứ tự tên
scripts/                # migrate.ts, seed.ts
```

Mọi cột thời gian là `timestamptz`. Cột `timestamp` thường (không múi giờ) bị
driver `pg` đọc theo giờ của máy chạy Node, nên cùng một dòng dữ liệu sẽ ra hai
mốc khác nhau tuỳ máy — với app chấm công thì đó là sai 7 tiếng.

## Lệnh

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run migrate     # áp migration còn thiếu
npm run seed        # dữ liệu khởi tạo
npm run db          # migrate + seed
```

## Triển khai production

### 1. Biến môi trường

Chép `.env.example` thành `.env` và điền. Bốn biến, không có giá trị mặc định
nào là an toàn:

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | ✔ | Database chưa có thì `npm run db` tự tạo |
| `AUTH_SECRET` | ✔ | **≥ 32 ký tự** ở production, nếu không app dừng ngay khi khởi động. Sinh bằng `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `AUTH_ADMIN_USERNAME` | | Mặc định `admin` |
| `AUTH_ADMIN_PASSWORD` | ✔ | Thiếu thì `npm run seed` dừng và trang đăng nhập quản trị từ chối mọi lần thử — **không có mật khẩu mặc định** |

Đổi `AUTH_SECRET` sẽ làm mọi người đang đăng nhập bị đăng xuất, và mật khẩu
SMTP đã lưu phải nhập lại.

### 2. Chạy

```bash
npm ci
npm run build
npm run db      # migrate + seed, phải chạy trước mỗi lần start sau khi cập nhật
npm start
```

Backup database trước khi chạy migration trên dữ liệu thật.

### 3. Bắt buộc chạy sau HTTPS

Cookie phiên bật `secure` khi `NODE_ENV=production`, nên qua HTTP thuần thì
trình duyệt không lưu cookie và không ai đăng nhập được. Đặt sau reverse proxy
có TLS (nginx/Caddy) và trỏ đúng `proxy_set_header Host`.

### 4. Việc phải làm trong giao diện sau khi bật

1. **`/admin/sessions`** — đối chiếu giờ nghỉ trưa với khung giờ ca: giờ công là
   vào → ra **trừ phần rơi vào nghỉ trưa**, nên nghỉ trưa kéo dài chồng lên giờ
   vào ca chiều sẽ khiến ai cũng thiếu giờ. Đặt `minHours` thấp hơn giờ làm thực
   khoảng 30 phút để ra sớm một chút vẫn đủ công.
2. **`/admin/email`** — điền **Đường dẫn ứng dụng** (ví dụ `https://cham-cong.congty.vn`).
   Bỏ trống thì email nhắc đăng ký lịch không kèm được link (gửi từ bộ đếm nền,
   không có request để suy ra tên miền), còn link đặt lại mật khẩu lấy theo host
   của request nên sau reverse proxy dễ ra sai. Sau đó bấm **Gửi thử** và thử
   luôn luồng quên mật khẩu bằng một hộp thư thật.
3. **`/admin/company`** — upload lại logo. File logo nằm ở `public/uploads/`
   (không commit), nên máy chủ mới sẽ không có; deploy dạng container cần gắn
   volume cho thư mục này, nếu không logo mất sau mỗi lần deploy.
4. **`/admin/locations`** — ít nhất một vị trí, nếu không nhân viên không chấm
   công được.

### Đặc điểm cần biết trước khi bàn giao cho người dùng

- Hệ thống **chặn điện thoại và máy tính bảng** (`middleware.ts` → `/desktop-only`):
  nhân viên chấm công bằng máy tính, dù việc kiểm tra vị trí là GPS.
- Mật khẩu nhân viên và admin đều băm bằng bcrypt.
- Xoá nhân viên là **ngừng hoạt động** (`isActive=false`) để giữ lịch sử chấm
  công; xoá cứng chỉ được phép khi nhân viên chưa có ngày công nào.
- Nhân viên đã ngừng hoạt động bị chặn ngay ở lần gọi API kế tiếp và cookie
  phiên bị xoá, không cần đợi JWT hết hạn.
- Bộ nhắc đăng ký lịch chạy trong tiến trình server; chạy nhiều instance thì
  mỗi instance có một bộ đếm, có thể gửi trùng.
- Không có rate-limit ở trang đăng nhập.

## Chưa làm

- Đơn xin nghỉ phép có duyệt (hiện chỉ có ngày lễ toàn công ty)
- Admin khai hộ hoặc mở khoá nội dung công việc của ngày đã chốt
- Khoảng công việc kéo qua nửa đêm
- Nhắc nhở / đánh dấu vi phạm khi nhân viên không khai nội dung công việc
