# Hệ thống chấm công nội bộ

Đăng ký lịch làm việc theo tháng + chấm công bằng GPS, cho doanh nghiệp nhỏ.
Next.js 15 (App Router) · PostgreSQL (driver `pg`, SQL viết tay) · Tailwind CSS 4.

Không dùng ORM: mọi truy vấn là SQL trong route, đi qua `lib/db.ts`.

## Nghiệp vụ

### Ba loại hợp đồng

| Loại | Lịch làm việc |
|---|---|
| Toàn thời gian (`full_time`) | Hệ thống tự sinh T2–T6 với ca được đánh dấu "mặc định full-time". Không phải đăng ký. |
| Bán thời gian (`part_time`) | Tự đăng ký từng ca cho từng ngày trong tháng. |
| Thực tập (`intern`) | Như bán thời gian. |

### Cửa sổ đăng ký lịch

Nhân viên bán thời gian và thực tập đăng ký lịch của **tháng T+1** trong khoảng
**ngày 20 đến hết ngày cuối cùng của tháng T**. Ngoài khoảng đó API từ chối lưu và
giao diện chuyển sang chế độ chỉ xem. Admin sửa được lịch bất cứ lúc nào.

Không có bước duyệt: nhân viên lưu là lịch có hiệu lực ngay.

### Chấm công

Mỗi lần bấm giờ là một dòng `AttendancePunch` (`in` hoặc `out`). Hệ thống ghép cặp
`in → out` theo thứ tự thời gian, nên một ngày có thể làm nhiều ca rời nhau
(sáng 8–12, chiều 13–18) mà thời gian nghỉ giữa hai ca **không** bị tính vào giờ công.

Vị trí bắt buộc nằm trong bán kính của một `WorkLocation` đang bật, nếu không API
từ chối. Trường hợp sai vị trí hoặc quên bấm giờ thì admin bổ sung tay ở trang chi
tiết nhân viên (các dòng nhập tay được đánh dấu `isManual`).

### Cách xếp loại một ngày

| Trạng thái | Điều kiện |
|---|---|
| Đủ công | Có lịch, đủ số giờ tối thiểu, vào ca đúng giờ |
| Đi muộn | Đủ giờ nhưng check-in sau `workStart` quá 5 phút |
| Thiếu giờ | Có lịch, giờ làm chưa đạt tổng `minHours` của các ca đăng ký |
| Đang làm | Lần bấm giờ cuối cùng là `in`, chưa đóng ca |
| Vắng | Có lịch nhưng không có lần bấm giờ nào |
| Ngoài lịch | Có chấm công nhưng ngày đó không đăng ký ca nào |
| Nghỉ lễ | Ngày nằm trong bảng `Holiday` — không bị tính vắng |

Múi giờ chốt cứng ở `Asia/Ho_Chi_Minh` (`lib/datetime.ts`), không phụ thuộc giờ
máy chủ — đây là lý do mọi khoá ngày đều đi qua `dateKeyVN()`.

## Cài đặt

### 1. Cấu hình `.env`

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/company_mana"
AUTH_SECRET="chuỗi ngẫu nhiên đủ dài"
AUTH_ADMIN_USERNAME="admin"
AUTH_ADMIN_PASSWORD="đổi-mật-khẩu-này"
```

`AUTH_ADMIN_*` chỉ dùng để tạo tài khoản quản trị **lần đầu**. Sau khi bảng
`Admin` đã có bản ghi, đổi mật khẩu phải làm ở `/admin/change-password` — sửa
`.env` lúc đó không còn tác dụng.

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

Thêm thay đổi schema: tạo file mới `db/migrations/005_<mô_tả>.sql`, không sửa
file cũ đã chạy.

### 3. Thiết lập lần đầu trong giao diện admin

Đăng nhập `/admin-login-app` rồi làm theo thứ tự:

1. **Vị trí** — thêm ít nhất một vị trí, nếu không nhân viên không chấm công được
2. **Ca làm việc** — chỉnh khung giờ, đánh dấu một ca là mặc định cho full-time
3. **Ngày lễ** — khai báo ngày nghỉ trong năm
4. **Nhân viên** — thêm nhân viên và chọn đúng loại hợp đồng
5. **Công ty** — đặt tên hiển thị trên trang đăng nhập nhân viên

## Trang

| Route | Ai dùng |
|---|---|
| `/login`, `/admin-login-app` | Công khai |
| `/dashboard` | Nhân viên — check in / check out |
| `/dashboard/schedule` | Nhân viên — đăng ký lịch tháng |
| `/dashboard/history` | Nhân viên — lịch sử chấm công |
| `/admin/attendance/monthly` | Admin — bảng chấm công tháng, xuất CSV |
| `/admin/attendance/user/[userId]` | Admin — chi tiết theo ngày, sửa công tay |
| `/admin/schedules` | Admin — lịch cả công ty, xếp lịch cho nhân viên |
| `/admin/users` | Admin — hồ sơ nhân viên |
| `/admin/sessions` | Admin — danh mục ca |
| `/admin/locations` | Admin — vị trí GPS |
| `/admin/holidays` | Admin — ngày lễ |
| `/admin/company`, `/admin/change-password` | Admin |

`middleware.ts` chặn `/admin/*` và `/dashboard/*` ở tầng edge theo vai trò.

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
├── auth-guard.ts       # requireAdmin / requireEmployee / handle
├── validation.ts       # Chuẩn hoá + kiểm tra input dùng chung
└── session.ts          # JWT session qua cookie

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

## Lưu ý production

- Đổi `AUTH_SECRET` và `AUTH_ADMIN_PASSWORD`
- Chạy sau HTTPS (cookie đã tự bật `secure` khi `NODE_ENV=production`)
- Mật khẩu nhân viên và admin đều băm bằng bcrypt
- Xoá nhân viên là **ngừng hoạt động** (`isActive=false`) để giữ lịch sử chấm công;
  xoá cứng chỉ được phép khi nhân viên chưa có ngày công nào

## Chưa làm

- Đơn xin nghỉ phép có duyệt (hiện chỉ có ngày lễ toàn công ty)
- Thông báo nhắc đăng ký lịch khi tới ngày 20
