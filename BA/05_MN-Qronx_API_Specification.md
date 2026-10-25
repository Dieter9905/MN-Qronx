# API Specification – MN-Qronx

> Tài liệu này thay thế `05_TaskAlarm_API_Specification.md`. Danh sách endpoint phản ánh **đúng các route đang mount** trong `backend/src/routes/`.
>
> Swagger UI sinh động đang chạy tại `GET /docs`.

## 1. Quy ước chung

- Toàn bộ API backend prefix bằng `/api/v1/`.
- Danh từ số nhiều cho tài nguyên, `kebab-case` khi nhiều từ.
- Xác thực: `Authorization: Bearer <accessToken>` (JWT). Endpoint public: `/api/v1/auth/**`, `/api/v1/health`, `/api/v1/billing/products`, `/api/v1/billing/webhook/bank`, `/api/v1/calendar/{icsKey}`.
- Response thành công theo envelope chuẩn:

```json
{ "success": true, "message": "Thao tác thành công", "data": { } }
```

- Response lỗi trả `errors` dạng object `field -> message`:

```json
{
  "success": false,
  "message": "Thông tin đầu vào không hợp lệ",
  "errors": { "title": "Tiêu đề không được để trống" }
}
```

- Thời gian (`dueAt`, `remindAt`, `sentAt`…) truyền/trả dạng ISO-8601 kèm offset; backend lưu UTC và tính ngày nghiệp vụ theo múi giờ Việt Nam.
- HTTP Status: `200` (thành công), `201` (tạo mới), `400` (dữ liệu không hợp lệ / vi phạm nghiệp vụ / chưa đủ gói), `401` (chưa đăng nhập / token hết hạn), `403` (không có quyền), `404` (không tìm thấy), `410` (dữ liệu nhị phân không còn), `429` (hết hạn mức AI), `500` (lỗi hệ thống).
- Danh sách hỗ trợ phân trang: `page` (bắt đầu 1), `pageSize` (mặc định 20, tối đa 100).
- Nhiều endpoint kiểm tra **giới hạn gói**; khi vượt, trả `400` kèm thông điệp chỉ dẫn nâng cấp (không im lặng).

## 2. Xác thực (Authentication)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/v1/auth/send-verification-code` | Public | Gửi mã xác nhận email khi đăng ký (mã 6 số). |
| POST | `/api/v1/auth/register` | Public | Đăng ký (yêu cầu mã xác nhận hợp lệ). |
| POST | `/api/v1/auth/login` | Public | Đăng nhập, trả `accessToken` + `refreshToken`. |
| POST | `/api/v1/auth/refresh-token` | Public | Cấp lại access token từ refresh token. |
| POST | `/api/v1/auth/forgot-password` | Public | Gửi yêu cầu đặt lại mật khẩu qua email. |
| POST | `/api/v1/auth/reset-password` | Public | Đặt lại mật khẩu bằng `resetToken`. |
| POST | `/api/v1/auth/logout` | User | Thu hồi refresh token của phiên hiện tại. |
| GET | `/api/v1/auth/google` | Public | Chuyển hướng tới Google (đăng nhập OAuth). |
| GET | `/api/v1/auth/google/callback` | Public | Callback OAuth → chuyển hướng về frontend kèm token. |

