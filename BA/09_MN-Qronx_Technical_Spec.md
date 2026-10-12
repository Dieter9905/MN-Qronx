# Technical Spec – MN-Qronx (Backend)

> Tài liệu này **gộp và thay thế** `09_Phase3_Technical_Spec.md` và `09_Technical_Spec_Simplified.md`. Nó mô tả backend đang chạy thật: layered architecture, các mẫu code bắt buộc, và đặc tả nghiệp vụ cho từng module.

---

## 1. Tổng quan

MN-Qronx dùng chung một REST API backend cho Web SPA (PWA) và app di động. Điểm khác biệt cốt lõi là **nhắc nhở kiểu báo thức** (âm thanh/rung/màn hình toàn màn hình, Hoãn/Tắt, và **nhắc dai** cho gói Pro). Trên nền đó là các mô-đun thương mại: gói trả phí & thanh toán, điểm thưởng, trợ lý AI, giao việc, gói gia đình, báo cáo/kế hoạch tuần, hỗ trợ khách hàng.

### 1.1. Kiến trúc tổng thể

```
┌─────────────────┐   ┌──────────────────┐   ┌───────────────────┐
│  Web SPA (PWA)  │   │ App di động (KH) │   │ App lịch ngoài    │
│  React + Vite   │   │ React Native     │   │ (Google/Outlook)  │
└────────┬────────┘   └────────┬─────────┘   └─────────┬─────────┘
         │  REST + JWT          │  REST + JWT            │ GET /calendar/{icsKey}
         └──────────┬───────────┘                        │
                    ▼                                    ▼
         ┌─────────────────────────────────────────────────────┐
         │            Backend (Node.js / Express 5)            │
         │  route → middleware → controller → service → Prisma │
         │  schedulers: reminder · bankSync · billing · weekly │
         └───────────────────────┬─────────────────────────────┘
                                 ▼
                    ┌────────────────────────────┐
                    │ PostgreSQL (Tiger Cloud)   │
                    └────────────────────────────┘
```

### 1.2. Architecture Rules

1. **Layered**: `route → controller → service → repository → Prisma`. Controller chỉ nhận request và trả response; service chứa nghiệp vụ và transaction; repository chỉ truy vấn DB.
2. **Không** DDD/CQRS/Event Sourcing, không microservice, không message queue.
3. Mọi response đi qua envelope `{ success, message, data }` nhờ `dto/response/apiResponse.js` và middleware `transformResponse`.
4. Mọi lỗi đi qua `ApiError` + middleware `errorHandler`.
5. Mọi truy vấn dữ liệu người dùng **khoá theo `userId`** của người gọi.
6. Giới hạn/quyền lợi gói chỉ đọc từ `utils/planLimits.js` (một nguồn duy nhất).

---

## 2. Mẫu code dùng chung

### ✅ Ownership check

```js
// repository chỉ trả dữ liệu thuộc user đang gọi
const task = await taskRepo.findById(taskId, req.user.id)  // where: { taskId, userId }
if (!task) throw ApiError.notFound('Không tìm thấy công việc')
```

### ✅ Xử lý Prisma P2002 (vi phạm unique)

```js
try {
  await repo.create(data)
} catch (err) {
  if (err.code === 'P2002') throw ApiError.badRequest('Danh mục này đã tồn tại')
  throw err
}
```

### ✅ Transaction (chỉ thao tác DB)

```js
await prisma.$transaction(async (tx) => {
  await tx.task.update({ where: { taskId }, data: { status: 'COMPLETED', completedAt: new Date() } })
  await tx.reminder.updateMany({
    where: { taskId, status: { in: ['SCHEDULED', 'TRIGGERED'] } },
    data: { status: 'CANCELLED' },
  })
  // tạo task lặp kế tiếp nếu repeatType !== 'NONE'
})
```

### ❌ Anti-pattern

- Gọi dịch vụ ngoài (push, email, ngân hàng) **bên trong** transaction → phải gọi sau khi transaction commit.
- Chép lại danh sách gói/giá/hạn mức ở controller hay service → chỉ dùng `planLimits`.
- Truy vấn không khoá `userId` → rò rỉ dữ liệu người khác.
- Trả lỗi trần (throw Error thường) → phải dùng `ApiError`.

