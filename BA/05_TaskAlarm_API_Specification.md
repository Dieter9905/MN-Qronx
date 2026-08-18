# API Specification – TaskAlarm

## 1. Quy ước chung

- Toàn bộ API backend prefix bằng `/api/v1/`.
- Danh từ số nhiều cho tài nguyên, `kebab-case` khi nhiều từ (`/notification-settings`).
- Token xác thực: `Authorization: Bearer <JWT>`. Endpoint public: `/api/v1/auth/**`.
- Mọi response thành công theo envelope chuẩn:

```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": { }
}
```

- Mọi response lỗi trả `errors` dạng object `field -> message`:

```json
{
  "success": false,
  "message": "Thông tin đầu vào không hợp lệ",
  "errors": {
    "title": "Tiêu đề không được để trống"
  }
}
```

- Không có field `timestamp` trong cả hai trường hợp.
- Thời gian (`dueAt`, `remindAt`, `sentAt`...) truyền/trả dưới dạng ISO-8601 kèm offset (ví dụ `2026-08-20T09:00:00+07:00`); backend lưu và xử lý theo UTC.
- HTTP Status Code dùng theo chuẩn: `200` (thành công), `201` (tạo mới), `400` (dữ liệu không hợp lệ), `401` (chưa đăng nhập/token hết hạn), `403` (không có quyền), `404` (không tìm thấy), `500` (lỗi hệ thống).
- Danh sách hỗ trợ phân trang qua query `page` (bắt đầu từ 1), `pageSize` (mặc định 20, tối đa 100).

## 2. Authentication

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Đăng ký tài khoản User mới. | Public |
| POST | `/api/v1/auth/login` | Đăng nhập, trả về JWT. Dùng chung cho User và Admin. | Public |
| POST | `/api/v1/auth/forgot-password` | Gửi yêu cầu đặt lại mật khẩu qua email. | Public |
| POST | `/api/v1/auth/reset-password` | Đặt lại mật khẩu bằng `resetToken` hợp lệ. | Public |

**POST `/api/v1/auth/register`** — Request:
```json
{ "fullName": "Nguyen Van A", "email": "a@example.com", "password": "Passw0rd!" }
```
Response `201`:
```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": { "userId": 12, "fullName": "Nguyen Van A", "email": "a@example.com" }
}
```

**POST `/api/v1/auth/login`** — Response `200`:
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": { "userId": 12, "fullName": "Nguyen Van A", "email": "a@example.com", "role": "USER" }
  }
}
```

## 3. User Profile

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/me` | Lấy hồ sơ User hiện tại. | User |
| PUT | `/api/v1/me` | Cập nhật hồ sơ cá nhân (`fullName`, `phoneNumber`). | User |
| PUT | `/api/v1/me/password` | Đổi mật khẩu (`currentPassword`, `newPassword`). | User |

## 4. Categories

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/categories` | Danh sách danh mục của User hiện tại. Query: `isActive` (tùy chọn). | User |
| POST | `/api/v1/categories` | Tạo danh mục mới (`categoryName`, `colorCode`). | User |
| PUT | `/api/v1/categories/{categoryId}` | Cập nhật tên/màu danh mục thuộc sở hữu của mình. | User |
| PATCH | `/api/v1/categories/{categoryId}/active` | Ẩn/hiện danh mục (`{ "isActive": false }`), không xóa cứng. | User |

## 5. Tasks

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/tasks` | Danh sách công việc. Query: `status`, `priority`, `categoryId`, `keyword`, `dueFrom`, `dueTo`, `page`, `pageSize`, `sort` (`dueAsc`/`dueDesc`/`priorityDesc`). | User |
| POST | `/api/v1/tasks` | Tạo công việc mới, có thể kèm `reminders` và `repeatType` ngay khi tạo. | User |
| GET | `/api/v1/tasks/{taskId}` | Chi tiết công việc, gồm `subtasks` và `reminders`. | User |
| PUT | `/api/v1/tasks/{taskId}` | Cập nhật thông tin công việc. | User |
| DELETE | `/api/v1/tasks/{taskId}` | Xóa công việc (chỉ khi chưa từng phát sinh `notificationLog`; ngược lại trả `400` gợi ý hủy thay vì xóa). | User |
| POST | `/api/v1/tasks/{taskId}/complete` | Đánh dấu Hoàn thành. Backend tự hủy các reminder chưa kích hoạt và tự sinh task lặp kế tiếp nếu `repeatType <> NONE`. | User |
| POST | `/api/v1/tasks/{taskId}/reopen` | Chuyển công việc đã Hoàn thành/Đã hủy quay lại Chưa làm. | User |
| POST | `/api/v1/tasks/{taskId}/cancel` | Hủy công việc; backend tự hủy các reminder chưa kích hoạt. | User |

