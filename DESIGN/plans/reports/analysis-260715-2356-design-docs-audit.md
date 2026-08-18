# Phân tích thư mục DESIGN — 4 design docs

**Ngày:** 2026-07-15 | **Phạm vi:** `/Users/hmngoc/project/DESIGN/*.md` (4 files, 5018 dòng)
**Method:** 6 agent song song — 4 đọc full từng file, 2 cross-check (EN↔VN, spec↔implementation↔code thật)

---

## 1. Đây là gì

Design system cho **enterprise internal admin dashboard** (tiếng Việt, table-first, chống "AI slop").
Không phải brand book, không phải component inventory. Mang tính **prescriptive** — pattern đã định nghĩa = default.

| File | Dòng | Vai trò | Độ chín |
|---|---|---|---|
| `UI_STYLE_GUIDE.md` | 658 | Tinh thần + nguyên tắc bắt buộc + prompt template giao AI | Mid — mạnh prose, thiếu hard token |
| `DESIGN_GUI.md` | 1961 | Hard token definitions (18 sections + 2 appendix) | Cao — nhưng là 2 doc ghép |
| `DESIGN_GUI_VN.md` | 1976 | Bản VN của trên | Cao — **là source of record** |
| `DESIGN_IMPLEMENTATION_GUIDE.md` | 423 | Map token → Tailwind v4 + audit | ~80% dùng được |

**Codebase thật:** `/Users/hmngoc/project/companys/company/` (Next 16, React 19, Tailwind v4, không `tailwind.config.ts` — claim này đúng).
Không doc nào nêu app root này → mọi ref `app/...` không resolve được từ thư mục DESIGN.

---

## 2. Token core (byte-identical EN/VN)

- **Color:** bg `#F5F7FB` / surface `#FFFFFF` / textPrimary `#0F172A` / primary `#0284C7` (sky-600) / success `#15803D` / warning `#B45309` / danger `#BE123C` / focusRing `#7DD3FC`. Light-theme only.
- **Type:** display 36/44/700 · h1 30/38/700 · h2 24/32/600 · h3 20/28/600 · body 16/24/400 · caption 12/16/500 · overline 11/16/600
- **Space:** 0/4/8/12/16/20/24/32/40/48/64/80
- **Radius:** none 0 · sm 6 · md 10 · lg 12 · xl 16 · 2xl 20 · full 999
- **Motion:** fast 120 · base 160 · medium 220 · slow 280ms
- **Control:** xs 28 · md 40 (default) · xl 48

**Ban list:** gradient, glow, glassmorphism, neon, colored shadow, `purple-*`/`violet-*`/`indigo-*`/`orange-*`, emoji-as-icon, hero section, uppercase trang trí, dark surface.
**Icon:** Lucide React only, outline only. **Font:** Inter.
**Banned copy strings:** `workspace`, `command center`, `explore your data`, `welcome to the dashboard`, `manage everything in one place`...

---

## 3. Bốn vấn đề cấu trúc (30 findings: 10 high / 14 med / 6 low)

### 3.1 Token layer KHÔNG TỒN TẠI — [HIGH]
Cả 3 doc claim "tokens khai báo trong `app/globals.css` qua `@theme inline`". **Sai trên disk.**
`companys/company/app/globals.css` = 52 dòng, scaffold Next.js gốc. 0/21 color token, 0 radius/spacing/shadow/motion/container token.

Tệ hơn — globals.css **chống lại** spec:
- `body` render **Arial** (spec: Inter) tại **14px** (spec: 16px)
- block `prefers-color-scheme: dark` lật surface → `#0a0a0a` (spec: light-first, cấm dark surface)
- `input:focus` dùng `#3b82f6` (blue-500 — bị cấm đích danh) + glow ring (bị cấm)
- `input { color:#111827 !important }` — override mọi `text-slate-900` mà guide bắt buộc

Không doc nào chứa **một dòng** của `@theme` block mà nó yêu cầu.

