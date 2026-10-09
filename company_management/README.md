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

**Giờ tan nghỉ trưa phải bằng giờ vào ca chiều.** Lệch nhau thì khoảng chồng lấn
vừa nằm trong ca vừa bị trừ như giờ nghỉ, và giờ công hụt đúng bằng phần lệch —
ai làm đủ ca vẫn bị chấm thiếu giờ.

Vị trí bắt buộc nằm trong bán kính của một `WorkLocation` đang bật, nếu không API
từ chối. Trường hợp sai vị trí hoặc quên bấm giờ thì admin bổ sung tay ở trang chi
tiết nhân viên (các dòng nhập tay được đánh dấu `isManual`).

### Nhật ký chấm công (trang Bảo mật)

Mọi lần bấm Vào / Ra ca, **kể cả lần bị từ chối**, ghi một dòng `PunchAttempt`
(`lib/punch-audit.ts`): lý do từ chối, IP, trình duyệt, khoảng cách tới vị trí
làm việc, độ chính xác GPS và cờ bất thường — GPS kém chính xác (> 200 m), không
rõ độ chính xác, **IP dùng chung** (cùng một IP chấm công thành công cho người
khác trong 15 phút). Xem ở tab Chấm công của `/admin/security`, lọc "Chỉ hiện
bất thường".

IP lấy từ `X-Forwarded-For` do Caddy đặt (Caddy bỏ giá trị client tự gửi). Máy
trong LAN ghi đúng IP thật; máy vào qua Tailscale hiện chung một IP gateway Docker
(`172.19.0.1`) do Tailscale trên server NAT lại. Chạy thẳng cổng 3000 không qua
Caddy thì cột IP trống.

(Tính năng "mã có mặt" thêm ở migration 020 đã gỡ ở migration 021.)

### Bảng chấm công gửi kế toán

`/admin/attendance/monthly` → nút **Xuất Excel** tải file `.xlsx` của tháng đang
xem: mỗi nhân viên một dòng (mã NV, họ tên, email, loại hợp đồng), mỗi ngày một
ô ký hiệu, rồi các cột tổng **Ngày công · Ngày công tháng · Đi muộn · Vắng ·
Nghỉ (N) · Ốm (O) · Tổng giờ** và số ngày đã làm theo từng mã ca.

Ký hiệu ô theo mẫu kế toán (`accountingCellLabel` trong `lib/attendance-export.ts`):
full-time ghi **`x`** (một công) / **`x/2`** (nửa công); part-time và thực tập ghi
mã ca đã làm (`S`, `C`, `CN`, ghép `S+C`). Ngày không có công giữ ký hiệu lưới:
`L` nghỉ lễ, `N` nghỉ, `O` ốm, `V` vắng, `?` quên checkout, `CN!` thiếu giờ mà
admin chọn không tính.

Trang chi tiết nhân viên `/admin/attendance/user/[id]` có nút **Xuất Excel** riêng:
mỗi ngày một dòng với ca, giờ vào, giờ ra, giờ làm, số công, trạng thái, ghi chú.

### Ngày công

- Mỗi ca có **số công** (trang Ca làm việc): mặc định `S` = 0,5, `C` = 0,5,
  `CN` = 1, `T` (tăng ca) = 0. Ngày công của tháng = tổng số công các ngày.
- **Ngày công tháng** (công chuẩn, mẫu số khi tính lương) = số ngày không phải
  ngày nghỉ hằng tuần trong tháng, **tính cả ngày lễ** (`standardWorkdays` trong
  `lib/schedule.ts`). Tháng 9/2026 nghỉ T7 + CN = 22.
- **Nghỉ lễ được hưởng lương**: ngày lễ có lịch thì vẫn được số công của lịch đó.
- **Thiếu giờ** vẫn tính đủ công nhưng đánh dấu *Chờ xem lại*. Admin bấm ✓ (tính)
  hoặc ✗ (không tính) ở trang chi tiết nhân viên — bảng `DayReview`. Chưa xem thì
  hết tháng vẫn tính đủ.
