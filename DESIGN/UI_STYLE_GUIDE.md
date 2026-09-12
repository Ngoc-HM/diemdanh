# UI Style Guide

## Mục đích

File này là nguồn tham chiếu chuẩn cho toàn bộ UI của hệ thống.  
Bất kỳ AI nào, hoặc bất kỳ phiên chat mới nào, khi cần thiết kế hay chỉnh sửa UI trong dự án này đều phải đọc file này trước để bám đúng phong cách đã chốt.

Mục tiêu không phải làm UI đẹp kiểu trình diễn.  
Mục tiêu là tạo ra giao diện:

- chuyên nghiệp
- nghiêm túc
- cân đối
- dễ thao tác
- phù hợp phần mềm quản trị nội bộ doanh nghiệp

Không được làm UI theo kiểu landing page, startup demo, hay “AI slop”.
đây là style tôi đã xây sẵn, hãy đọc và sử dụng trong web company/lib
---

## Tinh thần thiết kế

Phong cách chuẩn của hệ thống là:

- enterprise admin dashboard
- clean internal operations software
- giao diện nội bộ cho người dùng doanh nghiệp
- nhấn vào hiệu quả, sự rõ ràng và tính tin cậy

UI phải cho cảm giác:

- phần mềm quản trị nội bộ thật
- dùng hàng ngày bởi trưởng phòng, quản lý, admin, ban giám đốc
- đọc nhanh, thao tác nhanh, không màu mè

UI không được cho cảm giác:

- futuristic
- experimental
- startup SaaS marketing
- AI-generated concept card
- dark hero / black banner / gradient phô diễn

---

## Nguyên tắc bắt buộc

### 1. Ưu tiên nghiệp vụ hơn trình diễn

Mọi layout phải phục vụ thao tác nghiệp vụ trước:

- nhập liệu rõ ràng
- duyệt dữ liệu rõ ràng
- bảng dễ quét
- popup dễ đọc
- CTA rõ nghĩa

Nếu một thành phần đẹp nhưng làm thao tác chậm hơn, phải bỏ.

### 2. Không dùng chữ trang trí vô nghĩa

Không được thêm các dòng kiểu:

- workspace
- design principle
- internal intake experience
- review command center

trừ khi người dùng yêu cầu rõ.

Text phải thực dụng, đúng nghiệp vụ, ngắn, rõ.

### 3. Không dùng kiểu chữ kéo giãn

Không dùng:

- letter spacing rộng
- uppercase trang trí
- các label kiểu tiêu đề mỹ thuật

Typography phải:

- bình thường
- đậm vừa đủ
- dễ đọc
- giống phần mềm doanh nghiệp

### 4. Màu sắc phải nền nã

Màu chủ đạo:

- nền trắng
- xám rất nhạt
- xanh navy đậm cho heading
- xanh nhạt cho trạng thái active
- đỏ cho hành động nguy hiểm
- xanh lá nhạt cho trạng thái tích cực
- vàng nhạt cho warning khi thật cần

Tránh:

- nền đen lớn
- gradient mạnh
- neon
- màu tím AI-style
- hiệu ứng glow

### 5. Khoảng trắng phải hợp lý

UI phải thoáng nhưng không thừa thãi.

Tránh:

- card quá to
- khoảng trắng chết
- input quá cao
- nút quá phồng
- panel kéo dài vô nghĩa

Ưu tiên:

- khối gọn
- khoảng cách đều
- chiều cao control vừa phải
- nhịp điệu spacing ổn định

---

## Nguyên tắc tối giản text — Ít chữ, đẹp nhất

Giao diện enterprise không cần nhiều chữ để trông "chuyên nghiệp". Chuyên nghiệp = rõ ràng + tinh tế + không thừa.

### 1. Mỗi từ phải đáng giá

- Không thêm text chỉ để lấp chỗ trống.
- Không giải thích điều hiển nhiên.
- Nếu xóa một từ mà nghiệp vụ không bị ảnh hưởng → xóa luôn.

### 2. Cấm placeholder / decorative copy vô nghĩa

**Tuyệt đối không dùng các cụm sau trong bất kỳ UI nào:**