### 3.2 Hex sai ở chỗ quan trọng — [HIGH]
8/13 token map Tailwind-exact (sky-600, slate-900, slate-200...) → chứng tỏ **ý định là Tailwind-exact**, nên 5 cái còn lại là **defect, không phải lựa chọn**:

| Token | Hex | Thực chất là | Nhưng map tới |
|---|---|---|---|
| success | `#15803D` | green-700 (family **bị cấm**) | emerald-600 `#059669` |
| successSoft | `#F0FDF4` | green-50 | emerald-50 `#ECFDF5` |
| warning | `#B45309` | amber-700 | amber-500/600 |
| danger | `#BE123C` | rose-700 | rose-600 `#E11D48` |
| bg | `#F5F7FB` | không khớp slate nào | slate-50 `#F8FAFC` |

Giống ramp bị lệch 1 stop. IMPL §3 và §12 nêu **hex khác nhau cho cùng class trong cùng file**.

**Radius mapping sai mọi dòng** vs stock Tailwind v4: doc nói 6→`rounded-sm`, 10→`rounded-md`, 12→`rounded-lg`, 16→`rounded-xl`, 20→`rounded-2xl`. Thực tế v4: 4/6/8/12/16. Chỉ đúng nếu có `@theme` override — **chưa từng được viết**.

### 3.3 Priority order ngược — [HIGH]
Declared: `UI_STYLE_GUIDE > DESIGN_GUI > IMPL`.
→ Doc ít cụ thể nhất override file được chỉ định là "hard token definitions". Token của DESIGN_GUI **không bao giờ thắng nổi** conflict.

Đã conflict thật: input **40px** (DESIGN_GUI `control.md`) vs **44px** (UI_STYLE_GUIDE + IMPL `h-11`). IMPL cấm `h-12`/48px mà `control.xl` + Button-Large của DESIGN_GUI **cho phép rõ ràng**.

Cộng thêm: DESIGN_GUI §9 nói *"when in doubt, preserve the local project convention"* → agent sẽ **giữ nguyên gradient** mà audit ra lệnh xóa.

### 3.4 Audit stale + nhân bản 3 + tự mâu thuẫn — [HIGH/MED]
Audit xuất hiện trong **cả 3 file** và đã trôi khác nhau:
- `consortium`, `meeting-rooms`: "Clean" ở 2 doc, "MINOR — nên sửa" ở doc thứ 3
- `payments`: mất finding `h-12` ở 1 bản
- `director-projects/page.tsx`: MAJOR ở cả 3 doc — **không còn source trên disk**, chỉ còn artifact `.next` cũ
- `project-init/[id]/page.tsx`: vừa **CRITICAL** vừa **CLEAN** trong cùng một section của cùng một file. Thực tế: 12 dòng redirect, 0 JSX → entry CRITICAL là **bịa**

17/19 path audit còn tồn tại.

---

## 4. Cạm bẫy lớn nhất: doc trỏ AI tới bản CŨ của chính nó — [HIGH]

`UI_STYLE_GUIDE.md:518, 612` — cả **2 prompt bootstrap** copy-paste đều trỏ mọi AI tương lai tới `/Users/hmngoc/project/companys/DESIGN/`.

Thư mục đó **có tồn tại** — bản copy stale từ 5/5. Diff: UI_STYLE_GUIDE lệch 81 dòng, DESIGN_GUI lệch 384, VN lệch 385 (IMPL giống hệt).

Bản stale **thiếu nguyên DESIGN_GUI §10–18**: Minimal Text Ban, Accessibility/WCAG, Toasts, Loading/Skeleton, Charts, Iconography, Upload, Navigation, Onboarding — cộng cả chương "Nguyên tắc tối giản text" của UI_STYLE_GUIDE.

→ **Làm theo đúng hướng dẫn của doc sẽ load bản thiếu chính những rule mà hướng dẫn đó bắt tuân theo.** Hex token giống nhau giữa 2 bản; khác biệt là **thiếu chương**.

---

## 5. EN vs VN

**Verdict:** đồng bộ về chất, VN mới hơn & đầy hơn. EN là **bản dịch từ VN**, không phải doc ngang hàng.

