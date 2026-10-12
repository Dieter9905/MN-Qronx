# Backend Setup – Spec & Implementation Plan (MN-Qronx)

> Tài liệu này thay thế `08_Backend_Implementation_Plan.md`. Nó mô tả **backend đang chạy** (`backend/`), không phải kế hoạch ban đầu.

## 1. Tổng quan

Backend MN-Qronx là **một monolith Node.js** theo kiến trúc phân lớp (route → middleware → controller → service → repository → Prisma), REST API prefix `/api/v1/`, xác thực JWT (access + refresh token), ORM Prisma trên PostgreSQL. Ngoài lõi quản lý công việc & nhắc nhở, backend còn phục vụ các mô-đun thương mại: gói & thanh toán, điểm thưởng, trợ lý AI, giao việc, gói gia đình, báo cáo/kế hoạch tuần, hỗ trợ khách hàng.

## 2. Tech Stack (Backend) — phiên bản đang dùng

| Thành phần | Library | Phiên bản |
|---|---|---|
| Runtime | Node.js | 20+ LTS |
| Framework | Express | 5.x |
| ORM | Prisma + @prisma/client | 6.x |
| Auth | jsonwebtoken + bcryptjs | 9.x / 3.x |
| Validation | express-validator | 7.x |
| Scheduler | node-cron | 4.x |
| Push (Web) | web-push | 3.x |
| Push (Mobile) | firebase-admin | 14.x |
| Email | nodemailer (Mailjet SMTP) + Mailjet Send API + Resend (HTTPS) | 10.x |
| QR | qrcode | 1.x |
| API docs | swagger-jsdoc + swagger-ui-express | 6.x / 5.x |
| Env config | dotenv | 17.x |
| CORS / Security | cors 2.x · helmet 8.x · cookie-parser 1.x | |
| Dev runner | nodemon | 3.x |
| Test | vitest | 4.x |

## 3. Cấu trúc thư mục (thực tế)

Xem `07_MN-Qronx_Architecture.md`, mục 3. Tóm tắt các nhánh chính:

- `src/routes/` — mount: `/auth`, `/me`, `/categories`, `/tasks`, `/reminders`, `/devices`, `/dashboard`, `/reports`, `/planner`, `/admin`, `/plans`, `/billing`, `/rewards`, `/ai`, `/support`, `/calendar`, và `/health`.
- `src/controllers/` — auth, user, category, task, subtask, reminder, taskShare, device, dashboard, report, planner, admin, plan, billing, reward, ai, support, family, calendarIcs, customSound.
- `src/services/` — nghiệp vụ, trong đó các dịch vụ đặc thù: `planLimits` (utils), `nagService`, `reminderDispatchService`, `pushService`, `emailService` + `mailQuota`, `billingService`, `vietQrService`, `bankApiService`, `rewardService`, `aiService` + `aiQuotaService`, `reportService`, `plannerService`, `taskShareService`, `familyService`, `supportService`, `calendarIcsService`, `customSoundService`, `googleAuthService`.
- `src/repositories/` — task, category, reminder, device, user, admin, auth, subtask, customSound.
- `src/schedulers/` — reminder, bankSync, billingReminder, weeklyReport.
- `src/dto/request/` — validate theo module; `src/dto/response/apiResponse.js` — envelope.
- `scripts/` — `db-dump.mjs`, `db-restore.mjs`, `check-mail-dns.mjs`, `send-test-email.mjs`, `mailjet-status.mjs`, `verify-mailjet-domain.mjs`, `check-resend.mjs`.
- `tests/` — bộ test Vitest.

## 4. Chi tiết triển khai theo giai đoạn

### Phase 1 — Bootstrap & hạ tầng

| # | Việc | Chi tiết |
|---|---|---|
| 1.1 | Khởi tạo project `backend/` | `type: module`; scripts `dev`, `start`, `seed`, `test`, `db:dump`, `db:restore`, `mail:*`. |
| 1.2 | Dependencies | Theo bảng mục 2. |
| 1.3 | `src/config/index.js` | Đọc và chuẩn hóa biến môi trường (server, db, jwt, smtp/mail, resend, vapid, fcm, google, billing, ai). |
| 1.4 | `src/app.js` | `helmet` → `cors` → `express.json` (giới hạn dung lượng cho ảnh base64) → mount route → `errorHandler` → `notFound`. |
| 1.5 | `src/server.js` | Khởi động scheduler, móc việc định kỳ vào `/health`, graceful shutdown (SIGTERM/SIGINT, force sau 10s), bắt `unhandledRejection`. |
| 1.6 | Swagger | `config/swagger.js` + JSDoc trong route; UI tại `/docs`. |