- workspace, design principle, internal intake experience
- review command center, explore your data
- welcome to the dashboard, manage everything in one place
- get started with your journey
- "Ở đây bạn có thể quản lý..." trước mỗi bảng
- "This section allows you to..." trước mỗi form
- "Below is the list of..."
- "Here you can see..."
- "Overview of your recent..."

Text phải là **tên sự vật** hoặc **hành động**, không phải mô tả trang trí.

### 3. Form = label + input, không cần giải thích dài

- Label tối đa 3 từ. VD: `Tên dự án`, `Ngày bắt đầu`.
- Không dùng `Please enter your project name`.
- Helper text chỉ dùng khi format thực sự phức tạp (VD: `DD/MM/YYYY`).
- Readonly field không cần chú thích dài.

### 4. Card header = danh từ, không phải câu

- ✅ `Dự án gần đây`
- ❌ `Overview of your recent project activities`

### 5. Empty state = icon + 3-5 từ + 1 câu ngắn + button

- Không mascot, không filler, không 3 dòng mô tả.
- ✅ `Chưa có dự án` + `Nhấn "Tạo mới" để bắt đầu.` + `[Tạo dự án]`

### 6. Dùng icon thay cho text khi icon đã phổ quát

- Search, Filter, Add, Delete, Edit, Settings, Download → dùng icon.
- Không cần chữ kèm theo nếu icon đủ rõ trong context.
- Tooltip (`title` attribute) giữ lại cho accessibility.

### 7. KPI / Metric = số + 1 từ nhãn

- ✅ `42` + `Dự án`
- ❌ `Total number of projects completed this quarter`

### 8. Button = động từ + bổ ngữ

- ✅ `Tạo dự án`, `Xuất báo cáo`, `Gửi duyệt`
- ❌ `Tiếp tục`, `Proceed`, `Explore`, `Open workspace`

### 9. Bảng = header ngắn, không mô tả cột

- ✅ `Tên`, `Trạng thái`, `Ngày tạo`
- ❌ `Project Name Column`, `Current Status Information`

### 10. Popup / Modal title = hành động hoặc tên record

- ✅ `Xác nhận xóa`, `Chi tiết dự án #123`
- ❌ `Delete Confirmation Dialog`, `Project Detail View`

### 11. Tổng kết

Trước khi chốt UI, đếm tổng số từ trên màn hình. Nếu có thể bỏ 30% text mà nghiệp vụ vẫn rõ → bỏ ngay. Đẹp không đến từ nhiều chữ, đẹp đến từ khoảng trắng đúng chỗ, typography chuẩn, và layout có chủ đích.

---

## Layout chuẩn của hệ thống

### Sidebar trái

Sidebar phải có:

- một khối logo công ty ở trên cùng
- chỉ hiển thị logo, không thêm chữ nếu không cần
- phần thông tin user ngay dưới logo
- menu điều hướng dọc rõ ràng

Sidebar phải cho cảm giác:

- trang trọng
- ổn định
- sạch

Không làm sidebar kiểu:

- icon-only quá bí
- màu tối nặng
- nhiều hiệu ứng hover phức tạp

### Main content phải

Main content nên theo cấu trúc:

- top header đơn giản
- title rõ ràng
- body là panel nghiệp vụ

Không dùng:

- hero section
- slogan
- mô tả marketing
- dashboard card phô diễn không cần thiết

### Local navigation hoặc sub-tab

Nếu một màn có nhiều chức năng liên quan, dùng:

- card điều hướng dọc nhỏ
- hoặc tab gọn

Ví dụ:

- Tạo dự án
- Duyệt dự án
- Yêu cầu bổ sung

Sub-nav phải:

- gọn
- rõ trạng thái active
- không chiếm chiều cao vô ích

---

## Quy chuẩn component

### Dùng lại bộ component chung

Mỗi dự án phải có **một** bộ component dùng chung (button, input, select,
textarea, field, card, modal, message, badge, empty state, skeleton) và mọi màn
đều dùng lại bộ đó.