- **Làm ngoài lịch** (quên đăng ký): đủ ngưỡng cả ngày (giờ tối thiểu của ca mặc
  định full-time) là 1 công, ít hơn là 0,5. Riêng full-time đi làm **ngày nghỉ
  hằng tuần hoặc ngày lễ** mà không có lịch thì **0 công** — phải làm phiếu OT.
- Nghỉ `N` và ốm `O` là 0 công ở bảng chấm công; phép năm hưởng lương tính ở
  bảng lương.
- Ngày nghỉ hằng tuần đặt ở trang **Lịch làm việc**; trang **Ngày lễ** chỉ còn
  ngày lễ.

### Làm thêm giờ (OT)

OT chỉ được trả khi có **phiếu OT được admin duyệt** — kể cả đi làm thứ 7, chủ
nhật, ngày lễ (full-time làm ngày nghỉ mà không có phiếu thì 0 công).

- Nhân viên làm phiếu ở `/dashboard/overtime`: ngày, giờ dự kiến (không qua nửa
  đêm), nơi đi / nơi đến, nội dung. Mỗi ngày một phiếu còn hiệu lực; gửi lại khi
  đang chờ là sửa phiếu; phiếu bị từ chối không chặn làm phiếu mới.
- Ký hiệu và hệ số **tự gắn theo ngày**: `T` ngày thường **150%**, `T1` ngày nghỉ
  hằng tuần **200%**, `T2` ngày lễ **300%** (lễ rơi vào CN vẫn là T2). Admin sửa
  hệ số và số giờ chuẩn một ngày (mặc định 8) ở `/admin/overtime` — Settings
  `overtime_config`.
- **Số giờ OT** (`computeOvertimeMinutes` trong `lib/overtime.ts`), đã trừ nghỉ trưa:
  ngày có ca chính (số công > 0) thì là phần làm **sau giờ hết ca chính**; ngày lễ
  hoặc ngày không có ca chính thì là **toàn bộ giờ làm**. Không có đủ giờ vào và
  giờ ra (đi công tác, quên checkout) thì lấy **giờ dự kiến** trên phiếu.
- Admin duyệt ở `/admin/overtime`, có thể **chốt tay số giờ** (bỏ trống = theo
  cách tính trên), sửa giờ hoặc từ chối cả sau khi đã duyệt.
- Ngày không có ca mà có phiếu OT được duyệt là ngày OT: không cộng thêm công
  "ngoài lịch", chỉ trả theo giờ OT.
- Bảng công: ô ngày thêm ký hiệu (`x+T`, `T1`, `L+T2`); Excel cả công ty có thêm
  ba cột **OT T / T1 / T2 (giờ)**; Excel từng nhân viên có cột OT.
- Lương OT (tính ở bảng lương) = lương ngày ÷ số giờ chuẩn × số giờ × hệ số.

### Bảng lương

`/admin/payroll` (cài đặt ở `/admin/payroll/settings`). Tính từ bảng công tháng
(`computeMonthAttendance` trong `lib/attendance-month.ts` — cùng một hàm với trang
bảng chấm công), phiếu OT đã duyệt, hồ sơ lương và khoản hỗ trợ. Công thức thuần
ở `lib/payroll.ts` (có test đối chiếu từng dòng file lương kế toán T9/2026).

- **Hồ sơ lương** (bảng `PayProfile`, mỗi người một dòng, chỉ admin): lương tháng
  (chia theo ngày công / ngày công tháng) hoặc đơn giá theo ngày; loại HĐ CTV /
  Thử việc (hưởng % lương, mặc định 85%) / Chính thức; thuế khấu trừ 10% /
  luỹ tiến / không; có hay không đóng BH (mức đóng riêng hoặc theo lương cơ bản);
  phép năm; STK. Chưa có hồ sơ thì 0 đồng và có cảnh báo.
- **GROSS / NET** (`payBasis`, migration 019): GROSS = lương thoả thuận trước
  thuế, BH, người lao động tự chịu khoản trừ. NET = số cầm về: thành tiền + hỗ
  trợ + OT tính theo lương NET là số cam kết; hệ thống dò khoản **bù thuế & BH**
  (`netGrossUp`) để sau khấu trừ vẫn đúng số đó, gross = cam kết + khoản bù. NET
  có đóng BH thì bắt buộc nhập lương đóng BH (không suy từ số NET được).