- §3 Hard Design Tokens: **byte-identical** — 80 dòng, mọi hex, mọi px. **Không có token drift.**
- 177 EN headings vs 178 VN — chênh đúng 1
- Bằng chứng VN là gốc: mtime VN 14:06 > EN 14:04; EN §§16-18 còn **4 literal tiếng Việt chưa dịch** (`Kéo thả hoặc chọn file`, `File vượt quá 10MB`, `Quản lý dự án`, `Đã hiểu`); EN có rule *"Decorative Vietnamese intros"* chỉ hợp lý nếu viết từ phía VN

**Divergence cần xử lý:**

| # | Loại | Chi tiết | Hướng port |
|---|---|---|---|
| 1 | gap HIGH | VN-only: `Pattern chuyển item giữa 2 danh sách` (VN:274-288). Rule normative EN không hề thấy. **Nhưng** dùng 240ms/300ms — off-scale, vi phạm chính rule VN:293 | VN→EN, **snap về 160/220/280** trước khi port |
| 2 | contradiction HIGH | §Shadows: VN cấm `shadow-2xl` *(trừ modal)*, EN không nêu. Nhưng **cả 2 audit** đều flag `shadow-2xl` là MAJOR → EN enforce rule nó chưa từng phát biểu | Cần **quyết định owner** |
| 3 | gap MED | Mapping table: EN 19 dòng, VN 16 — VN thiếu 3 dòng `shadow.*`. **Chỗ duy nhất EN hơn VN** | EN→VN |
| 5 | gap LOW | VN có `Thứ tự ưu tiên fix: Critical → Major → Minor`, EN không | VN→EN |
| 7 | drift LOW | EN:1787 "No horizontal scroll" (không scope) vs VN:1804 "...trong sidebar" (có scope). EN tự mâu thuẫn với §5 + §17 của chính nó | VN→EN |

---

## 6. Mâu thuẫn nội bộ đáng chú ý khác

- **IMPL §5:** *"text-black / text-white là **cấm** — dùng text-slate-900, text-white"* — cấm và kê đơn `text-white` trong **cùng một câu**
- **IMPL §4:** cấm `rounded-[20px]` vì *"20px không có trong scale"* — nhưng bảng cách đó 7 dòng định nghĩa `radius.2xl = 20px` **có trong scale**; cũng cấm `rounded-full` mà bảng liệt kê là approved
- **type.display 36px** là token hợp lệ, nhưng IMPL cấm `text-4xl`+ → token **không thể implement**; `projects/[id]` bị flag MAJOR vì `text-[36px]` trên cơ sở mà bảng token **cho phép**
- **Modal shadow có 3 đáp án:** shadow-xl (DESIGN_GUI+§12) / shadow-md (§7) / "xl hoặc md" (§11 checklist)
- **Button radius 3 kiểu:** §4 table = `rounded-md` 10px; §11 checklist = `rounded-lg` hoặc `rounded-md`; example của chính §4 dùng `rounded-lg`
- **Sidebar active** (§17): kê `bg-sky-50 + text-sky-700 + border-r-2` rồi **dòng kế tiếp** nói *"Do not combine bold + underline + background... Pick one clear treatment"*
- **2 hệ status color không tương thích:** IMPL §9 dùng `bg-*-100/text-*-700/ring-*-200`; DESIGN_GUI §12 toast dùng `bg-*-50/border-*-200/text-*-800` cho **cùng semantic**. Ramp 100/200/800 và `ring-*` không có trong bảng token nào
- **Scope conflict:** DESIGN_GUI tự nhận "product-agnostic", có chương mobile + consumer + "slightly premium"; UI_STYLE_GUIDE (ưu tiên cao hơn) giới hạn enterprise internal, cấm register landing-page → chương mobile/consumer thành **dead code không đánh dấu**
- **Motion off-token:** prose dùng 180/200/240/300ms — không phải token nào (120/160/220/280)
- **Touch target:** 44px min lặp nhiều lần, nhưng §15 đặt icon-only button min = **40px**
- **radius.full:** `999px` (DESIGN_GUI) vs `9999px` (UI_STYLE_GUIDE + IMPL)
- **Smart quotes trong code fence** UI_STYLE_GUIDE (`@import “tailwindcss”`, `className=”...”`) → copy-paste **không compile**
- **UI_STYLE_GUIDE bans** `bg-[#0284C7]`/`text-[#0F172A]` với lý do *"không có trong Tailwind palette"* — **lý do sai**, cả 2 đều có (sky-600 / slate-900). Rule có thể đúng, lý do thì không
- **IMPL §8:** `ai/page.tsx` H1 "text-xl (18px)" — `text-xl` = **20px**
- **Warning button variant** (UI_STYLE_GUIDE §4) không có token/class/mapping ở đâu → priority cao nhất nhưng **không implement được**
- **Personal notes còn sót:** `UI_STYLE_GUIDE:18` *"đây là style tôi đã xây sẵn, hãy đọc và sử dụng trong web company/lib"* (path không tồn tại; gần nhất `companys/company/lib`); `:540` *"...thì PHẢI HỎI LẠI TÔI đến khi sáng tỏ yêu cầu"* nằm giữa checklist
- **2 session-opener trùng lặp** (`:513-519` và `:607-620`), nội dung khác nhau, danh sách file bắt buộc đọc **không khớp nhau**
- **`DESIGN_GUI_VN.md` là orphan:** 1976 dòng, không file nào reference, vắng mặt trong priority order