Tự viết một khối `div` có viền và bóng riêng cho từng trang là cách nhanh nhất
để lệch chuẩn: chiều cao control, bo góc, màu viền sẽ trôi mỗi trang một kiểu.
Thiếu component thì **bổ sung vào bộ chung** rồi dùng, không vẽ riêng trong trang.

### Ảnh đại diện

- ảnh tròn, viền mảnh
- chưa có ảnh thì hiện chữ cái đầu của tên trên nền màu thương hiệu, không dùng
  ảnh mặc định kiểu avatar xám hay illustration
- hiện ở nơi cần nhận diện người: khối người dùng trên sidebar, danh sách người
  trong khu quản trị

### Card

Card phải:

- nền trắng
- border mảnh
- shadow nhẹ
- bo góc vừa phải

Không được:

- bo quá tròn
- shadow đậm
- nhiều lớp card lồng nhau vô lý

### Form

Form phải:

- chia nhóm field rõ
- dùng label rõ nghĩa
- input cùng chiều cao
- căn hàng chuẩn
- tránh chiều ngang quá dài làm khó đọc

Nếu là desktop:

- tận dụng 2 cột khi hợp lý
- nhưng không dàn ngang vô nghĩa

### Read-only field

Field readonly phải nhìn khác field nhập:

- nền xám/trắng dịu
- có border rõ
- nội dung dễ scan

Ví dụ:

- Nhà thầu chính
- Mã công ty
- Thông tin tự động

### Button

Button phải phân cấp rõ:

- primary: xanh hoặc màu hành động chính
- secondary: trắng viền xám
- destructive: đỏ nhạt/đỏ
- warning/request: vàng nhạt hoặc tông cảnh báo nhẹ

Không dùng:

- nút đen lớn trừ khi có yêu cầu đặc biệt
- nút phồng
- gradient button

### Table

Table phải gần kiểu phần mềm nội bộ:

- header rõ
- row dễ quét
- cột đọc nhanh
- text căn chỉnh ổn định

Nếu dữ liệu nhiều:

- ưu tiên bảng thay vì card list
- popup chi tiết thay vì nhồi preview ngay trong trang

### Popup / modal

Popup phải:

- là nơi xem chi tiết nghiệp vụ
- đủ thông tin để ra quyết định
- có action rõ ràng

Không làm popup kiểu:

- card mini thiếu thông tin
- quá trang trí
- nhiều panel phụ không cần thiết

### Motion cho thao tác danh sách trong popup

Các thao tác thêm/gỡ phần tử trong popup (ví dụ: Quản lý thành viên phòng ban) phải mượt và có phản hồi ngay.

Bắt buộc:

- cập nhật UI tức thì trong popup, không chờ reload toàn trang
- dùng animation ngắn 160ms-240ms cho item enter/exit
- dùng `layout` animation để các row tự dồn mượt, không giật
- có thể dùng `ghost row` mờ 200ms-300ms tại cột nguồn để người dùng cảm nhận item vừa được chuyển

Không được:

- set loading toàn trang khi thao tác trong popup
- tạo cảm giác "nháy trắng" hoặc remount cả màn
- dùng animation nảy (bouncy), quá dài, hoặc gây mất tập trung

---

## Pattern chuẩn cho màn nghiệp vụ

### Màn tạo và duyệt dự án

Đây là mẫu chuẩn tham chiếu cho các màn nghiệp vụ khác.

Cấu trúc đúng:

- sidebar trái chuẩn
- sub-nav dọc nhỏ bên trong content
- panel lớn bên phải
- form hoặc bảng nghiệp vụ là trọng tâm

Tab `Tạo dự án`:

- form nghiệp vụ sạch
- thông tin nhập liệu rõ
- nhà thầu chính readonly
- liên danh là khối phụ có điều kiện

Tab `Duyệt dự án`:

- danh sách dạng bảng hoặc gần bảng
- không dùng card preview nặng trong trang
- mở popup chi tiết để duyệt

Tab `Yêu cầu bổ sung`:

- danh sách riêng
- rõ dự án nào cần sửa
- CTA rõ để vào sửa và gửi lại

---

## Trang lỗi, 404 và trang cảnh báo