**POST `/auth/send-verification-code`** — Request `{ "email": "a@example.com" }` → `200`.
**POST `/auth/register`** — Request:
```json
{ "fullName": "Nguyen Van A", "email": "a@example.com", "password": "Passw0rd!", "verificationCode": "123456" }
```
Response `201`:
```json
{ "success": true, "message": "Đăng ký thành công", "data": { "userId": 12, "fullName": "Nguyen Van A", "email": "a@example.com" } }
```
**POST `/auth/login`** — Response `200`:
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "b7c1...",
    "user": { "userId": 12, "fullName": "Nguyen Van A", "email": "a@example.com", "role": "USER", "plan": "FREE" }
  }
}
```

## 3. Hồ sơ & tiện ích người dùng (`/me`)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/me` | User | Hồ sơ hiện tại (kèm gói, hạn dùng, điểm, chuỗi đăng nhập). |
| PUT | `/api/v1/me` | User | Cập nhật `fullName`, `phoneNumber`, `avatarUrl`. |
| PUT | `/api/v1/me/password` | User | Đổi mật khẩu (`currentPassword`, `newPassword`); thu hồi mọi phiên. |
| GET | `/api/v1/me/stats` | User | Thống kê cá nhân (hôm nay, quá hạn, hoàn thành, danh mục, thiết bị). |
| GET | `/api/v1/me/activity` | User | 5 thông báo gần nhất. |
| PUT | `/api/v1/me/weekly-report` | User | Bật/tắt báo cáo tuần qua email (gói Pro). |
| POST | `/api/v1/me/weekly-report/test` | User | Gửi thử báo cáo tuần cho chính mình (bị chặn bấm liên tục). |
| GET | `/api/v1/me/family` | User | Thông tin gói Pro Doanh nghiệp (chủ gói hoặc thành viên; đường endpoint/model vẫn mang tên `family`). |
| POST | `/api/v1/me/family/members` | User | Mời một người vào nhà (theo email) — chủ gói. |
| DELETE | `/api/v1/me/family/members/{memberId}` | User | Gỡ một người khỏi nhà — chủ gói. |
| POST | `/api/v1/me/family/leave` | User | Tự rời khỏi nhóm gói Doanh nghiệp. |
| GET | `/api/v1/me/family/board` | User | Bảng tiến độ "Cả nhà hôm nay" — chủ gói. |
| PUT | `/api/v1/me/family/progress` | User | Thành viên tự bật/tắt chia sẻ tiến độ. |
| GET | `/api/v1/me/assigned` | User | Danh sách việc người khác giao cho mình. |
| PUT | `/api/v1/me/assigned/{taskId}` | User | Đánh dấu "xong phần của tôi". |
| GET | `/api/v1/me/ics` | User | Lấy URL/khóa lịch `.ics` của mình. |
| POST | `/api/v1/me/ics/rotate` | User | Tạo lại khóa lịch (khóa cũ hết hiệu lực). |
| GET | `/api/v1/me/sounds` | User | Danh sách âm thanh báo thức tự tải lên. |
| POST | `/api/v1/me/sounds` | User | Nhập âm thanh mới (Plus/Pro). |
| GET | `/api/v1/me/sounds/{soundId}/data` | User | Tải dữ liệu âm thanh để phát. |
| DELETE | `/api/v1/me/sounds/{soundId}` | User | Xóa âm thanh tự tải lên. |

## 4. Danh mục (Categories)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/categories` | User | Danh sách danh mục. Query: `isActive`. |
| POST | `/api/v1/categories` | User | Tạo danh mục (`categoryName`, `colorCode`). |
| PUT | `/api/v1/categories/{categoryId}` | User | Cập nhật tên/màu. |
| PATCH | `/api/v1/categories/{categoryId}/active` | User | Ẩn/hiện (`{ "isActive": false }`). |

Ràng buộc: cặp (`userId`, `categoryName`) duy nhất; số danh mục theo gói (Miễn phí 10, gói khác không giới hạn).

## 5. Công việc (Tasks)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks` | User | Danh sách. Query: `status`, `priority`, `categoryId`, `keyword`, `dueFrom`, `dueTo`, `page`, `pageSize`, `sort`. |
| POST | `/api/v1/tasks` | User | Tạo việc (kèm `reminders`, `repeatType`, `repeatDays`, `nagEveryMinutes`). |
| GET | `/api/v1/tasks/{taskId}` | User | Chi tiết (việc con, nhắc nhở, người được giao). |
| PUT | `/api/v1/tasks/{taskId}` | User | Cập nhật việc. |
| DELETE | `/api/v1/tasks/{taskId}` | User | Xóa việc (vào thùng rác). |
| POST | `/api/v1/tasks/{taskId}/complete` | User | Hoàn thành; hủy reminder chưa kích hoạt; sinh việc lặp kế tiếp. |
| POST | `/api/v1/tasks/{taskId}/reopen` | User | Mở lại việc đã Hoàn thành/Đã hủy. |
| POST | `/api/v1/tasks/{taskId}/cancel` | User | Hủy việc. |
| GET | `/api/v1/tasks/trash` | User | Danh sách việc trong thùng rác. |
| DELETE | `/api/v1/tasks/trash` | User | Dọn sạch thùng rác (xóa vĩnh viễn). |
| POST | `/api/v1/tasks/{taskId}/restore` | User | Khôi phục việc từ thùng rác. |

