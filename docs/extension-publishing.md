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
- Tích chọn "I do not sell data / không bán dữ liệu người dùng".

### Store Listing

- Đã có: tên "MN-Qronx – Nhắc việc", mô tả tiếng Việt, icon 16/32/48/128.
- Cần tự làm: **tối thiểu 1 screenshot 1280×800** — nên có 3 ảnh: màn đăng
  nhập, danh sách việc hôm nay, thông báo chuông đang hiển thị nút Hoãn/Tắt.

### Privacy policy URL (bắt buộc)

Cả 2 store đều yêu cầu một URL chính sách quyền riêng tư công khai. Mẫu bản
policy đã viết trong [privacy-policy-extension.md](privacy-policy-extension.md)
— đưa lên web thành trang công khai (ví dụ `https://mn-qronx.id.vn/privacy-extension`)
rồi điền link vào mục Privacy của 2 store.

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

- [ ] Đăng ký developer Chrome ($5) và Partner Center (miễn phí).
- [ ] Chụp 2–3 screenshot 1280×800.
- [ ] Đưa privacy policy lên web thành URL công khai.
- [ ] Nộp ZIP vào 2 store, điền nội dung theo mẫu.
- [ ] Sau khi duyệt: triển khai bước 2–4 của lộ trình bán.