Trang lỗi cũng là màn hình của hệ thống, **không phải chỗ để đổi phong cách**.
Không được nhân dịp này làm màn tối, banner đen, hay hiệu ứng doạ nạt.

Bắt buộc:

- nền sáng như mọi trang khác, card trắng viền mảnh
- dùng lại component chung của dự án, không tự vẽ khối riêng
- icon trạng thái tô màu nhạt, không icon lớn giữa màn
- nội dung: **tiêu đề + đúng một câu + dữ kiện + một hành động**

Cấu trúc nội dung:

- tiêu đề nói thẳng chuyện gì vừa xảy ra
- một câu hệ quả
- dữ kiện liên quan nếu có, dạng chip nền xám nhạt
- một nút đưa người dùng về chỗ làm việc được

Không được:

- nền tối toàn màn
- card tối, nút trắng lớn trên nền tối
- nhiều đoạn giải thích cơ chế phía sau

Nếu trang có câu kiểu "hành động này đã được ghi lại", thì hệ thống **phải ghi
thật** và phải có nơi cho người quản trị xem. Doạ suông sẽ lộ ngay lần đầu có
người hỏi lại.

---

## Chú thích, nhãn phụ và helper text

Người dùng nội bộ **không đọc chú thích**. Mỗi dòng chú thích phải tự kiếm được
chỗ đứng, nếu không thì bỏ.

### Chú thích dưới bảng / lưới (legend)

- đúng **một dòng**, dạng `MÃ Nhãn · MÃ Nhãn · ...`
- chỉ ghi mã và tên gọi, **không lặp lại thông số đã hiện sẵn trong lưới**
- không giải thích màu bằng đoạn văn — màu phải tự nói được nghĩa qua ngữ cảnh
- không thêm câu dẫn sang trang khác ở cuối khối chú thích

SAI: danh sách dọc nhiều dòng, mỗi mã một dòng kèm lại đúng những thông số đã
nằm ở cột đầu hoặc hàng đầu của lưới.

### Helper text dưới field

- chỉ dùng khi **định dạng** thực sự khó đoán (`DD/MM/YYYY`, `Ít nhất 6 ký tự`)
- **không** dùng để mô tả trạng thái đã nhìn thấy được: field khoá, nền xám, giá
  trị tự điền sẵn thì người dùng đã hiểu, thêm chú thích chỉ là nhiễu
- không dùng để dạy nghiệp vụ; nghiệp vụ thuộc về tài liệu, không thuộc về form

---

## Giọng văn và từ ngữ

Text trong UI phải là **tiếng Việt đời thường của người đi làm**, không phải văn
hành chính, cũng không phải văn nói đùa.

| Không dùng | Dùng |
|---|---|
| khai báo, kê khai | ghi, nhập |
| tiến hành, thực hiện việc | (bỏ, dùng thẳng động từ chính) |
| Quý người dùng vui lòng... | (bỏ) |
| câu đùa, tiếng lóng ở empty state | tên trạng thái thật |

Ba luật:

1. **Không từ hành chính.** Nếu một từ chỉ xuất hiện trong công văn, đừng đưa vào
   giao diện dùng hằng ngày.
2. **Không đùa, không lóng, không mỉa.** Phần mềm quản trị được đọc bởi cả ban
   giám đốc; câu đùa hôm nay là câu khó xử khi in ra họp.
3. **Không doạ người dùng bằng chữ** ở màn nghiệp vụ bình thường. Cảnh báo chỉ
   xuất hiện ở đúng nơi có chuyện.

---

## Màn người dùng cuối khác màn quản trị

Hai khu vực phục vụ hai nhu cầu khác nhau, không bê nguyên bố cục bên này sang
bên kia.

**Màn người dùng nghiệp vụ** — chỉ phục vụ việc họ đang phải làm:

- hiện đúng phần họ thao tác được ngay lúc này
- không thêm bảng lịch sử, điều hướng theo kỳ, hay số liệu tổng hợp nếu họ không
  có quyền sửa phần đó
- một trang một việc; dồn thêm chức năng "cho tiện" là làm chậm người dùng