- **Khoản hỗ trợ** (`Allowance`, `EmployeeAllowance`): admin tạo, gắn từng người,
  mức riêng được; cố định tháng / theo tỉ lệ ngày công / theo số ngày công; chịu
  thuế hay không.
- **Công thức**: lương ngày = lương áp dụng ÷ ngày công tháng (theo ngày thì là
  đơn giá); thành tiền = lương ngày × (công + phép năm có lương); lương giờ =
  lương ngày ÷ giờ chuẩn; OT = lương giờ × giờ × hệ số; BH = lương đóng BH × tỉ
  lệ; thuế 10% trên thu nhập chịu thuế, hoặc luỹ tiến trên (thu nhập + OT tính
  100% − BH − giảm trừ bản thân − người phụ thuộc). Mức BH, thuế, giảm trừ, biểu
  thuế sửa được — **mặc định cần kế toán đối chiếu lại**.
- **Phép năm**: cộng dần số ngày/năm ÷ 12 mỗi tháng từ ngày bắt đầu tính phép
  (mặc định ngày vào làm), thêm 1 ngày/năm mỗi 5 năm, tồn tối đa 3 năm; nghỉ `N`
  trừ dần, hết phép là không lương. Không áp cho CTV.
- **Tạm tính**: tháng chưa hết thì hôm nay → cuối tháng tính là đi làm đủ theo
  lịch (ngày đã xin nghỉ thì không).
- **Chốt lương** (`PayrollClosing`): lưu nguyên kết quả lúc chốt; sau đó sửa chấm
  công, hồ sơ hay cấu hình không làm đổi bảng đã chốt. Mở chốt để tính lại.
- **Tải file** (admin tự tải, không gửi email): bảng lương toàn công ty (sheet
  "Lương" theo mẫu "Bảng chi tiết lương" + sheet chấm công) và phiếu lương từng
  người (phiếu lương + "Bảng chấm công làm thêm giờ" + chấm công từng ngày).

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
| Ngoài lịch | Quên đăng ký nhưng vẫn đi làm, có cả giờ vào lẫn giờ ra — tính 1 hoặc 0,5 công theo giờ thực tế (xem "Ngày công"), tô **vàng** để admin để ý; admin muốn có mã ca thì bấm vào ô để gán ca |
| Nghỉ lễ | Ngày nằm trong bảng `Holiday` — không bị tính vắng, có lịch thì vẫn được tính công |
| Không có lịch | Không đăng ký ca nào và cũng không có lần bấm giờ nào |

Mọi chỗ cộng "ngày công" dùng `workdayValue` của `evaluateDay`, không so sánh
trạng thái bằng tay.

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

### Đăng nhập chung

Admin và nhân viên đăng nhập cùng một trang `/login`, một ô **"Email hoặc tên
đăng nhập"**. `/api/auth/login` tìm trong bảng `Admin` trước (theo tên đăng
nhập, không phân biệt hoa thường — có thể là `admin` hay một email): có thì vào
khu quản trị (`/admin/...`), không thì tìm theo email trong bảng nhân viên và vào
`/dashboard`. Sai gì cũng cùng một câu "Tài khoản hoặc mật khẩu không đúng",
không lộ đó là tài khoản gì.

Vì admin được tìm trước, một email không được vừa là tên đăng nhập admin vừa là
email nhân viên: tạo nhân viên, admin sửa hồ sơ, nhân viên tự đổi email đều trả
409 nếu trùng, và seed dừng nếu `AUTH_ADMIN_USERNAME` trùng email nhân viên.
Đường dẫn cũ `/admin-login-app` chuyển về `/login`.

### Phiên đăng nhập và chặn dò mật khẩu

Phiên là JWT ký bằng `AUTH_SECRET`, để trong cookie `httpOnly`, hạn **7 ngày**.
Mỗi lần mở web mà phiên đã quá một ngày thì `middleware.ts` ký lại từ đầu — ai
dùng đều đặn thì không bao giờ phải đăng nhập lại; nghỉ hẳn 7 ngày mới bị đá ra.

Đăng nhập sai **5 lần** thì tài khoản bị khoá **15 phút** (bảng `LoginAttempt`,
`lib/login-throttle.ts`). Vài điểm của cách đếm:

- Đếm theo tài khoản, không theo IP — hệ thống chạy sau reverse proxy nên IP
  nhìn thấy thường là của proxy.
- Email không có trong hệ thống cũng bị đếm, để không ai suy ra được email nào
  có tài khoản qua việc có bị khoá hay không.
- Sai rải rác quá 15 phút thì bộ đếm về 0; đăng nhập đúng thì xoá sạch.
- Đang bị khoá mà **đổi mật khẩu bằng mã ở "Quên mật khẩu"** thì khoá được gỡ
  ngay — người dùng thật vừa chứng minh họ đọc được hộp thư của chính mình.
- Admin bị khoá thì phải chờ hết 15 phút, vì không có luồng quên mật khẩu.
- Nhập sai mã 2 lớp đếm chung bộ đếm này.

Phiên mang số `sv` (cột `sessionVersion`). **Đổi / đặt lại mật khẩu, bật / tắt 2
lớp** thì số này tăng: mọi phiên khác của tài khoản bị đăng xuất ngay ở request
kế tiếp (`requireAdmin` / `requireEmployee` / `/api/auth/session`), người đang
thao tác được ký lại phiên nên không bị đá ra. Admin đặt lại mật khẩu cho nhân
viên cũng đăng xuất nhân viên đó.

Nhật ký tài khoản (`LoginEvent`, `lib/security-log.ts`): đăng nhập, sai mật khẩu,
sai mã 2 lớp, bật / tắt 2 lớp, đổi / đặt lại mật khẩu, kèm IP và trình duyệt —
tab Đăng nhập của `/admin/security`.

### Xác thực 2 lớp

Admin (trang Tài khoản `/admin/change-password`) và nhân viên (Cài đặt) tự bật
bằng app **Google Authenticator** / Microsoft Authenticator — chuẩn TOTP, không
cài gì thêm trên server, không gọi dịch vụ ngoài (`lib/totp.ts`, `lib/two-factor.ts`).

- Bật: nhập mật khẩu → quét QR → nhập mã 6 số để xác nhận → nhận **10 mã dự
  phòng** (hiện một lần, mỗi mã dùng một lần). Tắt cần mật khẩu + mã.
- Đăng nhập: đúng mật khẩu thì chỉ nhận vé tạm 5 phút (cookie `mfa_challenge`,
  không dùng thay phiên được), nhập mã ở bước 2 mới có phiên. Một mã 6 số không
  dùng lại được (`totpLastStep`).
- Khoá TOTP lưu mã hoá bằng khoá dẫn xuất từ `AUTH_SECRET`; mã dự phòng chỉ lưu
  HMAC. **Đổi `AUTH_SECRET` là mọi tài khoản đã bật 2 lớp không đăng nhập được**
  cho tới khi tắt 2 lớp bằng SQL bên dưới.
- Nhân viên mất điện thoại: admin bấm nút khiên gạch ở `/admin/users` để tắt hộ.
- Admin mất cả điện thoại lẫn mã dự phòng: chạy trên server

  ```bash
  docker compose -p company_management exec -T db psql -U postgres -d company_mana -c \
    "UPDATE \"Admin\" SET \"totpSecret\"=NULL, \"totpPendingSecret\"=NULL, \"totpEnabledAt\"=NULL, \"totpBackupCodes\"=NULL, \"totpLastStep\"=NULL, \"sessionVersion\"=\"sessionVersion\"+1 WHERE \"username\"='admin';"
  ```

### Email

Admin cấu hình SMTP ở `/admin/email`. Cấu hình lưu trong bảng `Settings`, mật
khẩu SMTP mã hoá bằng khoá dẫn xuất từ `AUTH_SECRET` (đổi `AUTH_SECRET` thì
phải nhập lại mật khẩu SMTP). Email dùng cho hai việc:

- **Quên mật khẩu**: nhân viên nhập email ở `/forgot-password`, nhận **mã 8 số**
  qua email rồi nhập thẳng mã đó kèm mật khẩu mới ngay trên trang. Mã sống 15
  phút, dùng một lần, sai 5 lần thì bị huỷ (mã chỉ có 8 chữ số nên phải chặn dò);
  bấm gửi lại trong vòng 60 giây thì dùng lại mã cũ, không gửi thêm thư. Bảng
  `PasswordReset` chỉ lưu băm của mã. Đường dẫn cũ `/reset-password` (thời còn
  gửi link) chuyển hướng về `/forgot-password`.