---

## 3. Module 1 — Authentication

### 3.1. API

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/auth/send-verification-code` | Public | Gửi mã xác nhận email (6 số). |
| POST | `/auth/register` | Public | Đăng ký (cần mã hợp lệ). |
| POST | `/auth/login` | Public | Trả access + refresh token. |
| POST | `/auth/refresh-token` | Public | Cấp lại access token. |
| POST | `/auth/forgot-password` | Public | Gửi `resetToken`. |
| POST | `/auth/reset-password` | Public | Đặt lại mật khẩu. |
| POST | `/auth/logout` | User | Thu hồi refresh token. |
| GET | `/auth/google`, `/auth/google/callback` | Public | OAuth Google. |

### 3.2. Token

| | Access token | Refresh token |
|---|---|---|
| Dạng | JWT | Chuỗi ngẫu nhiên, lưu DB |
| Hạn | ngắn (~1 giờ) | ~7 ngày |
| Lưu ở client | `localStorage` (`mnq:accessToken`) | `mnq:refreshToken` |
| Vô hiệu | Hết hạn | Đổi mật khẩu / logout xóa trong DB |

### 3.3. Logic chính

```js
// Đăng ký: chỉ tạo tài khoản khi mã xác nhận hợp lệ
const code = await repo.findValidCode(email, verificationCode)   // còn hạn, chưa dùng
if (!code) throw ApiError.badRequest('Mã xác nhận không đúng hoặc đã hết hạn')
const user = await repo.createUser({ ...hash(password) })
await repo.markCodeUsed(code)
await prisma.notificationSetting.create({ data: { userId: user.userId } })

// Đăng nhập
if (!await bcrypt.compare(password, user.passwordHash)) throw ApiError.badRequest('Email hoặc mật khẩu không đúng')
if (!user.isActive) throw ApiError.forbidden('Tài khoản đã bị khóa')
const accessToken = signJwt({ id: user.userId, role: roleName }, { expiresIn: '1h' })
const refreshToken = crypto.randomBytes(40).toString('hex')
await authRepo.saveRefreshToken(user.userId, refreshToken, 7)
await rewardService.creditDailyLogin(user)   // cộng điểm + streak (idempotent theo ngày)

// Đổi mật khẩu
await userRepo.updatePassword(userId, await hash(newPassword))
await authRepo.deleteRefreshTokens(userId)   // thu hồi mọi phiên
```

### 3.4. Email xác nhận / đặt lại mật khẩu

- Gửi qua `emailService.sendEmail()` — chọn đường theo `MAIL_TRANSPORT` (`auto` → Resend → Mailjet API → SMTP).
- Kiểm tra hạn mức (`mailQuota`) trước khi gửi; nếu chưa cấu hình dịch vụ, môi trường dev trả mã trong response để test.

---

## 4. Module 2 — User Profile

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/me` | Hồ sơ (kèm gói, hạn, điểm, streak). |
| PUT | `/me` | Cập nhật `fullName`, `phoneNumber`, `avatarUrl`. |
| PUT | `/me/password` | Đổi mật khẩu (thu hồi phiên). |
| GET | `/me/stats` | Thống kê cá nhân. |
| GET | `/me/activity` | 5 thông báo gần nhất. |
| PUT | `/me/weekly-report` | Bật/tắt báo cáo tuần (Pro). |
| POST | `/me/weekly-report/test` | Gửi thử (chặn bấm liên tục). |
| GET/POST | `/me/ics`, `/me/ics/rotate` | Khóa lịch `.ics`. |
| GET/POST/GET/DELETE | `/me/sounds...` | Âm thanh riêng (Plus/Pro). |

Logic đáng chú ý: `weeklyReportTestAt` giới hạn tần suất gửi thử để không đốt hạn mức email; `icsKey` là bí mật xoay được.

---

