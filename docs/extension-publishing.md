# Đăng MN-Qronx Extension lên store & bán

> Gói nộp tạo bằng `extension/package-extension.ps1` — xuất ra
> `dist/extension/mn-qronx-extension-<version>.zip` (tự đọc version trong
> manifest.json, tự kiểm tra manifest.json ở gốc zip + separator '/').
> **Không nén tay** bằng Explorer/Compress-Archive: entry dùng phân cách
> '\' hoặc thư mục bọc ngoài sẽ bị Store báo "Gói không hợp lệ".

## Hai con đường lưu ý trước

- **Chrome Web Store đã bỏ thanh toán trong-store từ 02/2021** — không còn cách
  "đặt giá $X" cho extension trên Chrome. Cách bán hợp lệ duy nhất:
  **tải miễn phí + thu tiền gói Pro** qua backend riêng (web mn-qronx.id.vn đã
  có sẵn hệ thống gói FREE/PRO → tận dụng nguyên trạng: extension kiểm tra
  `plan` sau đăng nhập, không phải Pro thì giới hạn chuông nền và gợi ý
  "Nâng cấp gói Pro tại mn-qronx.id.vn").
- Edge Add-ons cũng không có paid listing — dùng cùng mô hình trên.
- **Microsoft Store không nhận extension** (Edge/Chrome) ở dạng extension. Đường
  lên Microsoft Store khả thi là đóng web thành **PWA** qua
  [PWABuilder](https://www.pwabuilder.com/) → khi chạy ở dạng PWA cài từ Store,
  có thể thu tiền in-app chính chủ bằng **Digital Goods API** của Microsoft.
  Làm bước này sau khi 2 store extension đã ổn.

## 1. Chrome Web Store

1. Đăng ký developer: <https://developer.chrome.com/docs/webstore/register> —
   phí đăng ký một lần $5, cần thẻ Visa/Master.
2. Nộp ZIP tại Chrome Web Store Developer Dashboard → New Item.
3. Hoàn thành 3 tab: Store Listing, Privacy, Distribution → Submit for Review.
   Review thường vài ngày, có thể kéo dài vài tuần.

### Nội dung copy-paste cho tab Privacy

- **Single purpose:** "Công cụ xem việc hôm nay của MN-Qronx và bắn chuông
  thông báo trình duyệt đúng giờ nhắc của người dùng."
- **`alarms`:** "Lên lịch kiểm tra nhắc định kỳ mỗi phút để bắn chuông đúng giờ."
- **`notifications`:** "Hiển thị thông báo chuông khi đến giờ nhắc; có nút Hoãn
  10 phút và Tắt nhắc. Không dùng cho nội dung quảng cáo."
- **`storage`:** "Lưu token đăng nhập và trạng thái chuông trên máy người dùng,
  không gửi đi đâu khác ngoài API mn-qronx.id.vn."
- **host permission `https://mn-qronx.id.vn/*`:** "Gọi API đăng nhập và đồng bộ
  danh sách công việc/nhắc của chính người dùng MN-Qronx."
- **`scripting`:** "Tiện ích chèn bộ đọc thời khoá biểu (`scraper/timetable.js`)
  vào chính trang TKB của trường mà người dùng đang mở, sau khi họ bấm nút
  “Đọc TKB”; mã chỉ đọc bảng tiết học đang hiển thị rồi gửi về tài khoản
  MN-Qronx của chính người dùng. Chỉ khi người dùng bấm “Bật tự cập nhật” và
  đồng ý cho một tên miền trường cụ thể, tiện ích mới đăng ký content script
  cho đúng tên miền đó để lần sau mở trang là TKB tự đồng bộ. Không chèn mã
  vào trang nào khác."
- **`activeTab`:** "Cấp quyền tạm thời cho tab đang mở ngay sau thao tác bấm
  nút của người dùng, để tiện ích biết URL hiện tại và chèn bộ đọc TKB vào
  đúng trang trường — nhờ vậy không phải xin quyền đọc mọi trang web. Quyền
  mất khi rời trang; không theo dõi lịch sử duyệt web."
- **`cookies`:** "Chỉ đọc cookie của đúng trang TKB trường đang mở, sau khi
  người dùng bấm “Kết nối bằng phiên đăng nhập” và đồng ý cấp quyền cho tên
  miền trường đó (`chrome.permissions.request`). Cookie phiên được gửi tới
  backend riêng của MN-Qronx để máy chủ tự tải lại TKB hằng ngày khi người
  dùng không mở trình duyệt — nhờ vậy người dùng không phải nhập lại mật khẩu
  cổng trường. Không đọc cookie của trang khác, không gửi cho bên thứ ba."
- Tích chọn "I do not sell data / không bán dữ liệu người dùng".

### Store Listing

- Đã có: tên "MN-Qronx – Nhắc việc", mô tả tiếng Việt, icon 16/32/48/128.
- Cần tự làm: **tối thiểu 1 screenshot 1280×800** — nên có 3 ảnh: màn đăng
  nhập, danh sách việc hôm nay, thông báo chuông đang hiển thị nút Hoãn/Tắt.

### Privacy policy URL (bắt buộc)

Cả 2 store đều yêu cầu một URL chính sách quyền riêng tư công khai. Bản đang
sống: **<https://mn-qronx.id.vn/privacy-extension>** — dán đúng URL này vào mục
Privacy của Chrome Web Store và Edge Add-ons.

Trang đó là file tĩnh `public/privacy-extension.html` (nginx có location riêng
`= /privacy-extension` để trả file này thay vì rơi vào SPA fallback — nếu thiếu
location đó, URL sẽ trả về trang chủ ứng dụng và hồ sơ bị coi là không có
chính sách). Trang gộp cả web + tiện ích ở `/privacy.html`; nội dung nguồn nằm
trong [privacy-policy-extension.md](privacy-policy-extension.md) — sửa ở đó rồi
cập nhật lại HTML khi chính sách thay đổi.

> Lưu ý khi bổ sung quyền mới trong `manifest.json`: phải thêm quyền đó vào cả
> trang policy này lẫn phần giải trình từng quyền ở tab Privacy, nếu không hồ sơ
> dễ bị từ chối vì “chính sách không khớp quyền đang xin”.

## 2. Edge Add-ons (Microsoft — miễn phí)

1. Đăng ký Partner Center tại <https://partner.microsoft.com/dashboard/microsoftedge>
   — không mất phí.
2. Create new extension → nộp đúng file ZIP ở trên (Edge chạy được bản Chromium
   Manifest V3 nguyên trạng).
3. Điền listing + privacy policy + giải trình từng quyền + **test notes**:
   "Đăng nhập bằng tài khoản tạo trên mn-qronx.id.vn; khi đến giờ nhắc, service
   worker bắn thông báo chuông; nút Hoãn 10 phút và Tắt nhắc ghi nhận về
   backend." Kèm tài khoản test nếu reviewer cần.
4. Screenshots tối đa 6 ảnh 640×480 hoặc 1280×800 (không bắt buộc, nên có).
5. Certification có thể mất tới 7 ngày làm việc; sau đó extension lên store Edge.

## 3. Bán — lộ trình khuyên dùng

| Bước | Việc | Vì sao |
|---|---|---|
| 1 | Nộp 2 store miễn phí, bản hiện tại (điều khiển chuông từ web) | Vào cửa trước, tích người dùng |
| 2 | Popup đọc `plan` từ API sau đăng nhập; không phải Pro → giới hạn chuông nền + CTA "Nâng cấp Pro" | Mô hình duy nhất được CWS/Edge chấp nhận: bán dịch vụ, không bán trong store |
| 3 | Thanh toán ở web (đã có PaymentOrder), extension chỉ đọc gói | Store review chỉ thấy extension đáng giá gói, khỏi thủ tục phân phối |
| 4 | Công khai trên listing: ai là bên bán, chính sách giá + hoàn tiền | Bắt buộc theo chính sách 2 store khi có tính năng trả tiền |
| 5 | Sau này: PWA lên Microsoft Store + Digital Goods API | Đường chính thức duy nhất để bán trực tiếp trên Store |

## Việc của BẠN

- [x] Đăng ký developer Chrome ($5) — extension đã public: ID
  `hnfognfdmbecbipjhcimbenkaakebbod`.
- [x] Chụp screenshot 1280×800 — đã có bộ 4 ảnh trong `docs/store-screenshots/`.
- [x] Đưa privacy policy lên web: <https://mn-qronx.id.vn/privacy-extension>
  (kiểm tra: trang phải có tiêu đề “Chính sách quyền riêng tư – MN-Qronx Extension”).
- [x] Nộp ZIP vào Chrome Web Store (bản 1.2.1 đã live).
- [ ] Dán giải trình `scripting` / `activeTab` / `cookies` (mục trên) vào tab
  Privacy rồi bấm **Gửi để xem xét** — form đang để trống 3 ô này.
- [ ] Partner Center → nộp Edge Add-ons (chưa làm, dùng chung file ZIP).
- [ ] Sau khi duyệt: triển khai bước 2–4 của lộ trình bán.

## 4. Chiến lược tăng lượt tải (ASO + kênh web)

### Tối ưu từ khóa trên store (ASO)

- **Tên listing** (giới hạn 45 ký tự, từ v1.1.3 trong manifest):
  "MN-Qronx – Nhắc việc & Báo thức Pomodoro" — phủ các từ khóa người VN hay gõ:
  *nhắc việc*, *báo thức*, *pomodoro*. Cập nhật đúng chuỗi này ở tab Store
  Listing của CWA/Edge khi nộp bản 1.1.3.
- **Mô tả ngắn** (132 ký tự): "Việc hôm nay, chuông nhắc & báo thức đúng hạn,
  đồng hồ Pomodoro tập trung ngay trên trình duyệt – kể cả khi đóng tab web."
- Nhắc tự nhiên các từ khóa trong phần mô tả dài: quản lý thời gian, đồng hồ
  tập trung, nhắc deadline, todolist, kế hoạch công việc.

### Bộ ảnh banner (screenshots)

- Đã render sẵn 4 ảnh 1280×800 có chú thích tiếng Việt trong
  `docs/store-screenshots/` (file `slide-*.html` là nguồn, sửa rồi chụp lại
  bằng browser khi cần thay nội dung):
  1. `1-pomodoro.png` — popup đang bấm giờ Pomodoro.
  2. `2-thong-bao.png` — thông báo chuông trên desktop, nút Hoãn/Tắt.
  3. `3-viec-hom-nay.png` — danh sách việc + chấm ưu tiên + nhắc đến giờ.
  4. `4-dang-nhap.png` — đăng nhập 1 lần nhận nhắc mọi tab.
- CWA cho tối đa 4.585 ảnh 1280×800; Edge tối đa 6 ảnh. Nộp cả 4 cho CWA,
  chọn 3 ảnh đầu cho Edge.

### Huy hiệu "Nhà phát triển có uy tín" (Established Publisher)

- Google xét dựa trên: thời gian đăng ký account, số lượng và tần suất cập nhật,
  tỉ lệ chấp thuận review, không vi phạm chính sách. Không xin được — phải
  **duy trì**: mỗi tháng phát hành 1 bản nhỏ (sửa lỗi/USO ảnh mới) và luôn trả
  lời feedback reviewer đúng hạn. Huy hiệu này giúp tăng thứ hạng tìm kiếm.

### Kênh website mn-qronx.id.vn

- **Nút CTA cuối landing** (section CTA): "Cài tiện ích Chrome miễn phí" — đã
  thêm code, hiển thị khi `EXTENSION_STORE_URL` trong `src/lib/constants.js`
  có giá trị (dán link CWA thật của listing vào hằng số này).
- **Gợi ý sau đăng nhập**: component `src/components/ExtensionPromoBar.jsx`
  hiện thẻ nổi góc phải-dưới cho user đã đăng nhập, có nút Cài + nút đóng
  (nhớ localStorage). Cùng dùng hằng số `EXTENSION_STORE_URL` nên chỉ cần dán
  link 1 chỗ là bật cả 2 CTA.
- Duy trì gợi ý này tối thiểu 2 tuần đầu sau đăng bản mới, rồi phép người dùng
  tắt vĩnh viễn (đã có sẵn).


## Nhật ký phát hành

### Bản 1.2.1 (29/10/2026)

- Gói đã đóng: `dist/extension/mn-qronx-extension-1.2.1.zip`
  (bản tải nhanh trên máy chủ: `https://mn-qronx.id.vn/downloads/mn-qronx-extension-1.2.1.zip`).
- Nội dung **What's new** để dán vào Dashboard:
  > Nhắc việc nhóm và đồng bộ lịch trường: tiện ích nhận được việc nhóm được
  > giao cho bạn, lịch học tự cập nhật từ cổng trường, và sửa lỗi hiển thị
  > chuông khi vừa đăng nhập bằng Google.
- Nộp bản mới: Chrome Web Store Developer Dashboard → mục MN-Qronx →
  **Package → Upload new package** → chọn zip trên → điền What's new → Submit.
  (Cần tài khoản developer của chủ dự án; API/CLI không thay được bước này.)