### Phase 2 — Prisma schema & database

| # | Việc | Chi tiết |
|---|---|---|
| 2.1 | Định nghĩa enum | RoleName, TaskStatus, TaskPriority, RepeatType, ReminderStatus, NotificationAction, Platform, Plan, BillingProvider, BillingCycle, OrderStatus, SubscriptionStatus, InvitationStatus, SupportStatus, SupportSender. |
| 2.2 | Định nghĩa 27 model | Tài khoản, công việc, thông báo, thương mại, tăng trưởng, cộng tác, hỗ trợ (xem `03`/`04`). |
| 2.3 | Quan hệ & chỉ mục | Theo ERD; đặc biệt `ix_reminders_status_remind_at` cho scheduler và các chỉ mục theo `userId`. |
| 2.4 | Seed | Roles, admin, tài khoản demo (Plus), danh mục/việc/việc con/nhắc nhở/thiết bị mẫu. |
| 2.5 | Đồng bộ | `npx prisma db push` (chạy tự động khi deploy qua `render.yaml`). |

### Phase 3 — Middleware & utils

`auth` (verify JWT, gắn `req.user`), `authorize(...roles)`, `validate` (express-validator → `400 { errors }`), `transformResponse` (định hình dữ liệu trả về), `errorHandler`, `notFound`; `ApiError` (badRequest/unauthorized/forbidden/notFound/tooManyRequests), `catchAsync`, `dateUtils` (startOfDay/endOfDay/addDays/addMinutes,…), `pagination`, `tokenUtils`, `planLimits`, `bankProviders`, `vietQrService`.

### Phase 4 — Lõi công việc & nhắc nhở

Auth (xác thực email, refresh token, Google OAuth) → User profile → Category → Task (+ thùng rác, lặp lại) → Subtask → Reminder (+ scheduler) → Device/Notification Settings/Logs/Web Push → Dashboard → Admin → Scheduler + Push.

### Phase 5 — Mô-đun thương mại & mở rộng

| Thứ tự | Module | Ghi chú |
|---|---|---|
| 1 | Plans & Billing | `planLimits`, VietQR, webhook ngân hàng, API ngân hàng, đơn hàng, subscription, dùng thử, hạ gói hết hạn. |
| 2 | Rewards | Điểm đăng nhập/chuỗi/mời bạn, mã mời, đổi thưởng. |
| 3 | AI | Proxy tới inference server riêng + hạn mức theo ngày. |
| 4 | Task Sharing | Giao việc (Pro), luân phiên. |
| 5 | Family | Gói Pro Gia đình, đồng bộ ghế theo chủ gói. |
| 6 | Reports & Planner | Báo cáo 7/30/90 + xuất CSV; kế hoạch tuần bằng luật. |
| 7 | Nag/Snooze nâng cao | Nhắc dai theo gói. |
| 8 | Báo cáo tuần qua email | `weeklyReportScheduler`. |
| 9 | Support | Hội thoại, tin nhắn, ảnh đính kèm. |
| 10 | Calendar `.ics` | Feed công khai theo khóa. |
| 11 | Custom sounds | Âm thanh báo thức tự tải lên. |

## 5. Environment Variables

```env
# Server
PORT=8080
NODE_ENV=development

# Database – Tiger Cloud (giữ nguyên tham số sslmode)
DATABASE_URL="postgresql://user:password@host:5432/taskalarm?sslmode=require"

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8080/api/v1/auth/google/callback
FRONTEND_URL=http://localhost:5173

# Email – Mailjet (API + SMTP) và Resend dự phòng
MAIL_TRANSPORT=auto            # auto | resend | api | smtp
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=587
SMTP_USER=your-mailjet-api-key
SMTP_PASS=your-mailjet-secret-key
SMTP_SECURE=false
EMAIL_FROM=MN-Qronx <no-reply@mn-qronx.id.vn>
MAILJET_API_KEY=your-mailjet-api-key
MAILJET_SECRET_KEY=your-mailjet-secret-key
MAILJET_SANDBOX=false
MAILJET_OWNERSHIP_HOST=mailjet._93f3b17d
MAIL_HOURLY_LIMIT=10
MAIL_DAILY_LIMIT=10
MAIL_QUOTA_TZ=Asia/Ho_Chi_Minh
RESEND_API_KEY=
RESEND_FROM=

# Web Push (VAPID) – thiếu thì hệ thống tự sinh và lưu vào app_settings
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_EMAIL=mailto:admin@mn-qronx.id.vn

# Firebase Cloud Messaging (tùy chọn, cho app di động)
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=

# Trợ lý AI riêng (thư mục ai/)
AI_INFER_URL=http://localhost:8000
AI_API_KEY=
AI_MODEL_VERSION=mn-qronx-parser-v1
```