- **Nhắc đăng ký lịch**: từ ngày 20 hằng tháng, server tự gửi email cho nhân viên
  bán thời gian và thực tập, mỗi tháng một lần. Bộ đếm chạy trong tiến trình
  server (`instrumentation.ts` → `lib/reminder.ts`), kiểm tra mỗi giờ. Admin
  bật/tắt hoặc bấm "Gửi nhắc ngay" ở trang Email.

### Hồ sơ nhân viên

Nhân viên tự sửa hồ sơ ở tab **Cài đặt** (`/dashboard/settings`): họ tên, email
đăng nhập, ảnh đại diện và mật khẩu. Email là tên đăng nhập nên phải là duy
nhất; trùng người khác thì API trả 409.

Tên và email nằm sẵn trong cookie phiên để header đọc nhanh, nên khi đổi hồ sơ
API ký lại cookie ngay — không phải đợi JWT hết hạn. Mọi chỗ khác (bảng chấm
công, file Excel, danh sách nhân viên) đọc thẳng từ database nên tự khớp.

Ảnh đại diện lưu ở `storage/uploads/avatar-<id>.<ext>` cùng chỗ với logo công
ty, đường dẫn có kèm dấu thời gian để trình duyệt không dùng lại ảnh cũ trong
cache. Chỉ nhận PNG / JPG / WebP, tối đa 2MB — không nhận SVG vì file SVG phục
vụ từ cùng tên miền có thể mang mã chạy được.

File upload **không** để trong `public/`: `next start` chỉ quét `public/` một
lần lúc khởi động, ảnh upload sau đó sẽ 404 cho tới khi restart. Thư mục lưu là
`UPLOAD_DIR` (mặc định `storage/uploads`), phục vụ qua `app/uploads/[file]/route.ts`
nên đường dẫn ngoài trình duyệt vẫn là `/uploads/<tên file>`.

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

Chạy local giống production bằng Docker (không cài Postgres native):

```bash
docker compose up -d --build   # build + next start trong container, cổng 3000
```

App đọc toàn bộ `.env`, kể cả `DATABASE_URL`; trong container `localhost` là chính
container nên `DATABASE_URL` phải là IP / tên máy thật của database. Cần một
Postgres trống để thử: `docker compose --profile local-db up -d db` (cổng 5433).

Chạy dev có hot-reload thì vẫn dùng:

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

Thêm thay đổi schema: tạo file mới `db/migrations/016_<mô_tả>.sql`, không sửa
file cũ đã chạy.

### 3. Thiết lập lần đầu trong giao diện admin

Đăng nhập `/login` bằng tài khoản admin trong `.env` rồi làm theo thứ tự:

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
| `/login` | Công khai — đăng nhập chung cho admin và nhân viên |
| `/forgot-password`, `/desktop-only` | Công khai |
| `/dashboard` | Nhân viên — check in / check out |
| `/dashboard/schedule` | Nhân viên — đăng ký lịch tháng |
| `/dashboard/history` | Nhân viên — lịch sử chấm công |
| `/dashboard/work-reports` | Nhân viên — khai nội dung công việc theo khoảng thời gian |
| `/dashboard/shift-requests` | Nhân viên — gửi yêu cầu đổi ca / xin nghỉ một ngày |
| `/dashboard/overtime` | Nhân viên — làm phiếu OT |
| `/dashboard/settings` | Nhân viên — đổi họ tên, email, ảnh đại diện, mật khẩu, xác thực 2 lớp |
| `/admin/attendance/monthly` | Admin — bảng chấm công tháng, xuất Excel |
| `/admin/attendance/user/[userId]` | Admin — chi tiết theo ngày, sửa công tay |
| `/admin/schedules` | Admin — lịch cả công ty, xếp lịch cho nhân viên |
| `/admin/shift-requests` | Admin — duyệt / từ chối yêu cầu đổi ca |
| `/admin/overtime` | Admin — duyệt phiếu OT, chốt giờ, đặt hệ số OT |
| `/admin/payroll` | Admin — bảng lương tháng, hồ sơ lương, chốt lương, tải file |
| `/admin/payroll/settings` | Admin — khoản hỗ trợ, bảo hiểm, thuế, phép năm |
| `/admin/work-reports` | Admin — xem nội dung công việc nhân viên khai, xuất CSV |
| `/admin/users` | Admin — hồ sơ nhân viên |
| `/admin/sessions` | Admin — danh mục ca |
| `/admin/locations` | Admin — vị trí GPS |
| `/admin/holidays` | Admin — ngày lễ |
| `/admin/security` | Admin — nhật ký chấm công / đăng nhập |
| `/admin/access-violations` | Admin — nhật ký truy cập lạ |
| `/admin/change-password` | Admin — Tài khoản: xác thực 2 lớp, đổi mật khẩu |
| `/admin/company`, `/admin/email` | Admin |