**POST `/api/v1/tasks`** — Request (việc lặp hằng tuần vào T2/T4, kèm 2 nhắc nhở và nhắc dai):
```json
{
  "title": "Ôn tập môn Toán",
  "description": "Chương 3 - Đạo hàm",
  "categoryId": 3,
  "priority": "HIGH",
  "dueAt": "2026-08-20T20:00:00+07:00",
  "repeatType": "WEEKLY",
  "repeatDays": [1, 3],
  "nagEveryMinutes": 10,
  "reminders": [
    { "remindAt": "2026-08-20T19:00:00+07:00" },
    { "remindAt": "2026-08-20T19:50:00+07:00" }
  ]
}
```

**POST `/api/v1/tasks/{taskId}/complete`** — Response `200`:
```json
{
  "success": true,
  "message": "Đã hoàn thành công việc",
  "data": {
    "completedTask": { "taskId": 101, "status": "COMPLETED", "completedAt": "2026-08-20T19:55:00+07:00" },
    "nextTask": { "taskId": 108, "status": "TODO", "dueAt": "2026-08-24T20:00:00+07:00", "parentTaskId": 101 }
  }
}
```

## 6. Nhắc nhở của một công việc (`/tasks/{taskId}/reminders`)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks/{taskId}/reminders` | User | Danh sách nhắc nhở. |
| POST | `/api/v1/tasks/{taskId}/reminders` | User | Thêm nhắc nhở (theo hạn mức gói). |
| PUT | `/api/v1/tasks/{taskId}/reminders/{reminderId}` | User | Sửa thời điểm nhắc. |
| DELETE | `/api/v1/tasks/{taskId}/reminders/{reminderId}` | User | Xóa nhắc nhở chưa kích hoạt. |

## 7. Giao việc & luân phiên (`/tasks/{taskId}/shares`)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks/{taskId}/shares` | User (chủ việc) | Danh sách người được giao. |
| POST | `/api/v1/tasks/{taskId}/shares` | User (Pro) | Giao việc theo `email` + `note` (tối đa 5 người/việc). |
| DELETE | `/api/v1/tasks/{taskId}/shares/{shareId}` | User (chủ việc) | Thu hồi giao việc. |
| PUT | `/api/v1/tasks/{taskId}/rotation` | User (Pro) | Bật/tắt luân phiên, đổi người của kỳ này. |

## 8. Việc con (Subtasks)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks/{taskId}/subtasks` | User | Danh sách việc con. |
| POST | `/api/v1/tasks/{taskId}/subtasks` | User | Thêm việc con (`content`). |
| PUT | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}` | User | Sửa nội dung. |
| POST | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}/toggle` | User | Đánh dấu hoàn thành/chưa. |
| DELETE | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}` | User | Xóa việc con. |

## 9. Nhắc nhở độc lập (`/reminders`)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/reminders/due` | User | Reminder đến hạn (polling dự phòng). Query: `to`. |
| GET | `/api/v1/reminders/{reminderId}` | User | Chi tiết reminder + thông tin công việc (hiển thị màn hình báo thức). |
| POST | `/api/v1/reminders/{reminderId}/snooze` | User | Hoãn. Body tùy chọn `{ "snoozeMinutes": 10 }` (mặc định lấy từ cài đặt). |
| POST | `/api/v1/reminders/{reminderId}/dismiss` | User | Tắt hẳn. |

Nếu đã hoãn đủ 3 lần, `snooze` trả `400` với message "Nhắc nhở này đã được hoãn tối đa 3 lần".

