---
version: 1
slug: "src-components-authlayout-jsx"
primary_target: "src/components/AuthLayout.jsx"
related_targets: ["src/pages/guest/LoginPage.jsx","src/pages/guest/RegisterPage.jsx","src/pages/guest/ForgotPasswordPage.jsx","src/pages/guest/ResetPasswordPage.jsx"]
---

# Surface brief — auth (mở rộng thế giới phòng)

## Scope & visitor mode

- Target: `src/components/AuthLayout.jsx` (khung auth dùng chung). Related: `src/pages/guest/LoginPage.jsx`, `src/pages/guest/RegisterPage.jsx`, `src/pages/guest/ForgotPasswordPage.jsx`, `src/pages/guest/ResetPasswordPage.jsx` — cộng `src/components/common/Button.jsx` + `src/components/common/Inputs.jsx` chỉ ở mức THÊM biến thể token phòng (không đụng biến thể cũ, không sửa logic).
- Route: `/login /register /forgot-password /reset-password`; trang chủ nav đã trỏ vào đây; `/login?checkSession=1` (extension) cũng render cùng AuthLayout.
- Chế độ người dùng đang quay lại / người mới tốt nghĩa: mode surface = Operate (form thông tin, ưu tiên đọc nhanh và nhập được).
- Logic form giữ nguyên 100%: validation, Google OAuth (`API_BASE_URL/auth/google`), báo lỗi tài khoản khóa, `useSlowHint`, vòng resend 60s, devCode hint, remember.
- Ngôn ngữ copy: giữ tiếng Việt như hiện trạng (auth chưa qua i18n). Sáng + tối bắt buộc.

## Audience, job, action, proof, constraints

- Người dùng mục tiêu: sinh viên/cá nhân đã xem trang chủ phòng mini-hompy, bước vào phiên đăng nhập/đăng ký.
- Việc cần làm đi qua màn này: tạo phiên nhanh và tin tưởng — không để một case form lỗi nào làm người dùng lạc trôi.
- Action chính: đăng nhập / đăng ký; click Google; gửi lại mã xác thực / yêu cầu reset mật khẩu khi lỗi.
- Proof: vận hành thật (lỗi hiện đúng, Google redirect đúng, không dữ liệu giả nào sống ở đây); visual phải nằm trong hệ chuẩn `DESIGN.md` (room tokens, dot-divider, pill, Baloo 2/Nunito, Paper-Weight shadows, Rain là trung tính).
- Constraints: logo Q giữ nguyên; slogan "Plan. Do. On Time."; tối + sáng bắt buộc; không khai thác điều sản phẩm chưa có; không đổi hàm chức năng/backend; resend/devCode/giới thiệu vẫn đúng luồng.

## Chosen direction & memorable moment

- Hướng được chọn: cùng thế giới (không hướng mới) — "phòng đã sẵn sàng": bước qua trang này là bước về một căn phòng đã dọn sẵn.
- Panel trái (tường phòng) là chính: logo nhỏ góc trên trên nền Porcelain, dòng slogan Baloo 2, vài blip đặc trưng của phòng, thẻ dán tape như RailCards của landing. Bản tối: tường vẫn Porcelain tối #2B231E + đèn ấm bật lên (lamp-glow, dark-only); không navy, không slate.
- Khoảnh khắc đáng nhớ: **nút CTA chính là một Acorn pill cùng giọng với hàng nav của landing** — từ thế giới, nhỏ nhắn, đặt đúng chỗ; dây chấm phủ nhẹ trước panel như đường kẻ tường, người dùng cảm nhận "cùng một nhà" ngay trước khi nhìn xuống form.

## Unresolved decisions

- Chi tiết "sticker trên tường": cách bố trí tape, thẻ dán, vị trí đèn ấm trong tối cần duyệt bằng screenshot mốc; nếu che nghĩa (lỗi/keyboard) phải chỉnh.
- Dark mode: cần so soát `.dark` hiện tại là slate-900 của app — đảm bảo trong `.room-world` nền tối đúng là #2B231E, không lẫn slate.

---

## Direction contract

THESIS: Màn auth là cánh cửa bước vào phòng mini-hompy đã dọn sẵn; mọi câu chữ, font, màu, đường kẻ về phía landing — không thêm thế giới riêng, không hero gradient, không chữ đổi màu thác nước.

OWN-WORLD: nền Porcelain `rgb(var(--room-paper))` (tối #2B231E), chữ Ink, nét móc Acorn; Rain dùng trung tính cho lỗi/thông tin chờ, không đội hình màu; field: nền paper, ring Acorn/25, focus dashed Acorn (do `.room-world :focus-visible` gánh), placeholder Ink/30, disable nền Oat/40; CTA chính: Acorn pill Baloo 2 bold, shadow `0 14px 26px -12px rgb(0 0 0 / 0.30)`, hover −2px; CTA phụ: paper pill ring Acorn/40, hover nền Oat/60. Trạng thái lỗi = nền Rain/30 + icon WarningCircle + text Ink; note devCode = note dán Moss với icon Lightbulb (không emoji); không chip MẪU ở đây (không dữ liệu mẫu). Không dùng màu brand cũ (navy/blue/gradient), không glass, không hard offset shadow.

STORY: trong 5 giây người dùng thấy đây chính là cùng căn phòng ở trang chủ — logo nhỏ trên tường, CTA chính đặt nổi đúng chỗ; 10 giây thấy chỉ còn một form đơn giản; bấm Google vẫn nhảy sang cùng dòng thông tin cũ; mọi lỗi nói đúng nguyên nhân và chỉ cách ra (không alarm, không dấu chấm than gấp gáp).

FIRST VIEWPORT (lg+): chia hai cột. Trái (panel tường, ~46%): WorldLogo góc trên, dòng Baloo 2 hai dòng (dòng 2 màu Acorn), đoạn phụ 15px, vài blip nhỏ (icon Tile Moss như hero landing), thẻ tape "Nhật ký đúng hạn" một cái duy nhất. Phải (form): max-w-md, h1 font-display, phụ đề, form, nút chính, phân cách chấm "hoặc", nút Google paper pill, dòng cuối chuyển ngữ (link màu Ink bold, hover sang Acorn). MOBILE: panel tường thu về logo nhỏ + h1 display; form ưu tiên.

FORM: "cánh cửa phòng đã mở sẵn" (kế thừa trực tiếp thế giới landing); không hướng mới, không concept-seed. seed: kế thừa seed:62cebed9a676ee7e của landing.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md extension, and every shipping raster carrying its provenance.