## 5. Module 3 — Category

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/categories` | Danh sách (query `isActive`). |
| POST | `/categories` | Tạo. |
| PUT | `/categories/{categoryId}` | Cập nhật. |
| PATCH | `/categories/{categoryId}/active` | Ẩn/hiện. |

Ràng buộc: unique (`userId`, `categoryName`); giới hạn số danh mục theo gói (`planLimit(plan,'categories')`); ẩn không xóa cứng công việc.

---

## 6. Module 4 — Tasks (Core)

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/tasks` | Danh sách (filter, sort, paginate). |
| POST | `/tasks` | Tạo (kèm reminders, repeat, nag). |
| GET | `/tasks/{taskId}` | Chi tiết. |
| PUT | `/tasks/{taskId}` | Cập nhật. |
| DELETE | `/tasks/{taskId}` | Xóa vào thùng rác. |
| POST | `/tasks/{taskId}/complete` / `/reopen` / `/cancel` | Đổi trạng thái. |
| GET/DELETE | `/tasks/trash` | Xem/dọn thùng rác. |
| POST | `/tasks/{taskId}/restore` | Khôi phục. |

Mọi truy vấn lọc `deletedAt: null` (trừ thùng rác).

### 6.1. Complete (ERD-R-09, R-10) + lặp lại

```js
// transaction: cập nhật task + hủy reminder + sinh task kế tiếp
const completed = await tx.task.update({ data: { status: 'COMPLETED', completedAt: now } })
await tx.reminder.updateMany({ where: { taskId, status: { in: ['SCHEDULED','TRIGGERED'] } }, data: { status: 'CANCELLED' } })
if (task.repeatType !== 'NONE') {
  const nextDue = calculateNextDue(task.dueAt, task.repeatType, task.repeatDays)
  const next = await tx.task.create({ data: { userId, categoryId, title, priority, dueAt: nextDue,
    repeatType, repeatDays, nagEveryMinutes, parentTaskId: taskId, status: 'TODO' } })
  // tạo lại reminders theo hạn mới (remindAt giữ khoảng lệch so với dueAt cũ)
}
```

`calculateNextDue`: DAILY +1 ngày; WEEKLY nhảy tới thứ kế tiếp trong `repeatDays` (ISO 1–7); MONTHLY +1 tháng.

### 6.2. Delete = soft delete

```js
await prisma.task.update({ where: { taskId }, data: { deletedAt: new Date() } })
// scheduler dọn vĩnh viễn sau 30 ngày (kèm xóa task_shares theo cascade)
```

---

## 7. Module 5 — Subtask

`GET/POST /tasks/{taskId}/subtasks`, `PUT/DELETE .../{subtaskId}`, `POST .../{subtaskId}/toggle`. Giới hạn số việc con theo gói; `displayOrder` giữ thứ tự.

---

## 8. Module 6 — Reminder & Alarm

| Method | Endpoint | Mô tả |
|---|---|---|
| GET/POST | `/tasks/{taskId}/reminders` | Xem/thêm. |
| PUT/DELETE | `/tasks/{taskId}/reminders/{reminderId}` | Sửa/xóa. |
| GET | `/reminders/due` | Reminder đến hạn (polling dự phòng). |
| GET | `/reminders/{reminderId}` | Chi tiết + task (màn hình báo thức). |
| POST | `/reminders/{reminderId}/snooze` / `/dismiss` | Hoãn / Tắt. |

### 8.1. Thêm/Sửa

- `remindAt ≤ task.dueAt`; số reminder theo gói (`planLimit(plan,'remindersPerTask')`).

### 8.2. Snooze (tối đa 3)

```js
if (reminder.snoozeCount >= 3) throw ApiError.badRequest('Nhắc nhở này đã được hoãn tối đa 3 lần')
const minutes = body.snoozeMinutes ?? settings.defaultSnoozeMinutes
await prisma.reminder.update({ data: {
  remindAt: addMinutes(new Date(), minutes), status: 'SCHEDULED', snoozeCount: { increment: 1 },
}})
await prisma.notificationLog.create({ data: { reminderId, action: 'SNOOZED' } })
```

### 8.3. Dispatch & nhắc dai