## 10. Thiết bị, thông báo, Web Push (`/devices`)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/v1/devices` | User | Đăng ký thiết bị (`deviceToken`, `platform`: `WEB`/`ANDROID`/`IOS`). |
| GET | `/api/v1/devices` | User | Danh sách thiết bị đang hoạt động. |
| DELETE | `/api/v1/devices/{deviceId}` | User | Gỡ thiết bị (soft delete). |
| GET | `/api/v1/devices/settings` | User | Cài đặt thông báo (âm thanh, hoãn mặc định, rung). |
| PUT | `/api/v1/devices/settings` | User | Cập nhật cài đặt thông báo. |
| GET | `/api/v1/devices/logs` | User | Lịch sử thông báo. Query: `from`, `to`, `page`, `pageSize`. |
| GET | `/api/v1/devices/push/key` | User | Khoá công khai VAPID để đăng ký push. |
| GET | `/api/v1/devices/push` | User | Trạng thái đăng ký Web Push của người dùng. |
| POST | `/api/v1/devices/push` | User | Đăng ký Web Push subscription. |
| POST | `/api/v1/devices/push/unsubscribe` | User | Hủy đăng ký Web Push. |

## 11. Dashboard, báo cáo, kế hoạch

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/dashboard` | User | Số liệu cá nhân: `todayCount`, `overdueCount`, `completedCount`, `upcomingCount`. |
| GET | `/api/v1/reports` | User (Pro) | Báo cáo năng suất. Query: `days` (7/30/90, mặc định 30). |
| GET | `/api/v1/reports/export` | User (Pro) | Nội dung file CSV (`filename`, `content`, `rows`, `truncated`). |
| GET | `/api/v1/planner/week` | User (Pro) | Kế hoạch 7 ngày. Query: `capacity` (3/5/8/10, mặc định 5). |

## 12. Trợ lý AI

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/ai/quota` | User | Số lượt AI còn lại hôm nay theo gói. |
| POST | `/api/v1/ai/parse-tasks` | User | Phân tích văn bản thành danh sách công việc. Body `{ "text": "..." }` (≤ 2.000 ký tự). |

Khi hết hạn mức, trả `429` kèm gợi ý nâng cấp. Khi AI không sẵn sàng, trả lỗi có mã `AI_NETWORK`/`AI_TIMEOUT`/`AI_HTTP`/`AI_BAD_RESPONSE`/`AI_EMPTY` để client fallback về parser cục bộ.

## 13. Gói (Plans)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/plans/me` | User | Gói hiện tại + hạn dùng. |

## 14. Thanh toán (Billing)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/billing/products` | Public | Bảng giá 4 gói (dùng cho trang giá và app Android). |
| POST | `/api/v1/billing/webhook/bank` | Public (xác thực bằng mã bí mật) | Webhook ngân hàng (SePay/Casso) báo có tiền vào. |
| GET | `/api/v1/billing/me` | User | Trạng thái gói, hạn dùng, lịch sử quyền lợi, đơn đang chờ. |
| POST | `/api/v1/billing/trial` | User | Kích hoạt 7 ngày dùng thử Pro (mỗi tài khoản một lần). |
| POST | `/api/v1/billing/orders` | User | Tạo đơn mua gói → trả `orderCode` + mã QR. |
| GET | `/api/v1/billing/orders/{orderCode}` | User | Xem trạng thái đơn. |
| POST | `/api/v1/billing/orders/{orderCode}/check` | User | Kiểm tra lại và kéo giao dịch ngân hàng ngay. |
| POST | `/api/v1/billing/orders/{orderCode}/cancel` | User | Hủy đơn chưa thanh toán. |

**POST `/api/v1/billing/orders`** — Request: `{ "plan": "PRO", "cycle": "MONTHLY" }`
Response `201`:
```json
{
  "success": true,
  "message": "Đã tạo đơn",
  "data": {
    "orderCode": "MNQ7K3PQR9X",
    "plan": "PRO",
    "cycle": "MONTHLY",
    "amount": 79000,
    "transferContent": "MNQ7K3PQR9X",
    "expiresAt": "2026-08-27T09:00:00+07:00",
    "bank": { "bankName": "Ngân hàng TMCP Á Châu (ACB)", "accountNumber": "…", "accountName": "…" },
    "qrImageUrl": "https://img.vietqr.io/image/970416-…-compact2.png?…"
  }
}
```

## 15. Điểm thưởng & mời bạn (Rewards)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/rewards/overview` | User | Điểm, chuỗi đăng nhập, mã mời, bảng đổi thưởng, lịch sử điểm, lời mời. |
| POST | `/api/v1/rewards/claim` | User | Đổi điểm lấy ngày dùng gói. Body `{ "tierId": "pro_7d" }`. |