Cấu hình thanh toán (ngân hàng nhận tiền, mã bí mật webhook, provider API ngân hàng, chu kỳ đồng bộ) **đặt được ngay trong trang quản trị** (bảng `billing_settings`) và **đè lên biến môi trường**, nên đổi ngân hàng không cần deploy.

## 6. Quy ước API

Theo `05_MN-Qronx_API_Specification.md`: prefix `/api/v1/`, `Authorization: Bearer <JWT>`, envelope `{ success, message, data }` / `{ success, message, errors }`, phân trang `?page=&pageSize=`, thời gian ISO-8601 (lưu UTC), HTTP status 200/201/400/401/403/404/410/429/500.

## 7. Business Rules quan trọng cần implement ở Service Layer

| Nhóm | Rule cần implement |
|---|---|
| Công việc | Giới hạn việc theo gói; soft delete + thùng rác 30 ngày; sinh việc lặp kế tiếp; hủy reminder khi hoàn thành/hủy. |
| Nhắc nhở | `remindAt ≤ dueAt`; giới hạn số nhắc theo gói; snooze ≤ 3; nhắc dai chỉ Pro (1–30 phút, tối đa 10 lần). |
| Danh mục | Tên duy nhất theo tài khoản; ẩn không xóa cứng việc. |
| Thiết bị | `deviceToken` gắn một tài khoản; soft delete; giới hạn thiết bị theo gói; Web Push tối đa 6 subscription. |
| Billing | Đơn mã `MNQ…`; webhook xác thực + chống trùng; cộng dồn cùng gói; dùng thử 1 lần; hạ gói hết hạn. |
| Rewards | Điểm idempotent theo ngày; chống lạm dụng mời bạn theo IP+thiết bị; đổi điểm đi qua cùng luồng cấp gói. |
| AI | Hạn mức ngày theo gói (FREE 5, PLUS 50, PRO ∞); trừ lượt chỉ khi thành công. |
| Sharing/Family | Chỉ Pro giao việc; người nhận không sửa việc; tối đa 5 người/việc, 50 việc đang giao; một người một nhà; đồng bộ ghế theo chủ gói. |
| Reports/Planner | Loại việc trong thùng rác; ngày/giờ theo VN; planner xếp bằng luật, nêu rõ việc sẽ trễ. |
| Support | Mỗi người một hội thoại; tối đa 3 ảnh/tin nhắn; đếm chưa đọc hai phía. |

## 8. Kiểm thử

Bộ test chạy bằng **Vitest** (`npm test`) trong `backend/tests/`, bao phủ: `auth`, `forgotPassword`, `profile`, `categories`, `tasks`, `trash`, `nestedFixes`, `dashboard`, `billing`, `family`, `taskShare`, `nag`, `planner`, `reports`, `support`, `push`, `ics`, `email`, `resendEmail`, `mailQuota`, `aiService`, `googleAvatar`, `weeklyReport`, `adminDelete`. Có `globalSetup.js`/`setup.js`/`cleanupTestData.js` để dựng và dọn dữ liệu test.

> ⚠️ Không chạy test vào DB thật: `DATABASE_URL` trên máy dev nối thẳng dữ liệu khách; test chỉ được tạo/dọn dữ liệu `*@example.com`.

## 9. Acceptance Criteria (trạng thái hiện tại)

- [x] `npm run dev` chạy không lỗi; server listen trên `PORT`; log khởi động scheduler.
- [x] `npx prisma db push` đồng bộ 27 bảng + enum + chỉ mục.
- [x] `npm run seed` tạo roles, admin, tài khoản demo.
- [x] `GET /api/v1/health` trả `{ status: "ok" }` và đánh thức việc định kỳ.
- [x] Toàn bộ route trong `src/routes/index.js` được mount; tài liệu Swagger tại `/docs`.
- [x] Middleware xác thực, phân quyền, validate, transform và error handler hoạt động.
- [x] Scheduler nhắc nhở (1 phút) + nhắc dai hoạt động; dọn thùng rác 30 ngày.
- [x] Thanh toán: tạo đơn, mã QR, webhook/API ngân hàng, admin xác nhận, hạ gói hết hạn.
- [x] Điểm thưởng, trợ lý AI (hạn mức), giao việc, gói gia đình, báo cáo/kế hoạch tuần, hỗ trợ.
- [x] Bộ test Vitest bao phủ các module chính (chạy trên DB test).