Xem mục 11.3. Nhắc dai chỉ Pro, chu kỳ ∈ {1,2,5,10,15,30}, tối đa 10 lần (`NAG_MAX_REPEATS`).

---

## 9. Module 7 — Device & Notification

| Method | Endpoint | Mô tả |
|---|---|---|
| POST/GET/DELETE | `/devices`, `/devices/{deviceId}` | Thiết bị (soft delete). |
| GET/PUT | `/devices/settings` | Cài đặt thông báo. |
| GET | `/devices/logs` | Lịch sử thông báo. |
| GET/POST | `/devices/push`, `/devices/push/key`, `/devices/push/unsubscribe` | Web Push. |

- Giới hạn thiết bị theo gói; Web Push tối đa 6 subscription/người dùng.
- VAPID: từ ENV hoặc tự sinh và lưu `app_settings`.
- Gửi push: endpoint trả 404/410 → xóa subscription.

---

## 10. Module 8 — Dashboard, Reports, Planner, Admin

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/dashboard` | User | today/overdue/completed/upcoming. |
| GET | `/reports` | Pro | Báo cáo 7/30/90 ngày. |
| GET | `/reports/export` | Pro | CSV (≤ 2.000 dòng). |
| GET | `/planner/week` | Pro | Kế hoạch 7 ngày (capacity 3/5/8/10). |
| GET | `/admin/dashboard` | Admin | Số liệu hệ thống. |
| GET/POST | `/admin/users`, `/admin/users/{userId}/...` | Admin | Quản lý người dùng. |

- Báo cáo: loại việc trong thùng rác; ngày/giờ theo VN; "đúng hạn" = `completedAt ≤ dueAt`.
- Planner: xếp bằng luật (quá hạn lâu nhất → hạn gần nhất → ưu tiên), nêu rõ `atRisk` (việc sẽ trễ).
- Admin: không xem nội dung công việc người dùng; `deleteUser` từ chối tài khoản Admin.

---

## 11. Module 9 — Scheduler (trọng tâm)

### 11.1. Kiến trúc

```
cron (*/1 * * * *) ─┬─> purgeTrashIfDue()          (30 ngày, 1 lần/ngày)
                    ├─> syncFamilySeats()          (đồng bộ ghế theo chủ gói)
                    ├─> downgradeExpiredPlans()    (hạ gói hết hạn)
                    └─> quét reminder đến hạn ─> dispatchReminder()