**POST `/api/v1/tasks`** — Request (ví dụ công việc lặp hằng ngày kèm 2 nhắc nhở):
```json
{
  "title": "Ôn tập môn Toán",
  "description": "Chương 3 - Đạo hàm",
  "categoryId": 3,
  "priority": "HIGH",
  "dueAt": "2026-08-20T20:00:00+07:00",
  "repeatType": "DAILY",
  "reminders": [
    { "remindAt": "2026-08-20T19:00:00+07:00" },
    { "remindAt": "2026-08-20T19:50:00+07:00" }
  ]
}
```
Response `201`:
```json
{
  "success": true,
  "message": "Tạo công việc thành công",
  "data": {
    "taskId": 101,
    "title": "Ôn tập môn Toán",
    "status": "TODO",
    "priority": "HIGH",
    "dueAt": "2026-08-20T20:00:00+07:00",
    "repeatType": "DAILY",
    "categoryId": 3,
    "reminders": [
      { "reminderId": 501, "remindAt": "2026-08-20T19:00:00+07:00", "status": "SCHEDULED" },
      { "reminderId": 502, "remindAt": "2026-08-20T19:50:00+07:00", "status": "SCHEDULED" }
    ]
  }
}
```

Lỗi validate (ví dụ `remindAt` sau `dueAt`) trả `400`:
```json
{
  "success": false,
  "message": "Thông tin đầu vào không hợp lệ",
  "errors": { "reminders[1].remindAt": "Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc" }
}
```

**POST `/api/v1/tasks/{taskId}/complete`** — Response `200` (trường hợp task có lặp lại):
```json
{
  "success": true,
  "message": "Đã hoàn thành công việc",
  "data": {
    "completedTask": { "taskId": 101, "status": "COMPLETED", "completedAt": "2026-08-20T19:55:00+07:00" },
    "nextTask": { "taskId": 108, "status": "TODO", "dueAt": "2026-08-21T20:00:00+07:00", "parentTaskId": 101 }
  }
}
```

## 6. Subtasks

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/tasks/{taskId}/subtasks` | Danh sách việc con của một công việc. | User |
| POST | `/api/v1/tasks/{taskId}/subtasks` | Thêm việc con (`content`). | User |
| PUT | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}` | Sửa nội dung việc con. | User |
| POST | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}/toggle` | Đánh dấu hoàn thành/chưa hoàn thành việc con. | User |
| DELETE | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}` | Xóa việc con. | User |

## 7. Reminders

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/tasks/{taskId}/reminders` | Danh sách nhắc nhở của một công việc. | User |
| POST | `/api/v1/tasks/{taskId}/reminders` | Thêm nhắc nhở mới (tối đa 5 nhắc nhở đang hoạt động/công việc). | User |
| PUT | `/api/v1/tasks/{taskId}/reminders/{reminderId}` | Sửa thời điểm nhắc nhở (chỉ khi đang `SCHEDULED`). | User |
| DELETE | `/api/v1/tasks/{taskId}/reminders/{reminderId}` | Xóa nhắc nhở khi chưa đến giờ báo. | User |
| GET | `/api/v1/reminders/due` | Trả các reminder đến hạn kích hoạt cho User hiện tại (dùng cho polling dự phòng khi thiết bị vừa online lại). Query: `to` (mặc định = hiện tại). | User |
| GET | `/api/v1/reminders/{reminderId}` | Chi tiết một reminder kèm thông tin task, dùng để hiển thị màn hình báo thức. | User |
| POST | `/api/v1/reminders/{reminderId}/snooze` | Hoãn báo thức đang kêu. Body tùy chọn `{ "snoozeMinutes": 10 }`, mặc định lấy từ `notification-settings`. | User |
| POST | `/api/v1/reminders/{reminderId}/dismiss` | Tắt hẳn báo thức đang kêu. | User |

**POST `/api/v1/reminders/{reminderId}/snooze`** — Response `200`:
```json
{
  "success": true,
  "message": "Đã hoãn nhắc nhở 10 phút",
  "data": { "reminderId": 501, "status": "SCHEDULED", "remindAt": "2026-08-20T20:10:00+07:00", "snoozeCount": 1 }
}
```
Nếu đã hoãn đủ 3 lần, trả `400`:
```json
{
  "success": false,
  "message": "Không thể hoãn thêm",
  "errors": { "reminderId": "Nhắc nhở này đã được hoãn tối đa 3 lần" }
}
```

**POST `/api/v1/reminders/{reminderId}/dismiss`** — Response `200`:
```json
{
  "success": true,
  "message": "Đã tắt nhắc nhở",
  "data": { "reminderId": 501, "status": "DISMISSED" }
}
```

## 8. Devices (Push Notification)

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/devices` | Đăng ký thiết bị nhận thông báo đẩy (`deviceToken`, `platform`: `WEB`/`ANDROID`/`IOS`). Nếu token đã tồn tại, cập nhật `isActive = true` và gắn lại `userId`. | User |
| GET | `/api/v1/devices` | Danh sách thiết bị đang hoạt động của User hiện tại. | User |
| DELETE | `/api/v1/devices/{deviceId}` | Gỡ thiết bị (chuyển `isActive = false`, không xóa cứng để giữ lịch sử thông báo). | User |