**Màn quản trị** — nơi chứa lịch sử, tổng hợp, xuất báo cáo:

- bảng là chính, có bộ lọc
- chi tiết mở bằng modal, không nhồi vào trang

Trước khi thêm một khối vào màn người dùng cuối, hỏi: *họ có thao tác được với
nó không?* Nếu chỉ để xem cho biết thì phần lớn là thừa.

---

## File xuất ra cho người khác (Excel / CSV / PDF)

File xuất ra được gửi cho bộ phận khác, cho lãnh đạo, cho đối tác — nó là bộ mặt
của hệ thống y như màn hình, và phải trình bày theo **mẫu biểu**, không phải đổ
dữ liệu thô.

Bắt buộc:

- khối tiêu đề: tên tổ chức, tên báo cáo, kỳ báo cáo, ngày xuất
- tiêu đề **chỉ gộp ô qua khối bên trái**. Bảng rộng mà gộp hết chiều ngang thì
  tiêu đề rơi vào giữa vùng dữ liệu, mở file lên không nhìn thấy
- cột là chuỗi thời gian thì dùng hai dòng tiêu đề (mốc ở trên, nhãn phụ ở dưới);
  các cột định danh gộp dọc hai dòng
- khoá khung (freeze panes) ở dòng tiêu đề và các cột định danh
- kẻ viền toàn bảng, dòng lẻ tô nhạt
- các nhóm cột khác nhau thì khác màu nền tiêu đề
- ô dữ liệu **kế thừa đúng bảng màu trạng thái đang dùng trên web**, để người xem
  file và người xem màn hình hiểu cùng một thứ
- cột số phải là **kiểu số** có định dạng rõ để người nhận cộng được ngay; bảng
  nhiều dòng thì có dòng tổng cộng
- hướng giấy ngang cho bảng nhiều cột

Không được:

- xuất file chỉ có header và dữ liệu, không tiêu đề, không định dạng
- dùng ký hiệu mà người nhận ngoài hệ thống không có cách nào hiểu

---

## Những thứ phải tránh tuyệt đối

- black hero banner
- dark top section lớn
- gradient rực
- text viết hoa giãn chữ
- card quá to
- nhiều câu mô tả vô nghĩa
- giao diện “AI dashboard”
- icon trang trí dày đặc
- quá nhiều màu trên cùng một màn
- bảng bị card hóa
- popup thiếu dữ liệu
- preview nhồi thẳng vào màn khi nên dùng modal

---

## Từ khóa thiết kế đúng

Khi mô tả cho AI khác, dùng các từ khóa sau:

- enterprise admin dashboard
- internal operations software
- Vietnamese enterprise management UI
- clean B2B backoffice interface
- realistic internal business system
- serious PMO / approval workflow UI
- table-first admin UX

Các từ khóa nên tránh:

- futuristic
- AI-native UI
- glassmorphism
- neo dashboard
- startup landing
- bold experimental art direction

---

## Prompt chuẩn để giao cho AI khác

```text
Read UI_STYLE_GUIDE.md first and follow it strictly.

Design this screen as a serious Vietnamese enterprise internal dashboard. 
This is business software used by managers, department heads, admins, and directors. 
The UI must feel practical, trustworthy, and highly professional.

Requirements:
- white enterprise admin layout
- left sidebar
- clean main content area
- subtle borders and soft shadows
- strong typography hierarchy
- no hero banner
- no decorative text
- no black marketing sections
- no futuristic AI visual style
- no oversized cards
- no gradient-heavy visuals

The design must look like a real internal operations system, not a startup showcase.

Focus on:
- readability
- alignment
- compact but breathable spacing
- business workflow clarity
- realistic admin UX

Use tables for dense operational data.
Use modal dialogs for detail preview and approvals.
Use calm colors and avoid visual noise.
```

---

## Prompt chuẩn cho việc redesign màn hiện có