```

Ngoài cron, nhịp `/health` gọi `runBankSyncIfDue()`, `runRenewalRemindersIfDue()`, `runWeeklyReportsIfDue()` để bù khi máy chủ vừa ngủ dậy.

### 11.2. Truy vấn quét

```js
const due = await prisma.reminder.findMany({
  where: { status: 'SCHEDULED', remindAt: { lte: now } },
  include: { task: { include: { user: { include: { devices: { where: { isActive: true } } } },
                               shares: { where: { doneAt: null } } } } },
})
```

### 11.3. dispatchReminder

1. `status = TRIGGERED`.
2. Soạn nội dung (`nagNotificationText`).
3. `pushToUser(userId, payload)` — Web Push (kêu khi đóng tab).
4. FCM (`platform !== 'WEB'`) + ghi `notificationLog` (`SENT`) cho từng thiết bị.
5. `nextNagPlan(...)` → nếu việc chưa xong, còn Pro, `nagCount < 10` thì đặt lại `remindAt = now + N phút`, `status = SCHEDULED`, `nagCount + 1`.

---

## 12. Module 10 — Billing, Rewards, AI, Sharing, Family, Support

### 12.1. Billing

- `GET /billing/products` (public), `GET /billing/me`, `POST /billing/trial`, `POST /billing/orders`, `GET /billing/orders/{code}`, `POST /billing/orders/{code}/check`, `POST /billing/orders/{code}/cancel`, `POST /billing/webhook/bank`.
- Nguồn giá/quyền lợi: `planLimits.js`. Mã đơn `MNQ` + 8 ký tự (bỏ ký tự dễ nhầm).
- `BillingProvider`: `VIETQR`, `WEBHOOK`, `MOMO`, `PLAY`, `ADMIN`, `TRIAL`, `REWARD`, `FAMILY`.
- Xác nhận: webhook (xác thực secret + chống trùng theo `external_id`) / API ngân hàng / admin. Khi khớp: ghi `Subscription` + cập nhật `users.plan`. Cùng gói còn hạn → **cộng dồn**.
- `downgradeExpiredPlans()` hạ gói hết hạn và đưa âm thanh riêng về mặc định.

### 12.2. Rewards

- `GET /rewards/overview`, `POST /rewards/claim`.
- Điểm: DAILY_LOGIN 10, STREAK_BONUS 50 (mỗi 7 ngày), INVITE 100. Bảng đổi: `plus_7d` 200, `plus_30d` 500, `pro_7d` 800, `pro_30d` 1500.
- Chống lạm dụng: cùng inviter + IP + device chỉ tính 1 tài khoản (`Invitation.status = REJECTED`).
- Đổi điểm đi qua `applyPlanChange` → có `Subscription`, có cộng dồn; chủ gói FAMILY còn hạn thì đổi điểm = gia hạn nhà.

### 12.3. AI

- `GET /ai/quota`, `POST /ai/parse-tasks`.
- Backend là proxy mỏng: `POST {AI_INFER_URL}/parse` (timeout 25s), sanitize theo cấu trúc form tạo việc.
- Hạn mức ngày theo gói (5 / 50 / ∞); trừ lượt chỉ sau khi thành công; hết hạn mức → `429`.
- Mã lỗi trả về để client fallback: `AI_TIMEOUT`, `AI_NETWORK`, `AI_HTTP`, `AI_BAD_RESPONSE`, `AI_EMPTY`.

### 12.4. Task Sharing

- `GET/POST/DELETE /tasks/{taskId}/shares`, `PUT /tasks/{taskId}/rotation`, `GET /me/assigned`, `PUT /me/assigned/{taskId}`.
- Chỉ Pro được giao việc; người nhận không cần gói. Tối đa 5 người/việc, 50 việc đang giao/tài khoản.
- Luân phiên: `rotationOrder` sắp theo `createdAt`/`shareId`; `nextTurnAssignee` là hàm thuần, tránh lệch thứ tự giữa các truy vấn.

### 12.5. Family

- `GET /me/family`, `POST /me/family/members`, `DELETE /me/family/members/{memberId}`, `POST /me/family/leave`, `GET /me/family/board`, `PUT /me/family/progress`.
- Ghế = `User.plan = PRO` + `Subscription.provider = FAMILY`, hạn theo chủ gói.
- `syncFamilySeats()` chạy mỗi phút; chủ hết hạn → thu ghế và xóa `familyMember`.
- Một người chỉ ở một nhà; không mời người đang trả phí riêng; chủ một nhà không vào nhà khác.

### 12.6. Support

- `GET/POST /support/*` (người dùng), `/admin/support/*` (admin).
- Mỗi người dùng một hội thoại; tối đa 3 ảnh/tin; đếm chưa đọc hai phía; trạng thái `OPEN`/`RESOLVED`.

### 12.7. Calendar `.ics`

- `GET /calendar/{icsKey}` (public theo khóa) + `GET /me/ics`, `POST /me/ics/rotate`.
- Chỉ chiều app → lịch (một chiều); đồng bộ hai chiều nằm trong "Sắp có".

---

## 13. Rate limiting & bảo vệ

- Giới hạn tần suất **nghiệp vụ**: gửi lại mã xác nhận, gửi thử báo cáo tuần, yêu cầu quên mật khẩu, hạn mức AI theo ngày, hạn mức email theo giờ/ngày.
- Chống lạm dụng mời bạn và chống xử lý trùng webhook.
- `helmet` + `cors` cấu hình ở `app.js`.

## 14. Kiểm thử

- Vitest (`backend/tests/*.test.js`): auth, forgotPassword, profile, categories, tasks, trash, nestedFixes, dashboard, billing, family, taskShare, nag, planner, reports, support, push, ics, email, resendEmail, mailQuota, aiService, googleAvatar, weeklyReport, adminDelete.
- Đối tượng test là hành vi nghiệp vụ (vd `dispatchReminder`, `nextNagPlan`, `planWeek`, `claimReward`) và endpoint qua DB test.

## 15. Environment Variables

Xem `08_MN-Qronx_Backend_Implementation_Plan.md`, mục 5. Cấu hình thanh toán đặt trong `billing_settings` (đè biến môi trường).

## 16. Response Format chuẩn

```json
{ "success": true, "message": "Thao tác thành công", "data": { } }
```
```json
{ "success": false, "message": "Thông tin đầu vào không hợp lệ", "errors": { "field": "message" } }
```

## 17. Lưu ý khi bảo vệ đồ án

### Câu hỏi thường gặp

| Câu hỏi | Trả lời ngắn |
|---|---|
| Vì sao không dùng message queue? | Quy mô đồ án: cron quét DB mỗi phút là đủ; thêm queue là over-engineering. |
| Chống gửi trùng thông báo thế nào? | Đánh dấu `TRIGGERED` trước khi gửi + chỉ mục (`status`,`remindAt`); hệ thống chạy một instance. |
| Vì sao lưu ảnh/âm thanh trong DB? | Không muốn phụ thuộc dịch vụ lưu file ngoài; có giới hạn kích thước và kiểm MIME. |
| Gói Pro Gia đình hoạt động ra sao? | Quyền lợi vật chất hóa trên `users.plan = PRO`, đồng bộ theo chủ gói mỗi phút. |
| Vì sao kế hoạch tuần không dùng AI? | AI riêng là model phân tích câu; xếp việc bằng luật để không bịa việc và không tốn lượt. |
| Thanh toán tự động thế nào? | VietQR + webhook SePay/Casso (xác thực secret, chống trùng) và API ngân hàng, fallback admin xác nhận. |

### Demo flow gợi ý

1. Đăng ký (nhập mã email) → tạo việc có nhắc nhở → thấy màn hình báo thức khi đến giờ.
2. Bật nhắc dai (Pro) → cho việc kêu lại tới khi bấm Xong.
3. Dùng trợ lý AI nhập một câu → tạo việc hàng loạt.
4. Giao việc cho một tài khoản khác → người nhận đánh dấu xong phần của mình.
5. Mua gói → tạo đơn, quét mã QR, admin xác nhận → gói được kích hoạt.
6. Xem báo cáo năng suất và kế hoạch tuần (Pro).

---

## 18. So sánh trước và sau khi mở rộng

| Hạng mục | Bản MVP (TaskAlarm) | Bản hiện tại (MN-Qronx) |
|---|---|---|
| Xác thực | JWT một token | Access + refresh token, xác thực email, Google OAuth |
| Xóa công việc | Xóa cứng (có điều kiện) | Thùng rác 30 ngày + khôi phục |
| Lặp lại | NONE/DAILY/WEEKLY/MONTHLY | Thêm chọn thứ trong tuần; giữ chuỗi `parentTaskId` |
| Nhắc nhở | Snooze tối đa 3 | Thêm **nhắc dai** (Pro) tới khi xác nhận |
| Thông báo | Polling khi tab mở | Web Push (kêu khi đóng tab) + FCM + polling dự phòng |
| Gói & thanh toán | Không có | 4 gói, VietQR/webhook/API ngân hàng, dùng thử, hạ gói hết hạn |
| Cộng tác | Không có | Giao việc + luân phiên (Pro), gói gia đình 4 tài khoản |
| AI | Không có | Trợ lý AI riêng + nhập giọng nói + hạn mức theo gói |
| Báo cáo | Dashboard 4 số | Báo cáo 7/30/90 + xuất CSV + báo cáo tuần qua email |
| Hỗ trợ | Không có | Chat người dùng ↔ admin |
| Tăng trưởng | Không có | Điểm thưởng, chuỗi đăng nhập, mã mời |
| Lịch | Xem trong app | Thêm xuất feed `.ics` cho Google/Outlook |
| CSDL | ~10 bảng | 27 bảng |