## 9. Notification Settings & Logs

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/notification-settings` | Lấy cài đặt thông báo của User hiện tại. | User |
| PUT | `/api/v1/notification-settings` | Cập nhật `alarmSound`, `defaultSnoozeMinutes`, `vibrationEnabled`. | User |
| GET | `/api/v1/notification-logs` | Lịch sử thông báo đã gửi. Query: `from`, `to`, `page`, `pageSize`. | User |

## 10. Calendar & Dashboard

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/tasks?dueFrom=...&dueTo=...` | Dùng lại endpoint danh sách công việc (mục 5) với filter khoảng thời gian để hiển thị Calendar View; không cần endpoint `/calendar` riêng. | User |
| GET | `/api/v1/dashboard` | Số liệu tổng quan cá nhân: `todayCount`, `overdueCount`, `completedCount`, `upcomingCount`. | User |

**GET `/api/v1/dashboard`** — Response `200`:
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": { "todayCount": 4, "overdueCount": 1, "completedCount": 12, "upcomingCount": 7 }
}
```

## 11. Admin

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/dashboard` | Số liệu tổng quan hệ thống: tổng số User, tổng số Task, số thông báo đã gửi hôm nay. | Admin |
| GET | `/api/v1/admin/users` | Danh sách User. Query: `keyword`, `isActive`, `page`, `pageSize`. | Admin |
| POST | `/api/v1/admin/users/{userId}/lock` | Khóa tài khoản (`isActive = false`). | Admin |
| POST | `/api/v1/admin/users/{userId}/unlock` | Mở khóa tài khoản (`isActive = true`). | Admin |

> Admin **không có** endpoint xem chi tiết nội dung Task/Category của User (BR-19); chỉ thao tác trên trạng thái tài khoản.

## 12. Bean Validation tóm tắt theo Entity

| Entity | Field | Validation |
|---|---|---|
| RegisterRequest | `email` | `@NotBlank @Email` |
| RegisterRequest | `password` | `@NotBlank @Size(min = 6, max = 50)` |
| TaskRequest | `title` | `@NotBlank @Size(max = 255)` |
| TaskRequest | `dueAt` | `@NotNull` |
| TaskRequest | `priority` | `@NotNull`, thuộc `{LOW, MEDIUM, HIGH, URGENT}` |
| TaskRequest | `repeatType` | thuộc `{NONE, DAILY, WEEKLY, MONTHLY}`, mặc định `NONE` |
| ReminderRequest | `remindAt` | `@NotNull`, phải `<= task.dueAt` |
| CategoryRequest | `categoryName` | `@NotBlank @Size(max = 100)` |
| SnoozeRequest | `snoozeMinutes` | `@Min(1) @Max(60)` (tùy chọn) |
| DeviceRequest | `deviceToken` | `@NotBlank` |
| DeviceRequest | `platform` | thuộc `{WEB, ANDROID, IOS}` |

## 13. Mã lỗi nghiệp vụ thường gặp

| HTTP | Trường hợp | Message ví dụ |
|---|---|---|
| 400 | `remindAt` sau `dueAt` | "Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc" |
| 400 | Vượt quá 5 nhắc nhở/công việc | "Mỗi công việc chỉ được có tối đa 5 nhắc nhở đang hoạt động" |
| 400 | Snooze quá 3 lần | "Nhắc nhở này đã được hoãn tối đa 3 lần" |
| 400 | Tên danh mục trùng | "Danh mục này đã tồn tại" |
| 403 | User thao tác trên Task không thuộc sở hữu | "Bạn không có quyền truy cập công việc này" |
| 403 | Tài khoản bị khóa cố đăng nhập | "Tài khoản của bạn đã bị khóa" |
| 404 | Task/Reminder/Category không tồn tại | "Không tìm thấy dữ liệu" |