Menu của cả hai khu vực có thêm mục **ClickUp** mở `https://app.clickup.com` ở
tab mới.

`middleware.ts` chặn `/admin/*` và `/dashboard/*` ở tầng edge theo vai trò, và đưa
mọi truy cập từ điện thoại hoặc máy tính bảng sang `/desktop-only` — hệ thống chỉ
dùng trên máy tính.

### Truy cập lạ

Đã đăng nhập mà mở đường dẫn **không tồn tại** (404) hoặc **không thuộc quyền**
của mình (nhân viên mò vào `/admin/*`) thì rơi vào trang cảnh báo `/canh-bao`:
nền tối, nói rõ lần truy cập đã được ghi lại và báo cáo với quản trị viên.

Câu đó là thật chứ không phải doạ: mỗi lần như vậy ghi một dòng vào bảng
`AccessViolation` (tên người, vai trò, đường dẫn, thời điểm), admin xem ở
`/admin/access-violations`. Khách **chưa đăng nhập** thì chỉ thấy trang cảnh báo
chứ không ghi gì — bot quét đường dẫn mà cũng ghi thì bảng đầy rác ngay.

Người chưa đăng nhập vào `/admin/*` vẫn được đưa về trang đăng nhập như cũ, không
bị doạ: chưa đăng nhập thì chưa có gì để quy trách nhiệm.

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
├── login-throttle.ts   # Đếm đăng nhập sai, khoá tạm tài khoản
├── totp.ts             # TOTP (RFC 6238) cho xác thực 2 lớp
├── two-factor.ts       # Bật / tắt / kiểm tra xác thực 2 lớp, mã dự phòng
├── punch-audit.ts      # Nhật ký mọi lần bấm giờ + cờ bất thường
├── security-log.ts     # Nhật ký đăng nhập / đổi mật khẩu
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
| `AUTH_ADMIN_USERNAME` | | Tên đăng nhập admin, mặc định `admin`. Có thể là email nhưng không được trùng email nhân viên nào |
| `AUTH_ADMIN_PASSWORD` | ✔ | Thiếu thì `npm run seed` dừng và trang đăng nhập quản trị từ chối mọi lần thử — **không có mật khẩu mặc định** |
| `UPLOAD_DIR` | | Nơi lưu logo và ảnh đại diện. Mặc định `storage/uploads` trong thư mục app |

Đổi `AUTH_SECRET` sẽ làm mọi người đang đăng nhập bị đăng xuất, và mật khẩu
SMTP đã lưu phải nhập lại.

### 2. Chạy bằng Docker (cách deploy chính)

Server chỉ cần Docker, không cần sudo. `docker-compose.yml` chạy khép kín trên
một máy: **app** (`next start`) + **db** (Postgres 18, dữ liệu ở volume
`db-data`) + **proxy** (Caddy HTTPS, bật bằng `COMPOSE_PROFILES=proxy`). Trong
thư mục `company_management/`:

```bash
cp .env.example .env            # điền AUTH_SECRET, AUTH_ADMIN_PASSWORD, POSTGRES_PASSWORD, phần HTTPS
mkdir -p storage/uploads        # logo + ảnh đại diện
docker compose up -d --build
docker compose ps               # app và db phải "healthy"
```