Bảng đổi thưởng: `plus_7d` (200), `plus_30d` (500), `pro_7d` (800), `pro_30d` (1500). Điểm kiếm: đăng nhập +10/ngày, chuỗi 7 ngày +50, mời bạn +100.

## 16. Hỗ trợ (Support)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/support/conversation` | User | Hội thoại của tôi kèm tin nhắn gần nhất. |
| GET | `/api/v1/support/messages` | User | Tin nhắn mới hơn `since` (chat trực tiếp) + số chưa đọc. |
| POST | `/api/v1/support/messages` | User | Gửi tin nhắn (kèm tối đa 3 ảnh base64). |
| POST | `/api/v1/support/read` | User | Đánh dấu đã đọc tin của admin. |
| GET | `/api/v1/support/unread` | User | Số tin chưa đọc (huy hiệu menu). |
| GET | `/api/v1/support/attachments/{attachmentId}` | User/Admin | Tải ảnh đính kèm (chỉ chủ hội thoại hoặc admin). |

## 17. Lịch `.ics` (Calendar)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/calendar/{icsKey}` | Public (có khoá) | Trả tệp `text/calendar`. App lịch (Google/Outlook) gọi trực tiếp bằng URL có khoá; khoá sai trả `404`. |

## 18. Quản trị (Admin)

Mọi route dưới `/api/v1/admin/**` yêu cầu `auth` + vai trò `ADMIN`.

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/admin/dashboard` | Số liệu hệ thống: `totalUsers`, `totalTasks`, `activeTasks`, `notificationsToday`. |
| GET | `/api/v1/admin/users` | Danh sách người dùng. Query: `keyword`, `page`, `pageSize`. |
| POST | `/api/v1/admin/users` | Tạo tài khoản (`fullName`, `email`, `password`, `phoneNumber`, `role`). |
| POST | `/api/v1/admin/users/{userId}/lock` | Khóa tài khoản. |
| POST | `/api/v1/admin/users/{userId}/unlock` | Mở khóa tài khoản. |
| PUT | `/api/v1/admin/users/{userId}/plan` | Đổi gói thủ công (`FREE`/`PLUS`/`PRO`/`FAMILY`). |
| DELETE | `/api/v1/admin/users/{userId}` | Xóa vĩnh viễn tài khoản và dữ liệu liên quan. |
| GET | `/api/v1/admin/orders` | Danh sách đơn (lọc theo trạng thái / mã đơn / email). |
| POST | `/api/v1/admin/orders/{orderCode}/confirm` | Xác nhận đã nhận tiền → kích hoạt gói. |
| POST | `/api/v1/admin/orders/{orderCode}/cancel` | Hủy đơn chưa thanh toán. |
| POST | `/api/v1/admin/billing/transfers/{eventId}/attach` | Gán tay một giao dịch ngân hàng chưa khớp vào một đơn. |
| GET | `/api/v1/admin/billing/settings` | Xem cấu hình nhận tiền + trạng thái webhook/API. |
| PUT | `/api/v1/admin/billing/settings` | Lưu tài khoản nhận tiền. |
| POST | `/api/v1/admin/billing/settings/rotate-secret` | Sinh mã xác thực webhook mới. |
| POST | `/api/v1/admin/billing/test-webhook` | Gửi thử webhook từ máy chủ (không kích hoạt gói). |
| POST | `/api/v1/admin/billing/test-connection` | Kiểm tra kết nối API ngân hàng. |
| POST | `/api/v1/admin/billing/sync` | Đồng bộ giao dịch ngân hàng ngay. |
| GET | `/api/v1/admin/support/unread` | Số tin chưa trả lời. |
| GET | `/api/v1/admin/support/conversations` | Danh sách hội thoại (lọc chưa đọc / trạng thái / từ khoá). |
| GET | `/api/v1/admin/support/conversations/{conversationId}` | Xem một hội thoại kèm toàn bộ tin nhắn. |
| POST | `/api/v1/admin/support/conversations/{conversationId}/messages` | Trả lời người dùng (kèm tối đa 3 ảnh). |
| POST | `/api/v1/admin/support/conversations/{conversationId}/read` | Đánh dấu đã đọc. |
| PUT | `/api/v1/admin/support/conversations/{conversationId}/status` | Chuyển trạng thái `OPEN`/`RESOLVED`. |

> Admin **không** có endpoint xem nội dung công việc/danh mục của người dùng (BR-58).

## 19. Hệ thống

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/health` | Public | Trả `{ status: "ok" }`. Mỗi lần được gọi còn **đánh thức việc định kỳ** (đồng bộ ngân hàng, nhắc gia hạn, báo cáo tuần) — quan trọng vì máy chủ gói free có thể đang ngủ. |
| GET | `/docs` | Public | Swagger UI. |

