# Design System — Hệ thống Thiết kế (VN)

> **Nguồn:** file này được gộp từ 4 file gốc trong `DESIGN/`, giữ nguyên toàn bộ nội dung:
> `UI_STYLE_GUIDE.md` → Phần I & V · `DESIGN_GUI_VN.md` → Phần II · `DESIGN_IMPLEMENTATION_GUIDE.md` → Phần III · Audit của cả 3 file → Phần IV.
> 4 file gốc vẫn được giữ nguyên, không chỉnh sửa.
>
> Khi 2 file nguồn nêu giá trị khác nhau cho cùng một thứ, **cả hai giá trị đều được giữ lại** và ghi rõ xuất xứ trong ngoặc — không bên nào bị loại bỏ.

---

## Mục lục / Table of Contents

- [Phần I — Tinh thần thiết kế & Nguyên tắc bắt buộc](#phần-i-tinh-thần-thiết-kế-nguyên-tắc-bắt-buộc)
  - [Mục đích](#mục-đích)
  - [Tinh thần thiết kế](#tinh-thần-thiết-kế)
  - [Nguyên tắc bắt buộc](#nguyên-tắc-bắt-buộc)
  - [Nguyên tắc tối giản text — Ít chữ, đẹp nhất](#nguyên-tắc-tối-giản-text-ít-chữ-đẹp-nhất)
  - [Layout chuẩn của hệ thống](#layout-chuẩn-của-hệ-thống)
  - [Quy chuẩn component](#quy-chuẩn-component)
  - [Pattern chuẩn cho màn nghiệp vụ](#pattern-chuẩn-cho-màn-nghiệp-vụ)
  - [Những thứ phải tránh tuyệt đối](#những-thứ-phải-tránh-tuyệt-đối)
  - [Từ khóa thiết kế đúng](#từ-khóa-thiết-kế-đúng)
  - [Tiêu chí tự kiểm trước khi chốt UI](#tiêu-chí-tự-kiểm-trước-khi-chốt-ui)
- [Phần II — Spec thiết kế cốt lõi](#phần-ii-spec-thiết-kế-cốt-lõi)
  - [1. Purpose](#1-purpose)
  - [2. Design Philosophy](#2-design-philosophy)
  - [3. Core Visual Language](#3-core-visual-language)
  - [4. Component Rules](#4-component-rules)
  - [5. Layout Rules and Responsive Standards](#5-layout-rules-and-responsive-standards)
  - [6. Content Rules](#6-content-rules)
  - [7. Context Adaptation](#7-context-adaptation)
  - [8. Anti-Patterns](#8-anti-patterns)
  - [9. Execution Rules](#9-execution-rules)
  - [10. Tối giản text & Cấm placeholder](#10-tối-giản-text-cấm-placeholder)
  - [11. Accessibility & WCAG](#11-accessibility-wcag)
  - [12. Notifications, Toasts & Snackbars](#12-notifications-toasts-snackbars)
  - [13. Loading & Skeleton States](#13-loading-skeleton-states)
  - [14. Data Visualization & Charts](#14-data-visualization-charts)
  - [15. Iconography Deep-Dive](#15-iconography-deep-dive)
  - [16. File Attachment & Upload Patterns](#16-file-attachment-upload-patterns)
  - [17. Navigation Deep-Dive](#17-navigation-deep-dive)
  - [18. Onboarding, Tooltips & Coach Marks](#18-onboarding-tooltips-coach-marks)
- [Phần III — Triển khai Tailwind CSS v4](#phần-iii-triển-khai-tailwind-css-v4)
  - [Mục đích](#mục-đích)
  - [1. Cách đọc Design Spec](#1-cách-đọc-design-spec)
  - [2. Tech Stack hiện tại](#2-tech-stack-hiện-tại)
  - [3. Màu sắc — Token Mapping](#3-màu-sắc-token-mapping)
  - [4. Border Radius — ĐÚNG và SAI](#4-border-radius-đúng-và-sai)
  - [5. Typography — Scale chuẩn](#5-typography-scale-chuẩn)
  - [6. Control Heights](#6-control-heights)
  - [7. Shadows — ĐÚNG và SAI](#7-shadows-đúng-và-sai)
  - [8. Status Color Mapping chuẩn](#8-status-color-mapping-chuẩn)
  - [9. Overlay / Backdrop chuẩn](#9-overlay-backdrop-chuẩn)
  - [10. Quick Reference Checklist](#10-quick-reference-checklist)
  - [11. Cách mapping từ Design Token → Tailwind Class](#11-cách-mapping-từ-design-token-tailwind-class)
  - [12. Cách fix gradient cards (pattern phổ biến nhất)](#12-cách-fix-gradient-cards-pattern-phổ-biến-nhất)
  - [13. Tổ chức file khi refactor](#13-tổ-chức-file-khi-refactor)
  - [13.1 Pattern Animation Chuẩn (Ghost Row + Realtime Update)](#131-pattern-animation-chuẩn-ghost-row-realtime-update)
  - [14. Những thứ KHÔNG ĐƯỢC LÀM](#14-những-thứ-không-được-làm)
  - [15. Những thứ ĐƯỢC LÀM](#15-những-thứ-được-làm)
- [Phần IV — Audit codebase](#phần-iv-audit-codebase)
  - [Audit — Trạng thái hiện tại của codebase / các user pages](#audit-trạng-thái-hiện-tại-của-codebase-các-user-pages)
- [Phần V — Prompt cho phiên làm việc AI](#phần-v-prompt-cho-phiên-làm-việc-ai)
  - [Prompt chuẩn để giao cho AI khác](#prompt-chuẩn-để-giao-cho-ai-khác)
  - [Prompt chuẩn cho việc redesign màn hiện có](#prompt-chuẩn-cho-việc-redesign-màn-hiện-có)
  - [Câu lệnh nên dùng ở đầu phiên chat mới](#câu-lệnh-nên-dùng-ở-đầu-phiên-chat-mới)
  - [Câu lệnh bắt đầu phiên mới cho AI](#câu-lệnh-bắt-đầu-phiên-mới-cho-ai)

---

## Phần I — Tinh thần thiết kế & Nguyên tắc bắt buộc

### Mục đích

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

### Tinh thần thiết kế

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

### Nguyên tắc bắt buộc

#### 1. Ưu tiên nghiệp vụ hơn trình diễn

Mọi layout phải phục vụ thao tác nghiệp vụ trước:

- nhập liệu rõ ràng
- duyệt dữ liệu rõ ràng
- bảng dễ quét
- popup dễ đọc
- CTA rõ nghĩa

Nếu một thành phần đẹp nhưng làm thao tác chậm hơn, phải bỏ.

#### 2. Không dùng chữ trang trí vô nghĩa

Không được thêm các dòng kiểu:

- workspace
- design principle
- internal intake experience
- review command center

trừ khi người dùng yêu cầu rõ.

Text phải thực dụng, đúng nghiệp vụ, ngắn, rõ.

#### 3. Không dùng kiểu chữ kéo giãn

Không dùng:

- letter spacing rộng
- uppercase trang trí
- các label kiểu tiêu đề mỹ thuật

Typography phải:

- bình thường
- đậm vừa đủ
- dễ đọc
- giống phần mềm doanh nghiệp

#### 4. Màu sắc phải nền nã

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

#### 5. Khoảng trắng phải hợp lý

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

### Nguyên tắc tối giản text — Ít chữ, đẹp nhất

Giao diện enterprise không cần nhiều chữ để trông "chuyên nghiệp". Chuyên nghiệp = rõ ràng + tinh tế + không thừa.

#### 1. Mỗi từ phải đáng giá

- Không thêm text chỉ để lấp chỗ trống.
- Không giải thích điều hiển nhiên.
- Nếu xóa một từ mà nghiệp vụ không bị ảnh hưởng → xóa luôn.

#### 2. Cấm placeholder / decorative copy vô nghĩa

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

#### 3. Form = label + input, không cần giải thích dài

- Label tối đa 3 từ. VD: `Tên dự án`, `Ngày bắt đầu`.
- Không dùng `Please enter your project name`.
- Helper text chỉ dùng khi format thực sự phức tạp (VD: `DD/MM/YYYY`).
- Readonly field không cần chú thích dài.

#### 4. Card header = danh từ, không phải câu

- ✅ `Dự án gần đây`
- ❌ `Overview of your recent project activities`

#### 5. Empty state = icon + 3-5 từ + 1 câu ngắn + button

- Không mascot, không filler, không 3 dòng mô tả.
- ✅ `Chưa có dự án` + `Nhấn "Tạo mới" để bắt đầu.` + `[Tạo dự án]`

#### 6. Dùng icon thay cho text khi icon đã phổ quát

- Search, Filter, Add, Delete, Edit, Settings, Download → dùng icon.
- Không cần chữ kèm theo nếu icon đủ rõ trong context.
- Tooltip (`title` attribute) giữ lại cho accessibility.

#### 7. KPI / Metric = số + 1 từ nhãn

- ✅ `42` + `Dự án`
- ❌ `Total number of projects completed this quarter`

#### 8. Button = động từ + bổ ngữ

- ✅ `Tạo dự án`, `Xuất báo cáo`, `Gửi duyệt`
- ❌ `Tiếp tục`, `Proceed`, `Explore`, `Open workspace`

#### 9. Bảng = header ngắn, không mô tả cột

- ✅ `Tên`, `Trạng thái`, `Ngày tạo`
- ❌ `Project Name Column`, `Current Status Information`

#### 10. Popup / Modal title = hành động hoặc tên record

- ✅ `Xác nhận xóa`, `Chi tiết dự án #123`
- ❌ `Delete Confirmation Dialog`, `Project Detail View`

#### 11. Tổng kết

Trước khi chốt UI, đếm tổng số từ trên màn hình. Nếu có thể bỏ 30% text mà nghiệp vụ vẫn rõ → bỏ ngay. Đẹp không đến từ nhiều chữ, đẹp đến từ khoảng trắng đúng chỗ, typography chuẩn, và layout có chủ đích.

---

### Layout chuẩn của hệ thống

#### Sidebar trái

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

#### Main content phải

Main content nên theo cấu trúc:

- top header đơn giản
- title rõ ràng
- body là panel nghiệp vụ

Không dùng:

- hero section
- slogan
- mô tả marketing
- dashboard card phô diễn không cần thiết

#### Local navigation hoặc sub-tab

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

### Quy chuẩn component

#### Card

Card phải:

- nền trắng
- border mảnh
- shadow nhẹ
- bo góc vừa phải

Không được:

- bo quá tròn
- shadow đậm
- nhiều lớp card lồng nhau vô lý

#### Form

Form phải:

- chia nhóm field rõ
- dùng label rõ nghĩa
- input cùng chiều cao
- căn hàng chuẩn
- tránh chiều ngang quá dài làm khó đọc

Nếu là desktop:

- tận dụng 2 cột khi hợp lý
- nhưng không dàn ngang vô nghĩa

#### Read-only field

Field readonly phải nhìn khác field nhập:

- nền xám/trắng dịu
- có border rõ
- nội dung dễ scan

Ví dụ:

- Nhà thầu chính
- Mã công ty
- Thông tin tự động

#### Button

Button phải phân cấp rõ:

- primary: xanh hoặc màu hành động chính
- secondary: trắng viền xám
- destructive: đỏ nhạt/đỏ
- warning/request: vàng nhạt hoặc tông cảnh báo nhẹ

Không dùng:

- nút đen lớn trừ khi có yêu cầu đặc biệt
- nút phồng
- gradient button

#### Table

Table phải gần kiểu phần mềm nội bộ:

- header rõ
- row dễ quét
- cột đọc nhanh
- text căn chỉnh ổn định

Nếu dữ liệu nhiều:

- ưu tiên bảng thay vì card list
- popup chi tiết thay vì nhồi preview ngay trong trang

#### Popup / modal

Popup phải:

- là nơi xem chi tiết nghiệp vụ
- đủ thông tin để ra quyết định
- có action rõ ràng

Không làm popup kiểu:

- card mini thiếu thông tin
- quá trang trí
- nhiều panel phụ không cần thiết

#### Motion cho thao tác danh sách trong popup

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

### Pattern chuẩn cho màn nghiệp vụ

#### Màn tạo và duyệt dự án

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

### Những thứ phải tránh tuyệt đối

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

### Từ khóa thiết kế đúng

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

### Tiêu chí tự kiểm trước khi chốt UI

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

Nếu tôi đưa ra yêu cầu, với bất kì lí do nào như không đủ thông tin, thiếu yêu cầu, nói không hiểu thì PHẢI HỎI LẠI TÔI đến khi sáng tỏ yêu cầu.
Nếu một trong các câu trên trả lời là “không”, phải chỉnh lại.

---


---

## Phần II — Spec thiết kế cốt lõi

### 1. Purpose

`DESIGN_GUI_VN.md` (→ **Phần II** của tài liệu này) định nghĩa toàn bộ rule GUI dùng chung cho các sản phẩm web và mobile trên nhiều project khác nhau.

File này tồn tại để:

- thiết lập một baseline nhất quán cho `layout`, `hierarchy`, `spacing`, `component`, và `interaction behavior`
- giảm tình trạng UI bị lệch giữa các product, team, và style triển khai
- cho phép từng product có cá tính riêng mà không phá vỡ `core visual language`
- làm tài liệu tham chiếu cho designer, developer, reviewer, và AI assistant trước khi đưa ra quyết định về UI

Guide này có tính `platform-aware` nhưng `product-agnostic`.

Nó được thiết kế để dùng cho:

- dashboard
- internal tool
- CRUD system
- operational workflow
- detail page
- form-heavy product
- mobile application
- consumer-facing product screen

Tài liệu này mang tính `prescriptive`.

Khi một pattern đã được định nghĩa ở đây, pattern đó phải được coi là mặc định, trừ khi có lý do rất rõ ràng liên quan tới `functional requirement`, `accessibility`, `performance`, hoặc `maintainability`.

Đây không phải là `brand book`, không phải `feature specification`, và cũng không phải một `component inventory` đầy đủ.

Đây là một bộ rule dùng chung để xây dựng giao diện rõ ràng, dễ dùng, và nhất quán.

### 2. Design Philosophy

GUI nên mang cảm giác:

- clean
- product-first
- calm
- modern
- practical
- slightly premium
- not decorative

Giao diện phải ưu tiên `clarity`, `usability`, và `structure` trước `visual novelty`.

Mỗi screen phải cho cảm giác được thiết kế có chủ đích, nhưng không được `over-designed`.

`Design language` này phải đủ linh hoạt để hỗ trợ cả workflow dày đặc lẫn product hiện đại, nhưng vẫn giữ nguyên bản sắc cốt lõi.

#### Principles

- Ưu tiên `utility` hơn `ornament`.
- Ưu tiên sự tinh gọn có kiểm soát hơn `visual drama`.
- Giữ giao diện đủ yên để content vẫn là trung tâm.
- Dùng `hierarchy` để dẫn hướng sự chú ý, không dùng effect.
- Thiết kế cho việc sử dụng lặp lại hằng ngày, không phải để gây ấn tượng một lần.
- Giữ system đủ bền để dùng qua nhiều chu kỳ phát triển của product.
- Duy trì tính nhất quán giữa screen, state, và flow.

#### What The System Should Not Be

- flashy
- trend-driven
- decorative
- presentation-first
- emotionally exaggerated
- template-like
- dependent on novelty to feel modern

#### Quality Bar

Một screen tốt phải rõ ngay từ lần quét đầu tiên, thoải mái khi dùng lặp lại, và đủ đáng tin trong môi trường product thực tế.

Nó phải refined nhưng không precious, và minimal nhưng không trống rỗng.

### 3. Core Visual Language

#### Typography

Sử dụng `neutral modern sans-serif` làm hệ `type` mặc định.

Hướng ưu tiên:

- `Inter` là lựa chọn mặc định
- `SF Pro`, `Segoe UI`, hoặc các `platform-native equivalent` khi cần
- `Plus Jakarta Sans` hoặc `Manrope` chỉ dùng khi product cần cảm giác mềm hơn một chút nhưng không được playful

`Typography` nên mang cảm giác:

- clear
- quiet
- highly legible
- product-oriented

Rules:

- dùng `type scale` có kiểm soát
- chỉ dựa vào `regular`, `medium`, và `semibold` làm `primary weight`
- thể hiện `hierarchy` bằng `size`, `weight`, và `spacing`
- mặc định dùng `sentence case`
- giữ `body copy` ổn định trong các giao diện dày đặc

Avoid:

- decorative display font
- condensed font
- handwritten hoặc expressive font
- AI-styled typography
- heavy uppercase styling
- wide letter spacing dùng để trang trí
- hero typography quá khổ trong product UI

#### Color System

Base UI mặc định phải là `light theme`.

Dùng màu để truyền đạt `structure` và `meaning`, không dùng để trang trí.

Hành vi của `base palette`:

- surface trắng và off-white dịu
- neutral thuộc nhóm cool gray và slate
- deep slate hoặc navy cho `primary text`
- muted slate cho `secondary text`
- blue tiết chế cho `primary action` và `active state`
- muted green chỉ cho `positive state`
- muted amber chỉ cho `warning`
- muted red chỉ cho `destructive` hoặc `critical state`

Các `color role` gợi ý:

- `Background`: soft off-white
- `Surface`: white
- `Surface Alt`: very light gray-blue
- `Text Primary`: deep slate or navy
- `Text Secondary`: muted slate
- `Border`: soft neutral gray
- `Primary`: medium blue
- `Primary Soft`: pale blue
- `Success`: muted green
- `Warning`: muted amber
- `Danger`: muted red

Rules:

- giữ `palette` neutral và cân bằng
- chỉ dùng một `primary accent color` một cách nhất quán
- định nghĩa `semantic color` rõ ràng
- duy trì `accessible contrast` ở mọi state
- ưu tiên `flat color layer` và `soft tonal shift`

Avoid:

- gradient-heavy UI
- neon accent
- purple AI-style palette
- black-heavy dramatic surface
- glow effect
- phối màu trang trí quá gắt

#### Spacing

`Spacing` phải cho cảm giác nhất quán và yên tĩnh.

UI cần đủ thoáng để dễ đọc, nhưng không được tạo cảm giác rỗng.

Rules:

- dùng `spacing scale` có tính dự đoán như `4, 8, 12, 16, 24, 32, 48`
- giữ `section rhythm` ổn định
- chỉ siết `spacing` khi `density` thực sự cần
- ưu tiên `structural spacing` thay vì bố cục mang tính biểu diễn

Avoid:

- giá trị `spacing` lẻ không có lý do
- khoảng cách section quá lớn
- `card padding` quá nhiều
- `control` quá cao
- content block trôi nổi, cô lập

#### Radius

`Rounded corner` phải hiện đại nhưng tiết chế.

Rules:

- mặc định dùng `small-to-medium radius`
- áp cùng một `radius scale` cho các họ `component` liên quan
- chỉ dùng `radius` lớn hơn cho `container` quan trọng khi thật sự cần nhấn tách lớp

Avoid:

- bubble UI quá tròn
- pill shape ở mọi nơi
- hình học playful làm yếu đi chất product

#### Borders

Dùng `border` như một công cụ tạo `structure`, không phải trang trí.

Rules:

- ưu tiên `low-contrast border` để tách lớp
- dùng border nhất quán trên input, card, table, và overlay
- giữ `border thickness` ổn định toàn hệ thống
- thay đổi border ở `hover`, `focus`, và `selected state` theo cách tiết chế

Avoid:

- outline nặng không có lý do
- border weight không nhất quán

#### Shadows

`Shadow` phải phục vụ `elevation`, không tạo cảm giác phô diễn.

Rules:

- dùng shadow mềm, opacity thấp
- hạn chế dùng shadow trong giao diện nhiều dữ liệu
- ưu tiên border và spacing trước khi thêm shadow phức tạp
- chỉ định một số ít `shadow tier` cho surface, overlay, và floating control

Avoid:

- glow
- colored shadow
- shadow lan quá dài
- layered depth kiểu theatrical

#### Icons

Chỉ dùng một `icon set` nhất quán trong toàn product.

Hướng ưu tiên:

- Lucide hoặc một `minimal system icon set` tương đương

Rules:

- giữ style của icon phù hợp với typography
- nhất quán về `stroke weight`, `size`, và `alignment`
- dùng icon để hỗ trợ nhận diện, không thay thế label trong các chỗ cần rõ nghĩa

Avoid:

- decorative icon container mặc định
- icon quá nhiều chi tiết kiểu illustration
- trộn nhiều `icon style` không tương thích

#### Motion

`Motion` phải làm rõ `state change`, không được dùng để gây chú ý.

Rules:

- giữ transition ngắn, nhẹ, và có mục đích
- chỉ dùng motion cho feedback, overlay, điều hướng, và làm rõ thay đổi state
- tôn trọng `reduced-motion preference`
- ưu tiên fade, translate nhẹ, và easing đơn giản

Avoid:

- animated gradient
- decorative loop
- bouncy motion
- parallax
- theatrical page transition

##### Pattern cho thao tác chuyển item giữa 2 danh sách

Áp dụng cho các màn như `Quản lý thành viên`, `Phân quyền`, `Phân công`:

- khi thêm/gỡ item, UI phải cập nhật ngay trong popup
- không reload cả page để đồng bộ dữ liệu
- dùng transition ngắn `160ms - 240ms` cho `enter/exit`
- dùng `layout animation` để các row còn lại dồn vị trí mượt
- cho phép dùng `ghost row` mờ `200ms - 300ms` ở danh sách nguồn để tạo cảm giác chuyển trạng thái rõ ràng

Không dùng:

- full-screen loading hoặc flash trắng sau mỗi thao tác
- animation kéo dài, nảy mạnh, hoặc mang tính trình diễn

#### Hard Design Tokens

Hãy dùng các token này làm mặc định của hệ thống.

Không được tự nghĩ ra giá trị `ad hoc` khi token đã tồn tại.

##### Font Family Tokens

- `font.sans`: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- `font.mono`: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`

##### Color Tokens

Tất cả màu đều được thiết kế theo hướng `light-theme first` và cân chỉnh cho một `calm product UI`.

Hãy dùng `semantic token` cho logic giao diện.

| Token | Hex | Usage |
|---|---:|---|
| `color.bg` | `#F5F7FB` | App background |
| `color.surface` | `#FFFFFF` | Primary surface, card, panel |
| `color.surfaceSubtle` | `#F3F6FB` | Secondary surface, quiet container |
| `color.surfaceMuted` | `#E2E8F0` | Divider, inactive fill |
| `color.textPrimary` | `#0F172A` | Main text |
| `color.textSecondary` | `#475569` | Supporting text |
| `color.textMuted` | `#64748B` | Helper text, placeholder |
| `color.textDisabled` | `#94A3B8` | Disabled text |
| `color.borderDefault` | `#E2E8F0` | Standard border |
| `color.borderStrong` | `#CBD5E1` | Active hoặc emphasized border |
| `color.focusRing` | `#7DD3FC` | Focus ring, keyboard emphasis |
| `color.primary` | `#0284C7` | Primary action, link, active state |
| `color.primaryHover` | `#0369A1` | Hover state cho primary action |
| `color.primarySoft` | `#F0F9FF` | Selected background, soft emphasis |
| `color.success` | `#15803D` | Positive state |
| `color.successSoft` | `#F0FDF4` | Positive background |
| `color.warning` | `#B45309` | Warning state |
| `color.warningSoft` | `#FFFBEB` | Warning background |
| `color.danger` | `#BE123C` | Destructive action, error |
| `color.dangerSoft` | `#FFF1F2` | Error background |
| `color.info` | `#0284C7` | Informational state |
| `color.infoSoft` | `#F0F9FF` | Informational background |

Rules:

- dùng `flat color layer` và `soft tonal shift`
- giữ một `primary accent color` nhất quán toàn product
- dùng `semantic color` cho meaning, không cho trang trí

##### Typography Scale

Dùng `typographic scale` tiết chế, `line height` dễ đọc, và `weight` ổn định.

| Token | Size | Line Height | Weight | Usage |
|---|---:|---:|---:|---|
| `type.display` | `36px` | `44px` | `700` | Nhấn mạnh lớn, hiếm dùng |
| `type.h1` | `30px` | `38px` | `700` | Page title |
| `type.h2` | `24px` | `32px` | `600` | Section heading |
| `type.h3` | `20px` | `28px` | `600` | Card title, subsection header |
| `type.body` | `16px` | `24px` | `400` | Body text mặc định |
| `type.bodyStrong` | `16px` | `24px` | `500` | Body text nhấn mạnh |
| `type.bodySmall` | `14px` | `20px` | `400` | Secondary content, dense UI |
| `type.bodySmallStrong` | `14px` | `20px` | `500` | Small emphasis text |
| `type.caption` | `12px` | `16px` | `500` | Label, metadata, hint |
| `type.overline` | `11px` | `16px` | `600` | Utility label hiếm dùng |

Rules:

- thể hiện `hierarchy` bằng size, weight, spacing
- mặc định dùng `sentence case`
- tránh decorative letter spacing, trừ một số utility label hiếm gặp

##### Spacing Scale

Hãy dùng token spacing gần nhất thay vì tự tạo giá trị riêng.

| Token | Value |
|---|---:|
| `space.0` | `0px` |
| `space.1` | `4px` |
| `space.2` | `8px` |
| `space.3` | `12px` |
| `space.4` | `16px` |
| `space.5` | `20px` |
| `space.6` | `24px` |
| `space.8` | `32px` |
| `space.10` | `40px` |
| `space.12` | `48px` |
| `space.16` | `64px` |
| `space.20` | `80px` |

##### Radius Scale

| Token | Value | Usage |
|---|---:|---|
| `radius.none` | `0px` | Flush edge, data grid |
| `radius.sm` | `6px` | Small control, compact badge |
| `radius.md` | `10px` | Input và button |
| `radius.lg` | `12px` | Card, menu, standard surface |
| `radius.xl` | `16px` | Panel, modal, large container |
| `radius.2xl` | `20px` | Major layout block |
| `radius.full` | `999px` | Chỉ dùng khi pill shape thật sự cần |

##### Border Thickness

| Token | Value | Usage |
|---|---:|---|
| `border.1` | `1px` | Border mặc định, input, card, divider |
| `border.2` | `2px` | Focus state, selected state, strong emphasis |
| `border.3` | `3px` | Nhấn mạnh hiếm gặp |

##### Shadow Tiers

`Shadow` phải phục vụ `elevation`, không phục vụ trình diễn.

| Token | Value | Usage |
|---|---|---|
| `shadow.0` | `none` | Flat surface |
| `shadow.1` | `0 1px 2px rgba(15, 23, 42, 0.04)` | Card nhô rất nhẹ |
| `shadow.2` | `0 4px 12px rgba(15, 23, 42, 0.06)` | Floating menu, compact panel |
| `shadow.3` | `0 10px 24px rgba(15, 23, 42, 0.08)` | Modal, drawer, prominent surface |
| `shadow.4` | `0 18px 40px rgba(15, 23, 42, 0.10)` | Elevation cao nhất |

##### Control Heights

| Token | Value | Usage |
|---|---:|---|
| `control.xs` | `28px` | Tiny chip, compact filter |
| `control.sm` | `32px` | Dense list, compact button |
| `control.md` | `40px` | Button, input, select mặc định |
| `control.lg` | `44px` | Touch-friendly control |
| `control.xl` | `48px` | Large form, high-visibility action |

##### Icon Sizes

| Token | Value | Usage |
|---|---:|---|
| `icon.xs` | `12px` | Dense data label, tiny affordance |
| `icon.sm` | `14px` | Inline metadata, compact UI |
| `icon.md` | `16px` | Icon mặc định |
| `icon.lg` | `20px` | Prominent action, header |
| `icon.xl` | `24px` | Nhấn mạnh hiếm gặp, empty state |

##### Motion Durations and Easings

| Token | Value | Usage |
|---|---:|---|
| `motion.fast` | `120ms` | Micro-interaction, hover feedback |
| `motion.base` | `160ms` | Standard transition |
| `motion.medium` | `220ms` | Panel, menu, state change |
| `motion.slow` | `280ms` | Modal, drawer, reveal lớn hơn |
| `motion.standardEasing` | `cubic-bezier(0.2, 0, 0, 1)` | Default easing |
| `motion.enterEasing` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrance transition |
| `motion.exitEasing` | `cubic-bezier(0.4, 0, 1, 1)` | Exit transition |

##### Content Width Tokens

| Token | Value | Usage |
|---|---:|---|
| `container.narrow` | `720px` | Reading-heavy form, focused flow |
| `container.default` | `960px` | Standard page |
| `container.wide` | `1280px` | Detail page, dashboard |
| `container.full` | `1440px` | Screen nhiều data hoặc comparison-heavy |

### 4. Component Rules

#### Buttons

`Button` phải gọn, rõ nghĩa, và định hướng hành động.

Rules:

- `primary button` dùng blue clean fill với text trắng
- `secondary button` dùng surface trắng hoặc gray rất nhạt với border nhẹ
- `destructive button` dùng muted red, không dùng đỏ gắt
- `button height`, `padding`, và `radius` phải nhất quán toàn hệ thống
- label phải mô tả hành động cụ thể

Avoid:

- pill button quá lớn
- button có style mang tính trang trí
- label mơ hồ như `Explore`, `Continue`, hoặc `Open workspace`

#### Inputs, Selects, and Textareas

Toàn bộ `form control` phải thuộc về cùng một `visual language`.

Rules:

- giữ nhất quán về height, padding, border, radius, và focus behavior
- `focus state` dựa trên border và soft ring
- placeholder phải dễ đọc và rõ ràng là thông tin phụ
- `read-only field` phải nhìn khác hẳn field editable
- `textarea` phải gọn, có cấu trúc, và có đủ khoảng thở bên trong

Avoid:

- focus glow quá mạnh
- field quá cao khi không cần
- placeholder gánh toàn bộ meaning của field

#### Cards

`Card` dùng để nhóm thông tin, không dùng để trang trí chỗ trống.

Rules:

- dùng surface trắng, border nhẹ, elevation tối thiểu
- `card header` phải ngắn và bám đúng purpose
- card phải giúp nhóm nội dung, không làm vỡ cấu trúc thị giác

Avoid:

- nesting quá nhiều
- pattern card trong card mà không có giá trị cấu trúc
- card lớn nhưng rỗng, chỉ mang tính trang trí

#### Tables

`Table` là lựa chọn ưu tiên cho `dense operational data`.

Rules:

- tối ưu cho scanability trước tiên
- giữ header hierarchy rõ
- giữ row rhythm ổn định
- dùng status và row action có kiểm soát để dữ liệu vẫn là trung tâm

Avoid:

- table chrome quá trang trí
- quá nhiều action inline
- style khiến table ồn hơn chính dữ liệu

#### Tabs and Local Navigation

`Tab` phải gọn, dễ đọc, và dễ quét.

Rules:

- chỉ dùng tab cho các view song song trong cùng một task context
- giữ `active state` rõ nhưng tiết chế
- dùng blue emphasis nhẹ thay vì block màu đậm

Avoid:

- tab quá lớn
- hệ tab mang tính trang trí
- dùng tab khi page structure sẽ rõ hơn

#### Modals and Drawers

Chỉ dùng `overlay` khi nó thực sự giúp workflow tốt hơn.

Rules:

- dùng modal cho action tập trung, xác nhận, hoặc workflow ngắn
- dùng drawer khi vẫn cần nhìn underlying page context
- title phải trực diện, rõ nghĩa
- content trong overlay phải thực dụng và gọn

Avoid:

- modal intro kiểu marketing
- decorative illustration mặc định
- workflow dài nhưng nhét trong dialog chật

#### Badges, Status, and Alerts

`Status UI` phải truyền đạt meaning với mức noise tối thiểu.

Rules:

- map màu nhất quán với meaning
- giữ status treatment mềm và tiết chế
- alert phải ngắn, có cấu trúc, và actionable
- chỉ hiển thị impact và next step khi thực sự cần

Avoid:

- badge mang tính trang trí
- mapping màu không nhất quán
- alert block quá lớn, làm gián đoạn page không cần thiết

#### Empty States

`Empty state` phải giúp user đi tiếp.

Rules:

- có một title ngắn
- có một supporting sentence ngắn
- có một action liên quan khi action đó thực sự khả dụng

Avoid:

- mascot-style illustration
- filler copy
- abstract product metaphor
- cố giải trí thay vì dẫn hướng

#### Hard Component Specs

##### Density Rules

- `desktop control height` mặc định: `40px` đến `44px`
- `touch control height` mặc định: `44px` đến `48px`
- `compact density` chỉ được dùng trong dense table, toolbar, và admin workflow
- không trộn nhiều mức density trong cùng một surface nếu các control không khác role

##### State Rules

Mọi `interactive component` đều nên có các state sau khi phù hợp:

- default
- hover
- active hoặc pressed
- focus
- disabled
- loading
- selected hoặc checked
- error
- read-only

Rules:

- focus luôn phải nhìn thấy được
- disabled state vẫn phải legible
- loading state không được làm layout shift
- selected state phải rõ nhưng tiết chế
- error state phải đủ rõ mà không lấn át layout

##### Buttons

Recommended sizes:

- `Small`: `32px` height
- `Medium`: `40px` height
- `Large`: `48px` height

Rules:

- mỗi surface chỉ nên có một primary button
- secondary button cho hành động hỗ trợ
- destructive button chỉ dùng cho hành động không thể hoàn tác hoặc có rủi ro cao
- label phải ngắn, cụ thể, và action-based
- icon-only button chỉ dùng khi action có thể nhận biết phổ quát

##### Inputs, Selects, and Textareas

Recommended sizes:

- input và select: `40px` mặc định, `44px` cho touch
- compact control: `36px` chỉ trong layout dày đặc
- textarea: tối thiểu `96px`

Rules:

- mặc định đặt label phía trên control
- helper text phải ngắn và hữu ích
- error hiển thị ngay dưới field
- border, radius, focus treatment phải đồng bộ giữa các field type
- placeholder chỉ là hint, không phải label thay thế

##### Checkboxes, Radios, and Switches

Recommended sizes:

- checkbox và radio visual size: `16px` đến `20px`
- minimum click target: `44px`
- switch track height: `20px` đến `24px`

Rules:

- checkbox cho nhiều lựa chọn độc lập
- radio cho một lựa chọn duy nhất trong một tập cố định
- switch chỉ dùng cho binary setting có hiệu lực ngay
- càng nhiều càng tốt, toàn bộ vùng label nên clickable

##### Cards

Recommended spacing:

- padding: `16px` đến `24px`
- khoảng cách giữa các phần bên trong: `12px` đến `16px`

Rules:

- header phải ngắn gọn
- dùng border nhẹ và elevation tối thiểu
- action đặt ở vị trí predictable
- tránh nested card trừ khi đó là các lớp thông tin thật sự khác nhau

##### Tables

Recommended sizes:

- compact row height: `44px` đến `48px`
- comfortable row height: `52px` đến `56px`
- header height: `40px` đến `44px`

Rules:

- header label phải ngắn và rõ
- căn phải số liệu khi giúp scan tốt hơn
- row action phải ít và predictable
- có thể dùng sticky header cho table dài khi thực sự có ích

##### Tabs

Recommended sizes:

- tab height: `36px` đến `40px` trên desktop
- tab height: `44px` trên touch layout

Rules:

- chỉ dùng tab cho sibling view trong cùng task context
- label phải ngắn và song song về cấu trúc
- xử lý overflow tab một cách mềm mại khi số lượng tăng

##### Badges

Recommended sizes:

- height: `20px` đến `24px`

Rules:

- badge dùng cho status, type, priority, hoặc count
- text nên ngắn, thường chỉ một đến ba từ
- mapping màu phải nhất quán theo meaning

##### Alerts

Rules:

- alert dùng cho outcome, blocker, warning, hoặc critical context
- alert phải ngắn và actionable
- alert phải đặt gần content hoặc action liên quan
- khi cần, chỉ nên có title và một supporting sentence

##### Modals

Recommended widths:

- `Small`: `480px`
- `Medium`: `640px`
- `Large`: `800px`

Rules:

- modal dành cho confirm, chỉnh sửa nhẹ, hoặc luồng quyết định ngắn
- title phải trực diện và cụ thể
- trong đa số trường hợp chỉ nên có một primary action và một secondary cancel action
- không đặt long form trong modal nếu page hoặc drawer rõ ràng hơn

##### Drawers

Recommended widths:

- desktop: `480px` đến `640px`
- mobile: full screen

Rules:

- drawer dùng cho inspect, edit, hoặc detail overlay khi cần giữ context của page
- header, content, và action phải có cấu trúc rõ
- không được nhồi nhiều task không liên quan vào cùng một drawer

##### Empty States

Rules:

- layout nên được căn giữa trong đúng vùng liên quan
- nếu quan trọng, hãy giải thích vì sao trạng thái này đang trống
- cung cấp một primary next step
- không làm empty state lớn hơn phần content mà nó thay thế

##### Page Headers

Recommended structure:

- title
- optional description
- supporting control
- primary action

Rules:

- header phải gọn
- subtitle chỉ dùng khi nó thêm được context thật
- action ở header phải được căn hàng nhất quán giữa các page
- không biến product page thành hero section

### 5. Layout Rules and Responsive Standards

#### App Shell

`App shell` phải giúp định hướng mà không cạnh tranh với content của page.

Rules:

- chỉ dùng shell khi cần `persistent navigation` hoặc `global utility`
- giữ shell yên, gọn, và có cấu trúc
- ưu tiên content hơn `chrome`
- chọn top, side, hoặc bottom navigation dựa trên cấu trúc product, không theo thói quen

#### Desktop Page Structure

Page trên desktop phải có `hierarchy` dễ đoán:

- header
- controls
- content

Rules:

- giữ page header gọn
- đặt primary action gần title hoặc trong một vùng action nhất quán
- giữ phần intro tối thiểu
- để content hữu ích xuất hiện sớm trong viewport

Avoid:

- product opening kiểu hero
- banner trang trí lớn trong product screen

#### Content Width

`Content width` phải được kiểm soát có chủ đích.

Rules:

- dùng layout rộng hơn cho tool dày dữ liệu, dashboard, và màn hình nhiều comparison
- dùng layout hẹp hơn cho form, screen nhiều đọc, và detail view
- giữ `line length` và scanability ở mức thoải mái

Avoid:

- content dài chạy edge-to-edge
- màn data-heavy quá hẹp

#### Dashboard Layout

Dashboard phải hỗ trợ ra quyết định, không phải trình diễn.

Rules:

- chỉ dùng card khi card đó truyền đạt metric, status, hoặc trend thật sự
- giữ hierarchy rõ: tín hiệu chính trước, chi tiết hỗ trợ sau
- chỉ dùng chart khi nó trả lời được một câu hỏi thực tế
- page phải đủ gọn để dùng lặp lại hằng ngày

Avoid:

- analytics block mang tính trang trí
- card grid không có giá trị vận hành

#### List Pages

`List page` phải tối ưu cho filtering, scanning, và row-level action.

Rules:

- nhóm filter có logic và giữ chúng gọn
- dùng table hoặc list card hỗ trợ so sánh nhanh
- secondary control phải dễ thấy nhưng tiết chế
- giữ row rhythm ổn định và status cue rõ ràng

Avoid:

- panel filter chiếm hết page
- action rải rác làm yếu khả năng scan

#### Detail Pages

`Detail page` phải làm nổi bật `main record` hoặc `main object`.

Rules:

- dành nhiều width nhất cho vùng content chính
- giữ side navigation, metadata, và panel hỗ trợ ở mức gọn
- dùng `progressive disclosure` cho thông tin phụ

Avoid:

- quá nhiều vùng có weight ngang nhau
- side panel cạnh tranh với phần detail chính

#### Form Pages

`Form page` phải cho cảm giác được dẫn dắt và hiệu quả.

Rules:

- nhóm field liên quan thành section rõ ràng
- mặc định dùng một cột
- chỉ dùng hai cột khi nó thật sự tăng tốc và tăng độ đọc được
- giữ label, helper text, và validation gần field
- giữ primary action ở vị trí predictable

Avoid:

- form stack quá dài, liền một mạch
- sắp field theo kiểu trang trí

#### Mobile Screens

Screen trên mobile phải giữ nguyên `design language` nhưng với `rhythm` chặt hơn.

Rules:

- giảm chrome và density nhưng vẫn giữ hierarchy
- đơn giản hóa control và label khi cần
- ưu tiên stacked layout và compact surface
- giữ action quan trọng trong vùng dễ với tới

Avoid:

- bê nguyên spacing của desktop sang mobile
- chỉ thu nhỏ desktop layout thay vì thiết kế lại hierarchy

#### Section Spacing

`Section spacing` phải phục vụ cấu trúc, không tạo kịch tính.

Rules:

- giữ vertical rhythm ổn định giữa các section
- bỏ wrapper và container thừa
- để content hữu ích xuất hiện sớm nhất có thể

Avoid:

- top padding quá lớn
- khoảng trống dùng như một hình thức trang trí

#### Responsive Standards

Hệ thống bắt buộc phải `responsive by default`.

`Breakpoint` khuyến nghị:

- `Mobile`: 320px đến 767px
- `Tablet`: 768px đến 1023px
- `Desktop`: 1024px đến 1439px
- `Wide Desktop`: 1440px trở lên

#### Responsive Layout Behavior

Rules:

- mobile chỉ nên có một cột chính
- tablet chỉ nên dùng hai cột khi độ đọc vẫn mạnh
- desktop dùng grid rộng hơn để tăng hiệu quả, không phải để trang trí
- khi layout collapse, phải sắp lại spacing, density, và thứ tự theo ưu tiên

Avoid:

- giữ nguyên số cột của desktop khi nó làm giảm usability
- stack máy móc các block desktop mà không nghĩ lại priority

#### Tables on Small Screens

Rules:

- chỉ cho phép `horizontal scroll` trong controlled container khi thật sự cần
- khi scan tốt hơn, ưu tiên stacked record hoặc compact list item
- trên screen nhỏ, chỉ giữ các cột quan trọng nhất

Avoid:

- ép full desktop table vào layout hẹp

#### Forms on Small Screens

Rules:

- form nhiều cột phải collapse về một cột trên mobile
- label, helper text, và error phải ở gần field
- vẫn phải giữ được grouping sau khi stack

Avoid:

- nén dọc quá mức làm giảm khả năng hiểu và chỉnh sửa

#### Modal Behavior

Rules:

- dùng centered modal trên desktop cho workflow ngắn, tập trung
- dùng drawer hoặc side panel khi screen context quan trọng
- dùng bottom sheet hoặc full-screen overlay trên mobile cho task dài hơn

Avoid:

- modal nhỏ kiểu desktop trên điện thoại

#### Touch Targets

Rules:

- control phải dễ bấm
- phải có khoảng cách đủ giữa các action
- ngay cả khi giao diện compact, usability vẫn phải được giữ

Avoid:

- action cluster chật
- `touch target` ưu tiên density hơn độ tin cậy

#### Responsive Typography

Rules:

- heading phải giảm nhẹ trên screen nhỏ
- body text phải ổn định và dễ đọc
- hierarchy phải còn nguyên qua các breakpoint

Avoid:

- heading quá lớn trên mobile product screen
- nén typography đến mức giao diện mất cảm giác chắc chắn

#### Hard Responsive Patterns

##### Breakpoint Behavior

- `Mobile`: dùng single-column flow, full-width surface, và hierarchy đi từ dưới lên
- `Tablet`: giữ hierarchy chính và chỉ dùng hai cột giới hạn khi cả hai cột vẫn còn readable
- `Desktop`: dùng persistent navigation, multi-column layout, và thông tin dày hơn khi điều đó giúp tăng tốc thao tác
- `Wide Desktop`: chỉ tăng content width cho các màn nhiều comparison hoặc data-heavy, không mở rộng line length vô tội vạ

Khi layout collapse, hãy sắp lại content theo task priority thay vì chỉ stack theo source order.

##### Navigation

- mobile: chỉ dùng bottom navigation khi có `3` đến `5` đích chính; nếu không, dùng top bar với drawer hoặc overflow
- tablet: dùng top bar hoặc compact side rail cho primary navigation và collapse secondary link theo mặc định
- desktop: dùng persistent side navigation cho kiến trúc thông tin sâu, chỉ dùng top navigation cho product nông
- wide desktop: giữ side navigation cố định và cap content width để phần trống không biến thành chrome thừa

##### Form Layout

- mobile: một cột, input full-width, label đặt phía trên, section xếp chồng
- tablet: chỉ dùng hai cột cho field ngắn, độc lập; field dài và destructive action phải full-width
- desktop: dùng một hoặc hai cột tùy theo task speed và scanability
- wide desktop: giữ form width có kiểm soát; không thêm cột chỉ vì còn chỗ

##### Tables

- mobile: không ép full table vào layout hẹp; dùng stacked record hoặc compact list row khi cần
- tablet: giảm bớt cột hiển thị và dùng row expansion cho chi tiết phụ
- desktop: coi table là pattern mặc định cho dense operational data
- wide desktop: giữ column priority ổn định, không kéo giãn cột để lấp đầy chiều ngang

##### List-Detail Behavior

- mobile: dùng screen riêng cho list và detail, đồng thời giữ lại vị trí scroll của list khi quay về
- tablet: dùng list kèm slide-over detail panel chỉ khi list vẫn usable
- desktop: dùng persistent split view cho workflow record-centric khi nó tăng tốc rõ ràng
- wide desktop: chỉ thêm zone thứ ba khi nó giúp workflow tốt hơn một cách rõ ràng

##### Modal Behavior

- mobile: ưu tiên full-screen overlay hoặc bottom sheet
- tablet: dùng drawer hoặc dialog cỡ vừa cho chỉnh sửa tập trung
- desktop: dùng centered modal cho task ngắn, tự chứa; dùng drawer khi page context quan trọng
- wide desktop: cap modal width và giữ action trong vùng dễ với tới

##### Sticky Actions

- mobile: dùng sticky bottom action bar cho primary commit action khi workflow dài
- tablet: dùng sticky footer hoặc header action cluster ổn định trên page dài
- desktop: chỉ pin action cho form dài hoặc review flow
- wide desktop: không tách action khỏi content mà nó tác động, trừ khi workflow thật sự nhiều bước

##### Touch Targets

- mobile minimum tappable area: `44px` x `44px`
- tablet primary control: `44px` x `44px` hoặc lớn hơn
- desktop frequent pointer target: ít nhất `40px` x `40px`

Không bao giờ chỉ dựa vào `visual size`. `Interactive area` phải có đủ padding.

##### Content Density

- mobile: ưu tiên một task chính cho mỗi screen và collapse chrome không thiết yếu
- tablet: dùng density cân bằng với `selective disclosure`
- desktop: ưu tiên density cao hơn cho công việc vận hành, nhưng vẫn giữ khoảng thở quanh action chính
- wide desktop: tăng data density, không tăng khoảng trống trang trí

### 6. Content Rules

#### Headings

`Heading` phải ngắn, cụ thể, và nhiều thông tin.

Rules:

- mô tả đúng content của screen hoặc section
- giúp user định hướng nhanh
- giữ heading ngắn và dễ scan

Avoid:

- decorative subtitle
- slogan-style intro
- tên section mơ hồ
- cố tỏ ra clever
- marketing language
- AI-sounding phrasing

#### Labels

`Label` phải định danh rõ field, action, hoặc control.

Rules:

- dùng noun đơn giản hoặc cụm từ ngắn mang tính hành động
- giữ terminology ổn định trên toàn interface
- mỗi label phải hiểu được mà không cần đoán

Avoid:

- internal jargon không có giải thích
- abstract product language
- wording playful trong product UI
- label chỉ lặp lại điều hiển nhiên mà không tăng clarity

#### Helper Text

`Helper text` chỉ nên giải thích đúng phần user cần biết để hoàn tất action một cách chính xác.

Hãy dùng helper text cho:

- format guidance
- constraint
- expected input
- clarification ngắn

Rules:

- phải ngắn
- phải thực dụng
- nếu field đã quá rõ thì không cần helper text

Avoid:

- filler text
- motivational tone
- giải thích quá dài
- lặp lại label
- AI-style overexplaining

#### Error Copy

`Error message` phải rõ, cụ thể, và actionable.

Rules:

- nói rõ chuyện gì đã sai
- khi cần, nói luôn cách sửa
- dùng plain language
- message phải đủ ngắn để scan

Avoid:

- technical dump
- phrasing mang tính đổ lỗi
- message chung chung như `Something went wrong`
- AI wording quá lịch sự hoặc quá trò chuyện

#### CTA Naming

`CTA label` phải mô tả chính xác hành động sắp xảy ra.

Ưu tiên các label trực diện như:

- `Save changes`
- `Create project`
- `Delete record`
- `Send invite`
- `Export CSV`

Rules:

- dùng verb khớp với outcome
- với destructive hoặc irreversible action, label phải nói rõ điều đó

Avoid:

- label mơ hồ như `Continue` hoặc `Proceed` mà không có context
- CTA kiểu slogan
- wording clever hoặc branded
- label che giấu kết quả của action

#### Empty-State Copy

`Empty-state copy` phải hữu ích, ngắn, và bình tĩnh.

Một empty state tốt cần giải thích:

- cái gì đang thiếu
- vì sao screen đang trống, nếu điều đó quan trọng
- user có thể làm gì tiếp theo

Rules:

- dùng một title rõ ràng
- dùng một supporting sentence ngắn
- dùng một CTA trực diện khi action khả dụng

Avoid:

- mascot-style language
- inspirational filler
- metaphor trừu tượng
- AI-sounding reassurance

#### Tone

Toàn bộ `product copy` nên mang giọng:

- concise
- professional
- neutral
- direct
- confident

Tone phải đủ human, nhưng không được casual hoặc chatty.

Hãy viết như thể interface đang giúp một người dùng làm việc hoàn thành task nhanh và chính xác.

Avoid:

- decorative subtitle
- vague product copy
- filler text
- slogan-style intro
- overfriendly phrasing
- enthusiasm không cần thiết
- marketing tone
- AI-sounding UI writing

#### Content Standards

Rules:

- dùng cùng một terminology cho cùng một concept ở mọi nơi
- giữ wording ổn định, dễ đoán, và dễ dịch
- khi phân vân, chọn cách viết đơn giản nhất nhưng vẫn chính xác

Avoid:

- đổi từ tùy hứng cho cùng một object hoặc action
- dùng copy để làm nhiệm vụ trang trí thị giác

### 7. Context Adaptation

`Design language` phải thích ứng theo ngữ cảnh mà không đánh mất bản sắc cốt lõi.

`Token`, typography, spacing rhythm, border treatment, và interaction state phải nhất quán trên toàn hệ thống.

Chỉ `hierarchy`, `density`, và `navigation pattern` được thay đổi theo task.

#### Adaptation Principles

- giữ cùng một visual foundation cho mọi product type
- thay đổi structure trước khi thay đổi style
- giữ interaction state và semantic color role nhất quán
- điều chỉnh density theo use case
- tối ưu theo task chính của user, không theo screen pattern chung chung

#### Dashboards

Rules:

- ưu tiên summary, status, và decision support
- giữ metric block gọn và dễ scan
- chỉ dùng chart khi nó làm rõ trend hoặc comparison

Avoid:

- analytics layout mang tính trang trí
- KPI card không phục vụ action

#### CRUD Screens

Rules:

- ưu tiên scanning, filtering, và row-level action
- giữ form, table, và bulk action trong trạng thái kỷ luật
- giảm visual decoration để data là trung tâm

Avoid:

- list view bị over-styled
- filter và action phân tán

#### Detail Pages

Rules:

- ưu tiên main record hoặc primary content area
- giữ metadata phụ ở mức gọn và thứ cấp
- chỉ dùng tab, anchor navigation, hoặc side panel khi nó cải thiện khả năng định hướng

Avoid:

- chia nhỏ sự chú ý vào quá nhiều section ngang vai trò

#### Mobile Apps

Rules:

- giữ nguyên design language trong một vertical rhythm chặt hơn
- giảm chrome và đơn giản hóa navigation
- ưu tiên stacked section, sheet, và bottom-aligned action khi phù hợp

Avoid:

- bê nguyên density của desktop sang mobile
- coi mobile như một visual product hoàn toàn khác

#### Internal Tools

Rules:

- tối ưu cho speed, precision, và repeated use
- cho phép density cao hơn consumer screen
- label phải rõ và control phải hiệu quả

Avoid:

- trang trí quá mức
- density cao đến mức khó đọc

#### Consumer Product Screens

Rules:

- tối ưu cho clarity, confidence, và approachability
- cho phép nhiều khoảng thở hơn internal tool
- primary action phải rõ, secondary action phải yên hơn

Avoid:

- UI ồn
- screen quá chật
- cố làm product trông trendy một cách giả tạo

#### Consistency Rules

- không tạo `visual system` riêng cho từng product type
- không restyle component chỉ để tạo cảm giác “khác đi”
- hãy điều chỉnh spacing, hierarchy, và density theo task
- mọi screen vẫn phải cho cảm giác cùng một product family

#### Context Check

Trước khi chốt bất kỳ screen nào, hãy xác nhận:

- screen đó khớp với loại task đang phục vụ
- hierarchy hỗ trợ đúng user goal chính
- density khớp với usage pattern mong đợi
- navigation pattern phù hợp với device và context
- screen vẫn tuân theo shared design language

### 8. Anti-Patterns

System này bắt buộc phải loại bỏ những pattern làm giảm clarity, tăng noise, hoặc khiến product trông thiên về trang trí thay vì chức năng.

#### Visual Anti-Patterns

Không được dùng:

- gradient-heavy UI
- glow effect
- glassmorphism
- neon accent
- shadow quá nặng
- layered shadow stack
- phối màu quá gắt
- black-heavy dramatic section
- AI visual chạy theo trend
- illustration mang tính trang trí nhưng không hỗ trợ task

Nếu một `visual treatment` chỉ tồn tại để “trông hiện đại”, nó không được phép dùng.

#### Layout Anti-Patterns

Không được dùng:

- decorative card quá lớn
- product opening kiểu hero
- banner giới thiệu lớn bên trong product screen
- khoảng trống được dùng như một lựa chọn thiết kế chính
- section gap quá lớn
- content block trôi nổi không có mục đích cấu trúc
- card-inside-card mà không tăng giá trị
- layout làm trì hoãn việc chạm tới content hữu ích

Content hữu ích phải xuất hiện sớm.

`Decorative spacing` không thể thay thế cho `structure`.

#### Typography and Copy Anti-Patterns

Không được dùng:

- subtitle ngẫu nhiên
- uppercase mang tính trang trí
- wide letter spacing chỉ để làm style
- heading mang tính kịch hóa
- marketing copy mơ hồ
- label kiểu placeholder nhưng giả làm product language

Nếu subtitle không làm rõ screen, hãy bỏ nó đi.

#### Clarity Anti-Patterns

Không được đưa ra các lựa chọn làm giảm readability, scanability, hoặc user confidence.

Ví dụ:

- text tương phản quá thấp
- hierarchy yếu
- visual state mơ hồ
- container mang tính trang trí nhưng cạnh tranh với content
- control nhìn “đẹp” hơn “dùng được”
- giao diện che giấu ưu tiên thật bằng novelty

`Clarity` luôn phải đứng trên `style`.

#### Enforcement Rule

Nếu một quyết định design làm tăng novelty, mood, hoặc trend alignment nhưng làm giảm clarity, quyết định đó phải bị loại bỏ.

Nếu interface trở nên khó đọc hơn, khó scan hơn, hoặc khó dùng hơn, pattern đó không được chấp nhận.

### 9. Execution Rules

Trước khi thiết kế hoặc sửa bất kỳ interface nào:

- đọc guide này trước
- đọc các file UI, component, và pattern liên quan đang có trong project
- coi tài liệu này là `default decision framework` cho mọi UI work

Rules:

- ưu tiên tái sử dụng component, token, layout, và interaction pattern đang có
- ưu tiên extend hoặc compose component cũ trước khi tạo pattern mới
- tối ưu cho consistency giữa screen, state, và flow
- consistency luôn quan trọng hơn novelty, visual experimentation, hay sở thích cá nhân
- chỉ thực hiện thay đổi nhỏ nhất nhưng đủ để giải quyết yêu cầu, miễn là vẫn bám đúng system hiện tại

#### Exceptions

Chỉ được phép lệch khỏi guide này khi cách làm chuẩn không đáp ứng được một yêu cầu rõ ràng về:

- function
- accessibility
- performance
- maintainability

Mọi exception đều phải được giải thích tường minh.

Phần giải thích phải nêu rõ:

- rule nào đang bị nới
- vì sao cách chuẩn không đủ
- vì sao phương án thay thế là lựa chọn an toàn nhất

Exception phải được giới hạn phạm vi và không được trở thành mặc định mới trừ khi thay đổi đó là có chủ đích và đã được ghi lại.

#### When Project Style Conflicts

Nếu style hiện tại của project xung đột với guide này:

- trước hết phải giữ sự coherent của khu vực hiện có bằng cách tôn trọng local style ở phần đang sửa
- nếu xung đột gây ra vấn đề thật về usability, accessibility, hoặc consistency thì phải nêu ra rõ ràng
- đề xuất một `controlled migration path` thay vì trộn nhiều pattern không tương thích trong cùng một flow

Khi phân vân, hãy giữ local project convention, trừ khi guide này đã định nghĩa một yêu cầu chặt hơn và yêu cầu đó thực sự phải được ưu tiên.

#### Default Review Checklist

Trước khi ship một screen mới hoặc một thay đổi UI, hãy kiểm tra:

- layout đã rõ và có density phù hợp với task chưa
- typography đã readable và restrained chưa
- màu đang phục vụ function hay chỉ để trang trí
- component đã tái sử dụng pattern hiện có khi có thể
- copy đã ngắn gọn và không có filler
- responsive behavior đã được nghĩ có chủ đích
- screen cuối cùng có còn cảm giác thuộc cùng một product family hay không

---

### 10. Tối giản text & Cấm placeholder

Mỗi từ trên màn hình phải đáng giá. Nếu xóa một từ mà nghiệp vụ không bị ảnh hưởng, hãy xóa.

#### Quy tắc cốt lõi

- Label là danh từ hoặc cụm động từ, không phải câu.
- Helper text là tùy chọn. Bỏ nếu field đã tự hiểu.
- Empty state cần: icon, tiêu đề 3–5 từ, một câu ngắn, một nút hành động.
- Card header là danh từ, không phải mô tả.
- KPI là con số + một từ nhãn.
- Table header 1–2 từ. Không thêm "Column".
- Modal title mô tả hành động hoặc record, không phải tên view.

#### Các cụm cấm tuyệt đối

Không được dùng:

- `workspace`, `design principle`, `internal intake experience`, `review command center`
- `explore your data`, `welcome to the dashboard`, `manage everything in one place`
- `get started with your journey`, `here you can see...`, `below is the list of...`
- `overview of your recent...`, `this section allows you to...`
- Mở đầu kiểu "Ở đây bạn có thể quản lý..." trước mỗi bảng hoặc form

Nếu subtitle không làm rõ screen, hãy xóa.

#### Label button

- ✅ `Tạo dự án`, `Xuất CSV`, `Gửi duyệt`
- ❌ `Tiếp tục`, `Proceed`, `Explore`, `Open workspace`

#### Label form

- ✅ `Tên dự án`, `Ngày bắt đầu`
- ❌ `Please enter your project name`, `Nhập ngày bắt đầu vào đây`

---

### 11. Accessibility & WCAG

Giao diện phải hoạt động với mọi user, kể cả chỉ dùng bàn phím hoặc screen reader.

#### Contrast

- Text thường: tối thiểu 4.5:1 với nền.
- Text lớn (18px+ bold hoặc 24px+ regular): tối thiểu 3:1.
- Component UI và đồ họa: tối thiểu 3:1.

Tất cả token trong guide này đã được cân chỉnh để đáp ứng trên light mode.

#### Focus Visibility

- Mọi phần tử tương tác phải có focus indicator nhìn thấy được.
- Dùng `focus:ring-2 focus:ring-sky-500 focus:ring-offset-2` là chấp nhận được.
- Không suppress outline bằng `outline-none` trừ khi đã có thay thế.

#### Keyboard Navigation

- Mọi control reachable qua Tab theo thứ tự logic.
- Enter/Space kích hoạt button, link, switch.
- Escape đóng modal, drawer, dropdown.
- Trap focus bên trong modal đang mở.

#### Screen Readers

- Dùng semantic HTML (`<button>`, `<a>`, `<label>`, `<table>`) trước khi dùng ARIA.
- Icon-only button phải có `aria-label`.
- Content động (toast, live list) dùng `aria-live="polite"`.
- Form error liên kết với field qua `aria-describedby`.

#### Motion

- Tôn trọng `prefers-reduced-motion`.
- Tắt animation không thiết yếu cho user yêu cầu giảm motion.
- Feedback thiết yếu (button press, state change) vẫn được giữ nhưng phải instant hoặc rất ngắn.

#### Color Independence

- Không bao giờ dùng màu độc lập để truyền đạt status.
- Kết hợp màu status với icon hoặc text label.
- Ví dụ: badge "Từ chối" màu đỏ phải có chữ "Từ chối" hoặc icon ban, không chỉ có màu đỏ.

---

### 12. Notifications, Toasts & Snackbars

Dùng thông báo tạm thời cho kết quả không cần modal.

#### Vị trí

- Desktop: góc trên phải, xếp chồng dọc.
- Mobile: giữa dưới, tối đa 2 toast.

#### Thời lượng

- Success / Info: 4 giây.
- Warning: 6 giây.
- Error: 8 giây hoặc persistent đến khi dismiss.
- Cần hành động: persistent + nút dismiss rõ ràng.

#### Cấu trúc

Mỗi toast chứa:

1. Icon semantic (16px) khớp intent.
2. Message 1 dòng (tối đa 2 dòng trên mobile).
3. Text action tùy chọn (VD: `Hoàn tác`, `Xem`).
4. Nút dismiss.

Không toast nhiều đoạn. Không marketing copy trong toast.

#### Xếp chồng & Giới hạn

- Tối đa 3 toast cùng lúc.
- Toast cũ fade out trước.
- Toast mới slide in (`translate-y` + opacity, 200ms).

#### Màu sắc

| Intent | Icon | Background | Border | Text |
|---|---|---|---|---|
| Success | CheckCircle | `bg-emerald-50` | `border-emerald-200` | `text-emerald-800` |
| Error | XCircle | `bg-rose-50` | `border-rose-200` | `text-rose-800` |
| Warning | AlertTriangle | `bg-amber-50` | `border-amber-200` | `text-amber-800` |
| Info | Info | `bg-sky-50` | `border-sky-200` | `text-sky-800` |

Không dùng colored shadow hoặc glow sau toast.

---

### 13. Loading & Skeleton States

Không bao giờ để khoảng trắng trống khi data đang load. User phải thấy có chuyện đang xảy ra và content sẽ xuất hiện ở đâu.

#### Skeleton Patterns

Dùng `bg-slate-200 animate-pulse` với hình dạng bo tròn khớp content thật:

- Dòng text: `h-4 rounded`, width `w-full`, `w-3/4`, `w-1/2`.
- Header: `h-5 rounded w-1/3`.
- Avatar: `rounded-full bg-slate-200`.
- Button: `h-10 rounded-lg w-24 bg-slate-200`.
- Card: tái tạo padding, border, radius của card thật, bên trong là skeleton block.

#### Table Skeleton

- Hiển thị 5–8 skeleton row.
- Khớp số cột và width xấp xỉ.
- Có skeleton header row.
- Giữ border table để layout không shift khi data về.

#### Card Skeleton

- Skeleton header bar (icon + title).
- 2–4 skeleton text line bên trong.
- Giữ nguyên padding, border, radius của card.

#### Spinner Usage

- Action inline (button click): thay text bằng spinner 16px trong cùng button, không đổi kích thước button.
- Vùng nhỏ (filter count): spinner inline bên cạnh text.
- Full page: dùng skeleton layout khớp layout cuối. Tránh generic centered spinner trừ khi toàn bộ layout chưa biết.

#### Progressive Loading

- Load text và layout trước.
- Lazy load nội dung nặng: chart, ảnh lớn, preview embed.
- Hiển thị placeholder structure ngay, sau đó hydrate content.

#### Error sau Loading

Nếu load thất bại, thay skeleton bằng inline error trong cùng container. Không để spinner quay vô tận.

---

### 14. Data Visualization & Charts

Chỉ dùng chart khi nó trả lời câu hỏi vận hành thực tế. Chart trang trí bị cấm.

#### Khi nào dùng

- Line chart: trend theo thời gian.
- Bar chart: so sánh giữa các nhóm.
- Pie / donut: tỷ lệ đơn giản, tối đa 5 phần.
- Table: luôn ưu tiên cho giá trị chính xác và data dày đặc.

#### Palette cho chart

Mở rộng từ semantic palette. Không thêm màu mới.

| Role | Màu |
|---|---|
| Primary series | `sky-600` |
| Secondary series | `slate-400` |
| Success / Positive | `emerald-500` |
| Warning | `amber-500` |
| Danger / Negative | `rose-500` |
| Grid background | `slate-100` |
| Axis text | `slate-500` |

Không dùng gradient fill. Dùng flat color với opacity nhẹ (VD: `fill-sky-600/20`) cho vùng dưới line.

#### Labels & Legends

- Legend đặt trong hoặc sát chart, không phải panel riêng.
- Axis label: `text-xs text-slate-500`.
- Data label trong bar chỉ khi đọc được; nếu không thì dùng tooltip.

#### Tooltips

- 1 dòng data.
- Dark background: `bg-slate-900 text-white text-xs rounded-md px-2 py-1`.
- Không shadow spectacle.
- Hiển thị value + unit + date/context.

#### Empty Chart State

Tuân theo empty-state rules: icon + tiêu đề ngắn + câu mô tả + action (nếu có). Không hiển thị grid trống với trục.

---

### 15. Iconography Deep-Dive

Một hệ icon nhất quán giữ giao diện yên tĩnh và dễ scan.

#### Icon Set

- **Lucide React** là thư viện icon duy nhất được chấp nhận.
- Không trộn với Material Icons, Font Awesome, Heroicons, hoặc filled set khác.

#### Stroke & Style

- Stroke width: default Lucide (tương đương 1.5px–2px).
- Tất cả icon phải outline style. Không dùng filled variant trừ khi có trong Lucide và dùng nhất quán.

#### Kích thước

| Token | Size | Dùng cho |
|---|---|---|
| Inline | 14px–16px | Button, table action, form hint |
| Default | 16px | Menu item, badge, inline metadata |
| Header | 20px | Page header, section title, prominent action |
| Empty state | 24px–32px | Empty state, confirmation dialog |
| Decorative | 40px+ | Hiếm; chỉ khi icon là nội dung duy nhất của vùng lớn |

#### Màu sắc

- Mặc định inherit text color.
- Status icon dùng semantic color (emerald, amber, rose, sky).
- Không apply màu tùy tiện lên icon.

#### Căn chỉnh

- Căn giữa icon theo chiều dọc với text bên cạnh.
- Button icon + label: icon trái, text phải, gap `8px`.
- Button icon-only: touch target vuông, tối thiểu `40px`.

#### Cấm

- Emoji làm icon (`📁`, `⚠️`).
- Custom SVG illustration trong UI chrome.
- Icon 3D hoặc skeuomorphic.
- Icon animated hoặc xoay trừ spinner loading.

---

### 16. File Attachment & Upload Patterns

Upload và quản lý file là nghiệp vụ thường gặp. Giữ thực dụng.

#### Upload Zone

- Border dashed: `border-2 border-dashed border-slate-300 rounded-lg`.
- Background hover/active: `bg-slate-50`.
- Nội dung: icon upload (24px) + 1 dòng text (`Kéo thả hoặc chọn file`) + gợi ý kích thước (`Tối đa 10MB — PDF, DOCX`).
- Click bất kỳ đâu trong zone để mở file picker.

#### Danh sách file

- Hiển thị dạng row, không phải card.
- Mỗi row: icon loại file (16px) + tên file + dung lượng + nút xóa.
- Row style: `border-b border-slate-100 py-2`.
- Tên file dài: ellipsis + tooltip hiện đầy đủ.

#### Tiến trình upload

- Thanh mỏng inline trong row: `h-1 bg-sky-600 rounded-full`.
- Không dùng modal dialog cho tiến trình upload.

#### Xử lý lỗi

- Message inline trong row: `text-xs text-rose-600`.
- VD: `File vượt quá 10MB`, `Chỉ chấp nhận PDF`.

#### Preview

- Thumbnail ảnh: 40×40px `rounded-md`.
- File không phải ảnh: icon loại file + tên. Không preview giả.

#### Giới hạn & Validation

- Hiển thị định dạng chấp nhận và max size **trước** khi user chọn file.
- Validate ngay khi chọn, không chờ submit form.

---

### 17. Navigation Deep-Dive

Navigation giúp định hướng mà không cạnh tranh với content.

#### Sidebar

- Tối đa 1 level hiển thị cùng lúc.
- Submenu collapsible với chevron indicator.
- Không mega-menu. Không horizontal scroll trong sidebar.
- Active item: `bg-sky-50 text-sky-700 border-r-2 border-sky-600`.
- Không kết hợp bold + underline + background cho active state. Chọn một treatment rõ ràng.

#### Breadcrumbs

- Chỉ dùng khi depth > 2.
- Format: `Trang chủ > Quản lý dự án > Chi tiết`.
- Style: `text-sm text-slate-500`.
- Phân đoạn cuối là plain text, không phải link.
- Có thể thay "Trang chủ" bằng icon Home.

#### Overflow

- Label sidebar dài: ellipsis + tooltip.
- Nhiều tab: horizontal scroll với fade indicator, hoặc dropdown overflow.
- Không bao giờ wrap tab text sang 2 dòng.

#### Navigation trên Mobile

- Drawer trượt vào từ trái.
- Overlay: `bg-slate-900/50`.
- Đóng khi tap backdrop hoặc swipe.
- Giữ cùng cấu trúc menu như desktop; không tạo hierarchy mobile riêng.

#### Local Navigation (Sub-tabs / Sub-nav)

- Dùng tab gọn hoặc mini-nav dọc trong card.
- Tab height: `36px–40px` trên desktop.
- Active tab: bottom border hoặc soft background. Không block màu đậm.

---

### 18. Onboarding, Tooltips & Coach Marks

User enterprise không cần guided tour. Chỉ cung cấp trợ giúp theo ngữ cảnh khi thật cần.

#### Tooltips

- Tối đa 1 câu.
- Dark style: `bg-slate-900 text-white text-xs rounded-md px-2 py-1`.
- Mũi tên tùy chọn.
- Trigger: hover trên desktop, long-press trên mobile (hoặc tap icon info).
- Không đặt nội dung tương tác bên trong tooltip.

#### Coach Marks / Spotlights

- Chỉ dùng cho tính năng thực sự mới hoặc phức tạp.
- Chỉ 1 spotlight tại một thời điểm.
- Phải dismiss được (nút X hoặc `Đã hiểu`).
- Không wizard nhiều bước.
- Làm tối phần còn lại bằng `bg-slate-900/40`.

#### Badge Tính năng Mới

- `rounded-sm bg-sky-100 text-sky-700 text-xs px-1.5`.
- Tự động xóa sau lần dùng đầu hoặc trong vòng 7 ngày.

#### Empty State là Onboarding

- Nút hành động chính trong empty state chính là onboarding CTA.
- Không thêm panel "Hướng dẫn" riêng nếu empty state đã nói rõ bước tiếp theo.

#### Cấm Tour Bắt Buộc

- Không block UI bằng modal "Welcome" bắt buộc.
- Không làm tối toàn màn hình khi đăng nhập lần đầu.
- Gợi ý theo ngữ cảnh luôn được ưu tiên hơn hướng dẫn tuần tự.

---


---

## Phần III — Triển khai Tailwind CSS v4

### Mục đích

File này là **hướng dẫn triển khai** cho design spec `DESIGN_GUI.md` (→ **Phần II** của tài liệu này).  
Nó trả lời câu hỏi: **"Làm sao để implement đúng spec vào code?"**

Trước khi chỉnh sửa UI bất kỳ file nào trong `app/dashboard/user/`, đọc file này trước.

---

### 1. Cách đọc Design Spec

**Priority order:**

1. `DESIGN/UI_STYLE_GUIDE.md` (→ **Phần I** của tài liệu này) — Tinh thần thiết kế, nguyên tắc bắt buộc
2. `DESIGN/DESIGN_GUI.md` (→ **Phần II** của tài liệu này) — Hard token definitions (colors, spacing, radius, etc.)
3. `DESIGN/DESIGN_IMPLEMENTATION_GUIDE.md` (file này → **Phần III** của tài liệu này) — Cách implement tokens vào Tailwind CSS v4

---

### 2. Tech Stack hiện tại

- **Framework:** Next.js 16 (App Router), React 19
- **Styling:** Tailwind CSS v4 (CSS `@import "tailwindcss"` — KHÔNG có `tailwind.config.ts`)
- **Icons:** Lucide React
- **State:** React Hook Form, Zod
- **Animations:** Framer Motion (dùng có chọn lọc)

**Điều quan trọng:** Tailwind v4 dùng CSS `@theme inline` thay vì `tailwind.config.ts`. Tất cả design tokens phải được khai báo dưới dạng CSS custom properties trong `app/globals.css`.

**Dự án này dùng Tailwind CSS v4.** Không có file `tailwind.config.ts`. Tất cả design tokens phải được khai báo dưới dạng CSS custom properties trong `app/globals.css` bằng cú pháp `@theme inline`.

#### Tech stack (theo UI_STYLE_GUIDE & DESIGN_GUI_VN)

- `app/globals.css` — Nơi khai báo design tokens (CSS `@theme inline`)
- `@import "tailwindcss"` — Import Tailwind v4
- KHÔNG có `tailwind.config.ts`

---

### 3. Màu sắc — Token Mapping

#### Approved Color Palette (dùng trực tiếp với Tailwind classes)

| Intent | Tailwind Class | Hex | Usage |
|--------|---------------|-----|-------|
| Background | `slate-50` hoặc `gray-50` | `#F8FAFC` | App canvas |
| Surface/Cards | `white` hoặc `slate-50` | `#FFFFFF` | Cards, panels |
| Primary Action | `sky-600` | `#0284C7` | Buttons, links, active |
| Primary Hover | `sky-700` | `#0369A1` | Hover state |
| Primary Soft | `sky-50` | `#F0F9FF` | Selected bg, soft emphasis |
| Text Primary | `slate-900` | `#0F172A` | Main text |
| Text Secondary | `slate-600` | `#475569` | Supporting text |
| Text Muted | `slate-500` | `#64748B` | Placeholders, hints |
| Border Default | `slate-200` | `#E2E8F0` | Standard borders |
| Border Strong | `slate-300` | `#CBD5E1` | Active borders |
| Success | `emerald-600` | `#059669` | Positive states |
| Success Soft | `emerald-50` | `#ECFDF5` | Positive backgrounds |
| Warning | `amber-500` | `#F59E0B` | Warning states (use sparingly) |
| Warning Soft | `amber-50` | `#FFFBEB` | Warning backgrounds |
| Danger | `rose-600` | `#E11D48` | Errors, destructive |
| Danger Soft | `rose-50` | `#FFF1F2` | Error backgrounds |
| Info | `sky-600` | `#0284C7` | Informational |

#### Màu sắc trong Tailwind v4 (theo UI_STYLE_GUIDE)

Dùng Tailwind arbitrary value hoặc standard palette classes:

```tsx
// ✅ Dùng standard Tailwind palette classes
<div className="bg-slate-50 text-slate-900 border-slate-200">
<button className="bg-sky-600 hover:bg-sky-700 text-white">
<span className="bg-emerald-50 text-emerald-700 border-emerald-200">

// ❌ KHÔNG dùng — không có trong Tailwind palette
<div className="bg-[#0284C7]">
<div className="text-[#0F172A]">
```

#### Màu KHÔNG ĐƯỢC DÙNG

| Color | Lý do |
|-------|-------|
| `purple-*` | AI-style, không phù hợp enterprise |
| `violet-*` | AI-style, không phù hợp enterprise |
| `indigo-*` | Gần AI-style, không trong spec |
| `orange-*` | Chỉ dùng cho accent khi cần, không phải primary |
| `green-500` (flat) | Chỉ dùng `emerald-500` |
| `blue-500` (flat) | Dùng `sky-500` hoặc `sky-600` |
| `bg-gradient-to-*` | **Cấm tuyệt đối** — vi phạm spec |
| `bg-[linear-gradient(...)]` | **Cấm tuyệt đối** |
| `text-black` trên nền trắng | Dùng `text-slate-900` |
| `text-white` trên nền màu không phải trắng | OK khi button màu đậm, KHÔNG OK trên card |
| `text-white` trên nền màu không đậm | **Cấm tuyệt đối** — theo DESIGN_GUI_VN |

#### Avatar / Decorative Circles

Dùng **flat solid color** thay vì gradient:

```tsx
// ❌ SAI - gradient avatar
<div className="bg-[linear-gradient(135deg,#0284c7_0%,#1d4ed8_100%)]">

// ✅ ĐÚNG - solid color
<div className="bg-sky-600">
// hoặc bg-slate-900 cho dark variant
```

---

### 4. Border Radius — ĐÚNG và SAI

**Scale được phép:** 6px / 10px / 12px / 16px / 20px / 9999px (full)

| Token | Tailwind Class | Value | Usage |
|-------|---------------|-------|-------|
| `radius.sm` | `rounded-sm` | 6px | Badges, chips |
| `radius.md` | `rounded` hoặc `rounded-md` | 10px | Buttons, inputs |
| `radius.lg` | `rounded-lg` | 12px | Cards, menus |
| `radius.xl` | `rounded-xl` | 16px | Panels, modals |
| `radius.2xl` | `rounded-2xl` | 20px | Major blocks — theo implementation guide & UI_STYLE_GUIDE; Major layout blocks — theo DESIGN_GUI_VN |
| `radius.full` | `rounded-full` | 9999px | Avatar, pill (dùng hạn chế) |

#### Những giá trị CẤM

- `rounded-[28px]` — 28px không có trong scale
- `rounded-[24px]` — 24px không có trong scale
- `rounded-[32px]` — 32px không có trong scale
- `rounded-[20px]` — 20px không có trong scale (dùng `rounded-2xl`)
- `rounded-full` — Chỉ khi pill shape thật sự cần thiết, không phải button

#### Ví dụ đúng

```tsx
// Card
<div className="rounded-lg bg-white border border-slate-200 shadow-sm">

// Button
<button className="h-11 px-4 rounded-lg bg-sky-600 text-white">

// Input
<input className="h-11 rounded-md border border-slate-200">

// Modal
<div className="rounded-xl bg-white shadow-xl">

// Badge
<span className="rounded-sm px-2 py-0.5 text-xs font-medium bg-sky-50 text-sky-700">
```

---

### 5. Typography — Scale chuẩn

| Level | Font Size | Tailwind | Weight | Usage |
|-------|-----------|---------|--------|-------|
| H1 | 30px | `text-[30px]` hoặc `text-3xl` | 700 | Page titles |
| H2 | 24px | `text-2xl` | 600 | Section headings |
| H3 | 20px | `text-xl` | 600 | Card titles |
| Body | 16px | `text-base` | 400 | Default |
| Body Small | 14px | `text-sm` | 400 | Table cells, metadata |
| Caption | 12px | `text-xs` | 500 | Labels, hints |

**Quy tắc:**
- Không dùng `text-[36px]` cho heading
- Không dùng `text-[28px]` cho heading
- Không dùng `text-4xl` hoặc larger trong nội dung page
- `text-black` / `text-white` là **cấm** — dùng `text-slate-900`, `text-white`

---

### 6. Control Heights

| Control | Tailwind | Height |
|---------|----------|--------|
| Input / Select | `h-11` | 44px (default touch) |
| Button (md) | `h-10` | 40px |
| Button (lg) | `h-11` | 44px |
| Button (sm) | `h-8` | 32px |
| Dense/compact | `h-9` | 36px (chỉ khi cần thiết) |
| Button (default) | `h-10` hoặc `h-11` | 40-44px — theo UI_STYLE_GUIDE & DESIGN_GUI_VN |
| Button (small) | `h-8` | 32px — theo UI_STYLE_GUIDE & DESIGN_GUI_VN |

**Sai phạm thường gặp:**
- `h-12` (48px) cho inputs → nên là `h-11` (44px)
- `h-12` (48px) cho buttons → nên là `h-10` hoặc `h-11`

---

### 7. Shadows — ĐÚNG và SAI

**Dùng Tailwind shadow utilities:**
- `shadow-sm` — Cards nhẹ, hover states
- `shadow-md` — Modals, drawers
- `shadow-lg` — **Chỉ khi cần emphasis thật sự**, KHÔNG phải default

**KHÔNG DÙNG:**
- `shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)]` — Quá nặng, không trong spec
- `shadow-2xl` — Trừ khi modal/drawer cần emphasis
- Colored shadows, glow effects

**Theo DESIGN_GUI_VN:**
- Cards: `shadow-sm` hoặc `border + shadow-sm`
- Modals: `shadow-xl` hoặc `shadow-md`
- Cấm: `shadow-[0_20px_60px...]`, `shadow-2xl` (trừ khi modal cần emphasis)

---

### 8. Status Color Mapping chuẩn

Dùng mapping này cho tất cả status badges trong hệ thống:

| Status | Badge Background | Badge Text | Border |
|--------|-----------------|-----------|--------|
| `initiated` | `bg-slate-100` | `text-slate-700` | `ring-slate-200` |
| `planned` | `bg-sky-100` | `text-sky-700` | `ring-sky-200` |
| `in_progress` / `executed` | `bg-sky-100` | `text-sky-700` | `ring-sky-200` |
| `monitored` | `bg-sky-100` | `text-sky-700` | `ring-sky-200` |
| `review` | `bg-amber-100` | `text-amber-700` | `ring-amber-200` |
| `on_hold` | `bg-slate-100` | `text-slate-600` | `ring-slate-200` |
| `completed` | `bg-emerald-100` | `text-emerald-700` | `ring-emerald-200` |
| `cancelled` | `bg-rose-100` | `text-rose-700` | `ring-rose-200` |
| `approved` | `bg-emerald-100` | `text-emerald-700` | `ring-emerald-200` |
| `rejected` | `bg-rose-100` | `text-rose-700` | `ring-rose-200` |
| `pending` | `bg-amber-100` | `text-amber-700` | `ring-amber-200` |

---

### 9. Overlay / Backdrop chuẩn

```tsx
// ❌ SAI — dùng arbitrary value
<div className="bg-slate-950/55">
<div className="bg-black/50">
<div className="bg-[rgba(0,0,0,0.5)]">

// ✅ ĐÚNG — dùng Tailwind arbitrary với spec palette
<div className="bg-slate-900/50">
<div className="bg-slate-900/40">

// Với backdrop blur
<div className="bg-slate-900/40 backdrop-blur-sm">
```

---

### 10. Quick Reference Checklist

#### Trước khi commit UI change, kiểm tra:

**Colors:**
- [ ] Không có `bg-gradient-to-*` hoặc `bg-[linear-gradient(...)]`
- [ ] Không dùng `purple-*`, `violet-*`, `indigo-*`, `orange-*` (trừ khi spec cho phép)
- [ ] Text trên nền trắng dùng `text-slate-900`, không phải `text-black`
- [ ] Text trên nền tối dùng `text-white`

**Border Radius:**
- [ ] Không có `rounded-[xxpx]` với giá trị không phải 6/10/12/16/20/9999
- [ ] Buttons dùng `rounded-lg` (12px) hoặc `rounded-md` (10px)
- [ ] Cards dùng `rounded-lg` (12px) hoặc `rounded-xl` (16px)
- [ ] Modals dùng `rounded-xl` (16px)

**Typography:**
- [ ] H1 page title = `text-[30px]` hoặc `text-3xl`, weight 700
- [ ] H2 section = `text-2xl`, weight 600
- [ ] H3 card = `text-xl`, weight 600
- [ ] Không có `text-[36px]`, `text-[28px]`, `text-4xl` trong page content

**Controls:**
- [ ] Inputs = `h-11` (44px)
- [ ] Buttons = `h-10` (40px) hoặc `h-11` (44px)
- [ ] Không dùng `h-12` (48px) cho inputs

**Shadows:**
- [ ] Cards = `shadow-sm` hoặc `border + shadow-sm`
- [ ] Modals = `shadow-xl` hoặc `shadow-md`
- [ ] Không dùng arbitrary heavy shadows như `shadow-[0_20px_60px...]`

---

### 11. Cách mapping từ Design Token → Tailwind Class

| Design Token | Tailwind Class |
|-------------|---------------|
| `color.primary` → `#0284C7` | `sky-600` |
| `color.primaryHover` → `#0369A1` | `sky-700` |
| `color.primarySoft` → `#F0F9FF` | `sky-50` |
| `color.success` → `#15803D` | `emerald-600` — theo implementation guide; `emerald-600` hoặc `emerald-700` — theo DESIGN_GUI_VN & UI_STYLE_GUIDE |
| `color.successSoft` → `#F0FDF4` | `emerald-50` |
| `color.warning` → `#B45309` | `amber-600` — theo implementation guide; `amber-500` hoặc `amber-600` — theo DESIGN_GUI_VN & UI_STYLE_GUIDE |
| `color.warningSoft` → `#FFFBEB` | `amber-50` |
| `color.danger` → `#BE123C` | `rose-600` |
| `color.dangerSoft` → `#FFF1F2` | `rose-50` |
| `color.bg` → `#F5F7FB` | `slate-50` |
| `color.textPrimary` → `#0F172A` | `slate-900` |
| `color.textSecondary` → `#475569` | `slate-600` |
| `color.borderDefault` → `#E2E8F0` | `slate-200` |
| Surface | `white` — theo DESIGN_GUI_VN & UI_STYLE_GUIDE |
| Text Muted | `slate-500` — theo DESIGN_GUI_VN & UI_STYLE_GUIDE |
| Border Strong | `slate-300` — theo DESIGN_GUI_VN & UI_STYLE_GUIDE |
| `shadow.1` → `0 1px 2px rgba(15,23,42,0.04)` | `shadow-sm` |
| `shadow.2` → `0 4px 12px rgba(15,23,42,0.06)` | `shadow-md` |
| `shadow.3` → `0 10px 24px rgba(15,23,42,0.08)` | `shadow-xl` |

---

### 12. Cách fix gradient cards (pattern phổ biến nhất)

```tsx
// ❌ SAI — gradient KPI card
<div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
  <p className="text-green-100 text-sm">Dự án</p>
  <p className="text-3xl font-bold">{count}</p>
  <Building2 className="h-12 w-12 text-green-200" />
</div>

// ✅ ĐÚNG — solid soft surface + accent icon
<div className="bg-emerald-50 rounded-lg p-5 border border-slate-200">
  <div className="flex items-start justify-between gap-3">
    <div>
      <p className="text-sm text-slate-600">Dự án</p>
      <p className="mt-1 text-2xl font-bold text-emerald-700">{count}</p>
    </div>
    <Building2 className="h-8 w-8 text-emerald-600 mt-1" />
  </div>
</div>
```

**Pattern chuẩn cho KPI card:**
1. Background: soft color surface (e.g. `bg-emerald-50`)
2. Border: thin border (e.g. `border-slate-200`)
3. Radius: `rounded-lg` (12px)
4. Icon: accent color của metric (e.g. `text-emerald-600`)
5. Value text: dark variant của accent color (e.g. `text-emerald-700`)
6. Label text: `text-slate-600`

---

### 13. Tổ chức file khi refactor

Khi refactor một page lớn, chia thành các sub-components trong cùng file hoặc file riêng:

```
page.tsx
├── Header (UserPageHeader)
├── StatsSection
├── TableSection
└── ModalConfirm
```

---

### 13.1 Pattern Animation Chuẩn (Ghost Row + Realtime Update)

Áp dụng cho popup có 2 danh sách trái/phải (ví dụ: thêm/gỡ thành viên).

#### Mục tiêu

- thao tác có phản hồi ngay
- không nháy màn hình
- người dùng nhìn thấy item đang "chuyển" danh sách

#### Quy tắc kỹ thuật

1. Không gọi full-page loading khi thao tác trong popup.
2. Cập nhật local state ngay (optimistic update).
3. Nếu API fail thì rollback local state.
4. Dùng Framer Motion `AnimatePresence` + `motion.div layout` cho row list.
5. Transition ngắn: `duration: 0.16 - 0.24`.
6. Ghost row (khuyến nghị):
   - xuất hiện ở danh sách nguồn khi item bị chuyển
   - style: border dashed, opacity thấp
   - tự biến mất sau `200 - 300ms`

#### Ví dụ class và timing

- Row thường: `rounded-lg border border-slate-200 bg-slate-50`
- Ghost row: `border-dashed border-slate-300 bg-slate-100 opacity thấp`
- Motion timing:
  - enter: `opacity 0 -> 1`, `y 8 -> 0`, `~180ms`
  - exit: `opacity 1 -> 0`, `y 0 -> -8`, `~180ms`
  - layout: `layout` animation mặc định (không bounce)

#### Cần tránh

- gọi `setLoading(true)` cho cả page sau mỗi thao tác add/remove
- flash trắng do remount toàn màn
- animation quá dài hoặc hiệu ứng nảy mạnh

Hoặc tách component con ra file riêng nếu file vượt ~400 lines.

---

### 14. Những thứ KHÔNG ĐƯỢC LÀM

- KHÔNG thêm gradient vào bất kỳ UI element nào
- KHÔNG tự ý chọn màu không có trong spec palette
- KHÔNG dùng arbitrary radius values (`rounded-[xxpx]`)
- KHÔNG dùng arbitrary heavy shadows
- KHÔNG thay đổi logic nghiệp vụ khi refactor UI
- KHÔNG thêm decorative copy như "Workspace", "Design System", "Command Center"
- KHÔNG dùng emoji thay cho icons

### 15. Những thứ ĐƯỢC LÀM

- Thay gradient → flat solid colors
- Thay arbitrary radius → scale chuẩn 6/10/12/16/20px
- Thay `text-black`/`text-white` → semantic slate colors
- Thay arbitrary heavy shadows → Tailwind shadow utilities
- Cải thiện spacing, alignment, typography hierarchy
- Refactor để dùng component nếu đã có shared component
- Thêm hover/focus states cho interactive elements


---

## Phần IV — Audit codebase

### Audit — Trạng thái hiện tại của codebase / các user pages

Snapshot tại một thời điểm của `app/dashboard/user/`.

Đã audit toàn bộ 20+ user-facing pages trong `app/dashboard/user/`. Dưới đây là violations cụ thể trong từng file (sau audit toàn bộ 20+ user pages).

#### CRITICAL — Vi phạm nghiêm trọng, cần sửa ngay / cần sửa trước

| File | Violations | Fix |
|------|-----------|-----|
| `app/dashboard/user/page.tsx` | Gradient KPI cards — KPI cards dùng gradient (`bg-gradient-to-br from-green-500 to-green-600`, `from-purple-500 to-purple-600`, etc.) | Thay bằng flat solid colors với `bg-emerald-50` surface, icon màu accent |
| `app/dashboard/user/project-init/page.tsx` | `rounded-[28px]` (nhiều chỗ), `shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)]` (ghi tắt trong nguồn: `shadow-[0_20px_60px...]`), `bg-[linear-gradient(135deg,#0284c7_0%,#1d4ed8_100%)]` (ghi tắt trong nguồn: `bg-[linear-gradient(...)]`), `bg-slate-950/55` backdrop — backdrop không chuẩn | Rounded-xl (16px), shadow-md, solid bg-sky-600, backdrop overlay dùng `bg-slate-900/50` |
| `app/dashboard/user/spaces/page.tsx` | Pervasive `bg-green-600`/`bg-green-50`/`text-green-700` thay vì spec palette — pervasive màu green không đúng spec palette | Thay bằng `bg-sky-600`/`bg-sky-50`/`text-sky-700` |
| `app/dashboard/user/project-init/[id]/page.tsx` | `rounded-[28px]`, `rounded-[24px]`, heavy shadow | Radius standard, shadow-sm |

**Ghi chú phân loại — `app/dashboard/user/project-init/[id]/page.tsx`:** file này xuất hiện ở cả hai mục trong cùng §8 của IMPL guide:
- CRITICAL — Cần sửa ngay: `rounded-[28px]`, `rounded-[24px]`, heavy shadow → Fix: Radius standard, shadow-sm (theo IMPL guide)
- CLEAN — Không cần sửa: "redirect page — không có UI" (theo IMPL guide)

#### MAJOR — Vi phạm nhiều / cần sửa

| File | Violations | Fix |
|------|-----------|-----|
| `app/dashboard/user/director-projects/page.tsx` | Arbitrary blue/emerald/amber/rose/purple bg/text trong status badges và section headers — Arbitrary colors (blue/emerald/amber/rose/purple) trong status badges | Dùng status color mapping chuẩn |
| `app/dashboard/user/projects/[id]/page.tsx` | `rounded-[32px]`, `text-[36px]` title, `shadow-2xl` modal | Rounded-lg/xl, `text-2xl`, shadow-md |
| `app/dashboard/user/projects/page.tsx` | h2 `text-3xl` (30px) — spec: 24px. Hai cách ghi cùng một fact trong nguồn: "h2 `text-3xl` (30px)" (theo IMPL guide) và "h2 30px (spec: 24px)" (theo DESIGN_GUI / UI_STYLE_GUIDE).<br>Palette: indigo/violet/teal (theo DESIGN_GUI / UI_STYLE_GUIDE) + purple (theo IMPL guide) → indigo/violet/teal/purple | `text-2xl`, dùng sky/slate palette |
| `app/dashboard/user/project-init/[id]/supplement/page.tsx` | Purple/orange palette | Dùng sky/slate palette |

#### MINOR — Vi phạm nhỏ / nên sửa

| File | Violations | Fix |
|------|-----------|-----|
| `app/dashboard/user/ai/page.tsx` | H1 `text-xl` (18px) (theo IMPL guide) / H1 `text-xl` (spec: 30px) (theo DESIGN_GUI / UI_STYLE_GUIDE), `text-black` | `text-[30px]` cho h1, `text-slate-900` |
| `app/dashboard/user/chat/page.tsx` | H1 `text-xl` | `text-[30px]` cho h1 |
| `app/dashboard/user/company-projects/page.tsx` | `text-black` pervasive | `text-slate-900` |
| `app/dashboard/user/company-structure/page.tsx` | `text-green-600` (không phải spec green / không đúng spec green) | `text-emerald-600` |
| `app/dashboard/user/customers/page.tsx` | `rounded-full` badge, blue-50/blue-100 ngoài spec (theo IMPL guide) / `rounded-full`, blue-50 ngoài spec (theo DESIGN_GUI / UI_STYLE_GUIDE) | `rounded-sm` badge, sky-50 |
| `app/dashboard/user/documents/page.tsx` | `text-black` pervasive | `text-slate-900` |
| `app/dashboard/user/payments/page.tsx` | `text-black` pervasive (theo IMPL guide) + `text-black`, h-12 inputs (theo DESIGN_GUI / UI_STYLE_GUIDE) → union: `text-black` pervasive, `h-12` inputs | `text-slate-900` |
| `app/dashboard/user/reports/page.tsx` | `text-black` | `text-slate-900` |
| `app/dashboard/user/settings/page.tsx` | `h-12` inputs, `rounded-[24px]` | `h-11`, radius chuẩn |
| `app/dashboard/user/consortium/page.tsx` | Nearly clean — minor shadow on modal (theo IMPL guide, xếp MINOR — Nên sửa).<br>Phân loại khác: "nearly clean" ở mục Clean (theo DESIGN_GUI / UI_STYLE_GUIDE) | OK, chỉ cần theo dõi |
| `app/dashboard/user/meeting-rooms/page.tsx` | Cleanest page — ~85% compliant (theo IMPL guide, xếp MINOR — Nên sửa).<br>Phân loại khác: "~85% compliant", "gần nhất với spec" ở mục Clean (theo DESIGN_GUI / UI_STYLE_GUIDE) | Giữ nguyên, refactor nhỏ nếu cần |

#### Clean — Không cần sửa / gần nhất với spec

Mục này ghi lại các phân loại "Clean" của từng nguồn; chi tiết violations và fix của các file tương ứng nằm ở các mục trên.

- Theo DESIGN_GUI và UI_STYLE_GUIDE: `meeting-rooms/page.tsx` (~85% compliant, gần nhất với spec) và `consortium/page.tsx` (nearly clean) được xếp Clean. Theo IMPL guide, cả hai được xếp ở MINOR — Nên sửa (xem mục MINOR).
- Theo IMPL guide (mục "CLEAN — Không cần sửa" trong §8): `project-init/[id]/page.tsx` (redirect page — không có UI). Cũng theo IMPL guide, file này được xếp ở CRITICAL — Cần sửa ngay (xem mục CRITICAL).

**Thứ tự ưu tiên fix:** Critical → Major → Minor
(**Priority fix order:** Critical → Major → Minor)

Xem chi tiết đầy đủ và pattern fix trong `DESIGN_IMPLEMENTATION_GUIDE.md` — nay là **Phần III** của tài liệu này.


---

## Phần V — Prompt cho phiên làm việc AI

### Prompt chuẩn để giao cho AI khác

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

### Prompt chuẩn cho việc redesign màn hiện có

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

### Câu lệnh nên dùng ở đầu phiên chat mới

Khi bắt đầu phiên mới với AI, dùng câu này:

```text
Trước khi làm UI, hãy đọc file /Users/hmngoc/project/companys/DESIGN/UI_STYLE_GUIDE.md và bám đúng phong cách trong đó. Không được làm lệch sang kiểu AI, startup, landing page, hay giao diện màu mè. Tối giản text tối đa — mỗi từ phải có giá trị nghiệp vụ, không dùng placeholder hay mô tả trang trí.
```

---

### Câu lệnh bắt đầu phiên mới cho AI

Khi bắt đầu phiên làm việc mới, dùng câu lệnh sau:

```text
Trước khi làm UI, hãy đọc các file trong /Users/hmngoc/project/companys/DESIGN/ theo thứ tự:
1. UI_STYLE_GUIDE.md — tinh thần và nguyên tắc thiết kế
2. DESIGN_GUI.md — hard token definitions
3. DESIGN_IMPLEMENTATION_GUIDE.md — cách implement tokens vào Tailwind CSS v4

Dự án dùng Tailwind CSS v4 (CSS @theme inline, không có tailwind.config.ts).
Không được dùng gradient, màu AI-style (purple/violet/indigo), arbitrary radius ngoài scale 6/10/12/16/20px.
Tối giản text — xóa bỏ mọi placeholder, decorative copy, và mô tả thừa.
```

---