---

## 7. Đề xuất thứ tự xử lý (mỗi bước mở khóa bước sau)

1. **Viết `@theme inline` block thật** vào globals.css + xóa Arial/dark-mode/`!important`. *Cho tới khi có cái này, không bảng mapping nào verify được.*
2. **Chọn 1 nhà cho mỗi bảng:** token → DESIGN_GUI, Tailwind mapping → IMPL, tinh thần → UI_STYLE_GUIDE. Xóa bản trùng.
3. **Giải quyết 5 hex sai:** quyết định token hay Tailwind class là authoritative.
4. **Đảo priority:** `DESIGN_GUI > UI_STYLE_GUIDE` cho token value; UI_STYLE_GUIDE chỉ authoritative cho tinh thần.
5. **Tách audit** khỏi spec → report có ngày, regenerate lại trên cây thật.
6. **Xử lý `companys/DESIGN/`:** xóa + symlink, hoặc sửa 2 prompt bootstrap.

---

## Unresolved questions

1. **Hex token hay Tailwind class là authoritative?** Mọi mapping conflict quy về đúng quyết định này. Đọc của tôi: 8 exact match ⇒ Tailwind class là đích thật, 5 hex lạ là lỗi chép (green-700/amber-700/rose-700 trông như ramp lệch 1 stop).
2. **`/Users/hmngoc/project/DESIGN/` hay `/Users/hmngoc/project/companys/DESIGN/` là source of truth?** CWD mới hơn & đầy hơn; doc lại trỏ về cái kia. Một cái phải bị xóa/symlink.
3. **Stock Tailwind classes hay semantic token (`bg-primary`)?** Doc bắt buộc **cả hai**. Quyết định này xác định `@theme` block redefine `--color-sky-600` hay tạo token name mới.
4. **Có xóa chương mobile/consumer của DESIGN_GUI không?** Scope enterprise-only của UI_STYLE_GUIDE làm chúng thành dead code dưới priority hiện tại.
5. **`type.display` (36px) có bị khai tử không?** IMPL cấm thẳng, audit flag MAJOR, nhưng nó vẫn là token.
6. **Block dark-mode trong globals.css có cố ý không?** Không doc nào định nghĩa dark token, cả 2 doc top đều cấm dark surface.
7. **`director-projects/page.tsx` còn tồn tại (đổi tên/di chuyển) hay bỏ khỏi cả 3 audit?**
8. **4 literal tiếng Việt ở EN:1748/1766/1795/1837** là product UI copy (ship as-is) hay lỗi dịch sót?
9. **`shadow-2xl` cho modal:** cho phép (VN) hay không (EN + cả 2 audit flag MAJOR)?