## 20. Validation Rules tóm tắt theo entity

| Entity | Field | Validation |
|---|---|---|
| Đăng ký | `email` | `notEmpty().isEmail()`, chưa tồn tại |
| Đăng ký | `password` | `notEmpty().isLength({ min: 6, max: 50 })` |
| Đăng ký | `verificationCode` | `notEmpty()`, đúng mã, còn hiệu lực, chưa dùng |
| Task | `title` | `notEmpty().isLength({ max: 255 })` |
| Task | `dueAt` | `notEmpty().isISO8601()` |
| Task | `priority` | `isIn(['LOW','MEDIUM','HIGH','URGENT'])` |
| Task | `repeatType` | `isIn(['NONE','DAILY','WEEKLY','MONTHLY'])` |
| Task | `repeatDays` | chỉ khi `WEEKLY`, các giá trị số 1–7 |
| Task | `nagEveryMinutes` | `isIn([1,2,5,10,15,30])`, chỉ gói Pro |
| Reminder | `remindAt` | `notEmpty().isISO8601()`, ≤ `task.dueAt`, ≤ giới hạn gói |
| Category | `categoryName` | `notEmpty().isLength({ max: 100 })`, không trùng trong tài khoản |
| Snooze | `snoozeMinutes` | `optional().isInt({ min: 1, max: 60 })` |
| Device | `deviceToken` | `notEmpty()` |
| Device | `platform` | `notEmpty().isIn(['WEB','ANDROID','IOS'])` |
| Billing | `plan` / `cycle` | `isIn([...])` |
| Reward | `tierId` | `notEmpty().isString()`, thuộc bảng đổi thưởng |
| AI | `text` | `notEmpty()`, tối đa 2.000 ký tự |
| Support | `body` | `notEmpty()`; `attachments` tối đa 3 ảnh |

## 21. Mã lỗi nghiệp vụ thường gặp

| HTTP | Trường hợp | Message ví dụ |
|---|---|---|
| 400 | `remindAt` sau `dueAt` | "Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc" |
| 400 | Vượt số nhắc nhở theo gói | "Bạn đã dùng hết số nhắc nhở của gói Miễn phí. Nâng cấp…" |
| 400 | Hoãn quá 3 lần | "Nhắc nhở này đã được hoãn tối đa 3 lần" |
| 400 | Bật nhắc dai khi không có gói Pro | "Nhắc dai … là tính năng của gói Pro…" |
| 400 | Giao việc khi không có gói Pro | "Nhờ người khác làm là tính năng của gói Pro…" |
| 400 | Giao việc cho người chưa có tài khoản | "… chưa có tài khoản MN-Qronx. Hãy rủ họ đăng ký…" |
| 400 | Mời người đang trả phí vào gói Doanh nghiệp | "… đang có gói trả phí riêng nên không cần chia sẻ chỗ…" |
| 400 | Tên danh mục trùng | "Danh mục này đã tồn tại" |
| 400 | Dùng thử lần thứ hai | "Bạn đã dùng thử Pro rồi" |
| 403 | Thao tác trên Task không thuộc sở hữu | "Bạn không có quyền truy cập công việc này" |
| 403 | Tài khoản bị khóa cố đăng nhập | "Tài khoản của bạn đã bị khóa" |
| 404 | Dữ liệu không tồn tại / khóa `.ics` sai | "Không tìm thấy dữ liệu" |
| 429 | Hết lượt AI trong ngày | "Bạn đã dùng hết N lượt trợ lý AI hôm nay…" |