```text
Redesign this existing screen without changing business logic.

You must preserve:
- existing workflow
- existing API behavior
- current user permissions
- current form structure unless explicitly asked

You must improve:
- spacing
- typography
- visual hierarchy
- alignment
- enterprise professionalism
- usability for daily internal operations
- reduce text to the minimum (remove decorative copy, filler, and placeholder text)

Do not turn this into a landing page.
Do not add decorative copy.
Do not invent AI-style dark sections.
Do not use oversized cards or trendy visuals.

The final result must match the style rules in UI_STYLE_GUIDE.md.
```

---

## Câu lệnh nên dùng ở đầu phiên chat mới

Khi bắt đầu phiên mới với AI, dùng câu này:

```text
Trước khi làm UI, hãy đọc file DESIGN/UI_STYLE_GUIDE.md và bám đúng phong cách trong đó. Không được làm lệch sang kiểu AI, startup, landing page, hay giao diện màu mè. Tối giản text tối đa — mỗi từ phải có giá trị nghiệp vụ, không dùng placeholder hay mô tả trang trí.
```

---

## Tiêu chí tự kiểm trước khi chốt UI

Trước khi coi một UI là đạt, phải tự hỏi:

- nhìn có giống phần mềm nội bộ doanh nghiệp thật không?
- có bị màu mè hoặc “AI-generated” không?
- có khoảng trắng thừa không?
- có card nào quá to không?
- typography có nghiêm túc và dễ đọc không?
- thao tác chính có rõ không?
- bảng có dễ quét không?
- popup có đủ dữ liệu để ra quyết định không?
- active state có rõ nhưng không chói không?
- người quản lý dùng hàng ngày có thấy tin cậy không?
- có thể bỏ 30% text mà nghiệp vụ vẫn rõ không?
- có chỗ nào dùng placeholder / decorative copy vô nghĩa không?
- trang lỗi / cảnh báo có đang lệch sang nền tối không?
- chú thích dưới lưới có lặp lại thứ đã hiện trong lưới không?
- có từ hành chính ("khai báo", "tiến hành") hay câu đùa nào lọt vào không?
- màn người dùng cuối có khối nào họ không thao tác được mà vẫn bày ra không?

Nếu tôi đưa ra yêu cầu, với bất kì lí do nào như không đủ thông tin, thiếu yêu cầu, nói không hiểu thì PHẢI HỎI LẠI TÔI đến khi sáng tỏ yêu cầu.
Nếu một trong các câu trên trả lời là “không”, phải chỉnh lại.

---

## Tailwind CSS v4 — Implementation Notes

**Dự án này dùng Tailwind CSS v4.** Không có file `tailwind.config.ts`. Tất cả design tokens phải được khai báo dưới dạng CSS custom properties trong `app/globals.css` bằng cú pháp `@theme inline`.

### Tech stack:
- `app/globals.css` — Nơi khai báo design tokens (CSS `@theme inline`)
- `@import “tailwindcss”` — Import Tailwind v4
- KHÔNG có `tailwind.config.ts`

### Màu sắc trong Tailwind v4:
Dùng Tailwind arbitrary value hoặc standard palette classes:

```tsx
// ✅ Dùng standard Tailwind palette classes
<div className=”bg-slate-50 text-slate-900 border-slate-200”>
<button className=”bg-sky-600 hover:bg-sky-700 text-white”>
<span className=”bg-emerald-50 text-emerald-700 border-emerald-200”>

// ❌ KHÔNG dùng — không có trong Tailwind palette
<div className=”bg-[#0284C7]”>
<div className=”text-[#0F172A]”>
```

### Cách mapping Design Token → Tailwind Class:

| Design Token | Tailwind Class |
|---|---|
| Primary | `sky-600` |
| Primary Hover | `sky-700` |
| Primary Soft | `sky-50` |
| Success | `emerald-600` hoặc `emerald-700` |
| Warning | `amber-500` hoặc `amber-600` |
| Danger | `rose-600` |
| Background | `slate-50` |
| Surface | `white` |
| Text Primary | `slate-900` |
| Text Secondary | `slate-600` |
| Text Muted | `slate-500` |
| Border Default | `slate-200` |
| Border Strong | `slate-300` |

### Border Radius trong Tailwind:

