# Tiện ích trình duyệt (Extension – Manifest V3) – MN-Qronx

> Thành phần mới: thư mục `extension/` ở gốc dự án — chạy trên Chrome/Edge/Brave (trình duyệt nhân Chromium). Dùng **chính REST API đang chạy** của backend, không cần thêm/sửa gì backend.

## 1. Vấn đề và mục đích

Chuông nhắc của web chỉ kêu khi tab MN-Qronx đang mở. Nhưng đúng lúc giá trị "báo thức" phát huy thì người dùng lại **không mở trang web** — extension lấp đúng lỗ hổng đó:

- **Chuông nền**: service worker hỏi server mỗi 1 phút; đến giờ nhắc thì bắn **thông báo hệ thống của trình duyệt** — kêu cả khi tab web đã đóng (chỉ mất khi trình duyệt tắt hẳn).
- **Xem nhanh**: đăng nhập email/mật khẩu, danh sách việc hôm nay + việc quá hạn mới, chấm màu theo ưu tiên, đếm số nhắc đến giờ.
- **Hành động ngay**: nút "Hoãn 10 phút" và "Tắt nhắc" ngay trên thông báo; bấm thông báo thì mở web tại `mn-qronx.id.vn`.
- Badge số nhắc đến giờ hiển thị trên icon thanh công cụ.

## 2. Kiến trúc (Manifest V3)

```
extension/
├── manifest.json        # permissions = alarms, notifications, storage
│                        # host_permissions = https://mn-qronx.id.vn/* (chỉ API chủ)
├── background.js        # service worker: chrome.alarms 1 phút → GET /reminders/due
│                        # → chrome.notifications + chống chuông lặp
├── popup/popup.html     # màn đăng nhập / danh sách việc
├── popup/popup.css
├── popup/popup.js       # đăng nhập, gọi API, render danh sách
└── icons/               # 16/32/48/128
```

| Ý tưởng | Cách làm |
|---|---|
| Đánh thức định kỳ | `chrome.alarms.create('poll', { periodInMinutes: 1 })` |
| Gọi API | fetch trực tiếp tới `https://mn-qronx.id.vn/api/v1` với `Authorization: Bearer` |
| Giống client web | dùng chung envelope `{ success, message, data }`; token hết hạn tự gọi `/auth/refresh-token` rồi thử lại |
| Chống chuông lặp | mốc `remindAt` chỉ chuông một lần; khi hoãn/tắt ghi về backend rồi nhét lại mốc mới |
| Lọc quá hạn | bỏ alarm cho việc quá hạn quá 1 ngày — cùng luật với bản web |

## 3. Endpoint backend mà extension dùng

| Endpoint | Chức năng |
|---|---|
| `POST /api/v1/auth/login` | Đăng nhập trong popup (email + mật khẩu) |
| `POST /api/v1/auth/refresh-token` | Làm mới access token khi hết hạn |
| `GET /api/v1/reminders/due` | Lấy danh sách nhắc đến giờ (poll 1 phút) |
| `POST /api/v1/reminders/{id}/snooze` | Hoãn 10 phút |
| `POST /api/v1/reminders/{id}/dismiss` | Tắt nhắc |
| `GET /api/v1/tasks` | Danh sách việc hôm nay trong popup |

Không thêm endpoint nào mới → backend không phải cập nhật gì để extension lên store.

## 4. Đăng store & bán

Quy trình chi tiết (phí, screenshot, giải trình từng quyền, lộ trình Microsoft Store) xem [`docs/extension-publishing.md`](../docs/extension-publishing.md). Tóm tắt:

- **Chrome Web Store**: developer $5 một lần · nộp ZIP `mn-qronx-extension-1.1.0.zip` · cần privacy policy URL công khai + screenshot 1280×800 · nội dung giải trình quyền có sẵn trong tài liệu trên.
- **Edge Add-ons (Microsoft)**: miễn phí · cùng ZIP đó · certification tới 7 ngày làm việc.
- **Bán**: store không còn hỗ trợ bán extension trả phí trực tiếp (Chrome bỏ từ 2021, Edge cũng vậy). Mô hình: **tải miễn phí, thu tiền bằng gói trả phí** — extension đọc `plan` của người dùng từ API; không phải Pro thì giới hạn chuông nền và dẫn tới trang nâng cấp trên web. Phù hợp chính sách cả 2 store.
- **Privacy policy**: bản nháp tại [`docs/privacy-policy-extension.md`](../docs/privacy-policy-extension.md) → đưa lên web thành trang công khai rồi điền URL vào cả 2 store.

## 5. Phạm vi hiện tại / chưa làm

- ✅ Đã làm: đăng nhập email/mật khẩu, danh sách việc hôm nay, chuông nền 1 phút, hoãn/tắt từ thông báo, badge, chống chuông lặp, bấm giờ tập trung (Pomodoro) từ v1.1.0.
- ⏳ Sắp làm: khóa tính năng theo gói (đọc `plan` sau đăng nhập), phát âm thanh alarm riêng của người dùng, nút hoàn thành nhanh trong popup.
- ℹ️ **Từ v1.1.0**: có sẵn bấm giờ tập trung (Pomodoro) — preset 25/5/15 phút và thời gian tự nhập, đếm ngược chạy nền qua `chrome.alarms` (không phụ thuộc popup mở), badge đếm phút còn lại, thông báo khi hết phiên (nút "tập trung tiếp" = tự bắt đầu phiên mới), hàng đợi phiên nối nhau trong tab Dashboard của popup, chấm dõng "tập trung/trống" trong danh sách việc.
- ❌ Ngoài phạm vi: nhận đẩy realtime bằng Web Push trong extension (dùng poll — đơn giản, đủ dùng); không nhúng AI vào extension.
