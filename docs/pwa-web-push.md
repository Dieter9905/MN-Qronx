# Web Push & PWA

Đây là **điều kiện sống còn** của một app nhắc việc: nếu báo thức chỉ kêu khi tab
đang mở thì không thể bán cho ai. Tài liệu này mô tả những gì đã chạy thật và
cách kiểm chứng.

## Đã có

| Việc | Chỗ nằm |
|---|---|
| **Push khi ĐÓNG tab** — máy chủ gửi, service worker hiện thông báo hệ thống | `public/sw.js` + `backend/src/services/pushService.js` |
| **Bấm vào thông báo** mở/focus cửa sổ app đúng trang | `notificationclick` trong `sw.js` |
| **Offline** — mất mạng vẫn mở được app shell; tài sản tĩnh lấy từ cache; API **không bao giờ** cache | `fetch` handler trong `sw.js` |
| **Cài vào màn hình chính** (installable) — manifest + icon 192/512/maskable | `public/manifest.json`, icon sinh bằng `scripts/generate-icons.mjs` |
| Đăng ký/huỷ subscription, khoá VAPID | `GET/POST /api/v1/devices/push…` |
| **Tự dọn endpoint chết** — trình duyệt trả 410/404 là xoá ngay, không gửi mãi | `pushService.sendToSubscription` |

## Luồng nhắc nhở đầy đủ

```
cron mỗi phút (reminderScheduler)
  └─ reminder đến hạn → đánh dấu TRIGGERED
       ├─ pushToUser()  → Web Push → SW hiện thông báo  ← kêu khi ĐÓNG tab
       ├─ FCM           → app Android (device.platform khác WEB)
       └─ tab đang mở   → AlarmContext poll 60s → chuông + overlay báo thức
```

Ba đường cùng chạy nên **mở tab thì có chuông/overlay, đóng tab thì có thông báo
hệ thống** — không đường nào phụ thuộc đường nào.

## VAPID

Khoá VAPID (Web Push) lấy theo thứ tự:

1. Biến môi trường `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` nếu có.
2. **Thiếu thì tự sinh một lần và lưu vào bảng `app_settings`** — không cần cấu
   hình gì thêm khi redeploy, khoá giữ nguyên qua mọi lần khởi động lại.

Tạo khoá thủ công (nếu muốn đặt bằng biến môi trường):

```bash
npx web-push generate-vapid-keys --json
```

## Cách kiểm chứng

1. Mở app bằng **HTTPS hoặc localhost** (trình duyệt chỉ cho SW/push ở hai nơi này).
2. Vào **Cài đặt → Thông báo** → bật **“Nhắc khi đóng trình duyệt”** → cho phép.
3. Kiểm tra: DevTools → Application → Service Workers (đã activated), Push
   Messaging (đã subscribe), và bảng `web_push_subscriptions` có một dòng.
4. Tạo nhắc nhở 2 phút tới, **đóng hết tab**, chờ chuông: phải hiện thông báo.
5. Mất mạng (DevTools → Offline) → tải lại trang → app vẫn mở được.

## Giới hạn cần biết

- **iOS/iPadOS**: Web Push chỉ hoạt động khi app **đã được thêm vào màn hình chính**
  (Add to Home Screen) và người dùng mở từ đó. Đây là hành vi của Apple, không phải lỗi.
- Firefox/Edge/Chrome desktop: chạy bình thường.
- Người dùng **chặn** thông báo ở mức trình duyệt thì không thể bật lại bằng code —
  ghi diện hiển thị hướng dẫn mở cài đặt trình duyệt.
- Trình duyệt có thể đổi endpoint định kỳ; mỗi lần mở app trang tự đăng ký lại
  nên máy chủ không gửi vào địa chỉ cũ, và subscription sai sẽ tự bị xoá (410).

## Gỡ / huỷ

Người dùng bấm tắt trong **Cài đặt → Thông báo** → gọi `POST /devices/push/unsubscribe`
rồi `pushManager.unsubscribe()`; backend xoá đúng subscription của người đó
(không thể huỷ subscription của người khác).