- App luôn nối vào container `db`; `DATABASE_URL` trong `.env` chỉ dành cho
  `npm run dev`. Postgres chỉ mở `127.0.0.1:5433` trên chính máy đó.
- HTTPS: có tên miền thì `SITE_ADDRESS=<tên miền>`, `TLS_MODE=<email>` (Caddy tự
  xin Let's Encrypt, cần mở 80/443). Chỉ có IP nội bộ / Tailscale thì liệt kê IP
  và `TLS_MODE=internal`: chứng chỉ tự ký, trình duyệt cảnh báo lần đầu nhưng
  cookie vẫn `secure` như production. Cổng 443 chỉ mở IPv4.
- Image làm `npm ci` → `npm run build`; mỗi lần start chạy `npm run db`
  (migrate + seed) rồi `npm start`. Cập nhật code: đồng bộ code mới rồi
  `docker compose up -d --build`. **Backup trước** nếu có migration:
  `docker compose exec db pg_dump -U postgres company_mana > backup.sql`.
- `restart: unless-stopped` cho cả ba service; log giới hạn 5 file × 10MB.
- Backup: dữ liệu ở volume `db-data` và thư mục `storage/uploads`.
- Chỉ chạy **một** container app cho mỗi database: bộ nhắc đăng ký lịch chạy
  trong tiến trình, bật app khoảng 30 giây là kiểm tra lần đầu.

Không dùng Docker thì chạy tay đúng các bước đó:

```bash
npm ci          # đừng đặt NODE_ENV=production lúc này: tsx, dotenv, tailwind là devDependencies
npm run build
npm run db      # migrate + seed, phải chạy trước mỗi lần start sau khi cập nhật
npm start
```

### 3. Bắt buộc chạy sau HTTPS

Cookie phiên bật `secure` khi `NODE_ENV=production`, nên qua HTTP thuần thì
trình duyệt không lưu cookie và không ai đăng nhập được. Đặt sau reverse proxy
có TLS (nginx/Caddy) và trỏ đúng `proxy_set_header Host`. Container chỉ mở
`127.0.0.1:3000`, proxy trên cùng máy trỏ vào đó; đặt `client_max_body_size 3m`
(nginx) để upload ảnh 2MB không bị chặn. Ví dụ Caddy:

```
cham-cong.congty.vn {
    reverse_proxy 127.0.0.1:3000
}
```

### 4. Việc phải làm trong giao diện sau khi bật

1. **`/admin/sessions`** — đối chiếu giờ nghỉ trưa với khung giờ ca: giờ công là
   vào → ra **trừ phần rơi vào nghỉ trưa**, nên nghỉ trưa kéo dài chồng lên giờ
   vào ca chiều sẽ khiến ai cũng thiếu giờ. Đặt `minHours` thấp hơn giờ làm thực
   khoảng 30 phút để ra sớm một chút vẫn đủ công.
2. **`/admin/email`** — điền **Đường dẫn ứng dụng** (ví dụ `https://cham-cong.congty.vn`).
   Bỏ trống thì email nhắc đăng ký lịch không kèm được link (gửi từ bộ đếm nền,
   không có request để suy ra tên miền). Sau đó bấm **Gửi thử** và thử luôn luồng
   quên mật khẩu (mã 8 số) bằng một hộp thư thật.
3. **`/admin/company`** — upload lại logo. Logo và ảnh đại diện nằm ở
   `UPLOAD_DIR` (không commit), nên máy chủ mới sẽ không có; deploy dạng
   container cần gắn volume cho thư mục này, nếu không mất sau mỗi lần deploy.
   Máy nào còn file ở `public/uploads/` (bản cũ) thì chuyển sang `UPLOAD_DIR`.
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
- Đăng nhập sai 5 lần khoá tài khoản 15 phút (xem "Phiên đăng nhập và chặn dò
  mật khẩu"); không có giới hạn theo IP.

## Chưa làm

- Đơn xin nghỉ phép có duyệt (hiện chỉ có ngày lễ toàn công ty)
- Admin khai hộ hoặc mở khoá nội dung công việc của ngày đã chốt
- Khoảng công việc kéo qua nửa đêm
- Nhắc nhở / đánh dấu vi phạm khi nhân viên không khai nội dung công việc