| Giá trị px | Tailwind | Dùng cho |
|---|---|---|
| 6px | `rounded-sm` | Badges, chips |
| 10px | `rounded` hoặc `rounded-md` | Buttons, inputs |
| 12px | `rounded-lg` | Cards, menus |
| 16px | `rounded-xl` | Panels, modals |
| 20px | `rounded-2xl` | Major blocks |
| 9999px | `rounded-full` | Avatar, pill (hạn chế) |

### Control Heights:

| Control | Tailwind | Chiều cao |
|---|---|---|
| Input / Select | `h-11` | 44px |
| Button (default) | `h-10` hoặc `h-11` | 40-44px |
| Button (small) | `h-8` | 32px |

---

## Câu lệnh bắt đầu phiên mới cho AI

Khi bắt đầu phiên làm việc mới, dùng câu lệnh sau:

```text
Trước khi làm UI, hãy đọc các file trong DESIGN/ theo thứ tự:
1. UI_STYLE_GUIDE.md — tinh thần và nguyên tắc thiết kế
2. DESIGN_GUI.md — hard token definitions
3. DESIGN_IMPLEMENTATION_GUIDE.md — cách implement tokens vào Tailwind CSS v4

Dự án dùng Tailwind CSS v4 (CSS @theme inline, không có tailwind.config.ts).
Không được dùng gradient, màu AI-style (purple/violet/indigo), arbitrary radius ngoài scale 6/10/12/16/20px.
Tối giản text — xóa bỏ mọi placeholder, decorative copy, và mô tả thừa.
```

---

## Audit — Trạng thái hiện tại của codebase

> **Lưu ý:** phần audit dưới đây là ảnh chụp của **một dự án cụ thể** tại thời
> điểm audit. Đường dẫn trong đó chỉ đúng với dự án ấy — dự án khác đừng đi tìm
> file theo đường dẫn này. Phần nguyên tắc thì áp dụng chung.

Đã audit toàn bộ 20+ user-facing pages trong `app/dashboard/user/`.

### CRITICAL — Vi phạm nghiêm trọng

- **`app/dashboard/user/page.tsx`** — KPI cards dùng gradient (`from-green-500 to-green-600`, `from-purple-500 to-purple-600`, etc.)
- **`app/dashboard/user/spaces/page.tsx`** — Pervasive màu green không đúng spec palette
- **`app/dashboard/user/project-init/page.tsx`** — `rounded-[28px]`, `shadow-[0_20px_60px...]`, `bg-[linear-gradient(...)]`, backdrop không chuẩn

### MAJOR — Vi phạm nhiều

- **`app/dashboard/user/director-projects/page.tsx`** — Arbitrary colors (blue/emerald/amber/rose/purple) trong status badges
- **`app/dashboard/user/projects/[id]/page.tsx`** — `rounded-[32px]`, `text-[36px]`, `shadow-2xl`
- **`app/dashboard/user/projects/page.tsx`** — h2 30px (spec: 24px), indigo/violet/teal palette
- **`app/dashboard/user/project-init/[id]/supplement/page.tsx`** — Purple/orange palette

### MINOR — Vi phạm nhỏ

- **`app/dashboard/user/ai/page.tsx`** — H1 `text-xl` (spec: 30px), `text-black`
- **`app/dashboard/user/chat/page.tsx`** — H1 `text-xl`
- **`app/dashboard/user/company-projects/page.tsx`** — `text-black` pervasive
- **`app/dashboard/user/company-structure/page.tsx`** — `text-green-600` không đúng spec green
- **`app/dashboard/user/customers/page.tsx`** — `rounded-full`, blue-50 ngoài spec
- **`app/dashboard/user/documents/page.tsx`** — `text-black` pervasive
- **`app/dashboard/user/payments/page.tsx`** — `text-black`, h-12 inputs
- **`app/dashboard/user/reports/page.tsx`** — `text-black`
- **`app/dashboard/user/settings/page.tsx`** — `h-12` inputs, `rounded-[24px]`

### Clean

- **`app/dashboard/user/meeting-rooms/page.tsx`** — ~85% compliant, gần nhất với spec
- **`app/dashboard/user/consortium/page.tsx`** — nearly clean

**Priority fix order:** Critical → Major → Minor
