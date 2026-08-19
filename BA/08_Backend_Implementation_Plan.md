# Backend Setup – Spec & Implementation Plan

## 1. Tổng quan

Thiết lập project backend Node.js cho TaskAlarm theo kiến trúc đã phê duyệt trong `07_TaskAlarm_Architecture.md`. Backend là 1 monolith duy nhất, REST API prefix `/api/v1/`, xác thực JWT, ORM Prisma, DB PostgreSQL.

**Mục tiêu phase này:** Bootstrap project, cấu hình tooling, tạo Prisma schema từ ERD, setup middleware chung, seed data — sẵn sàng cho việc implement các module nghiệp vụ.

---

## 2. Tech Stack (Backend)

| Thành phần | Library | Phiên bản |
|---|---|---|
| Runtime | Node.js | 20+ LTS |
| Framework | Express.js | 4.x |
| ORM | Prisma | 6.x |
| Auth | jsonwebtoken + bcryptjs | latest |
| Validation | express-validator | 7.x |
| Scheduler | node-cron | 3.x |
| Push (Web) | web-push | 3.x |
| Push (Mobile) | firebase-admin | 12.x |
| Env config | dotenv | 16.x |
| CORS | cors | 2.x |
| Security | helmet | 8.x |
| Dev runner | nodemon | 3.x |

---

## 3. Cấu trúc thư mục

```
backend/
├── src/
│   ├── app.js                 # Express app setup, mount middleware & routes
│   ├── server.js              # Entry point: dotenv → prisma → app.listen(PORT)
│   │
│   ├── config/
│   │   └── index.js           # Đọc env vars, export object config thống nhất
│   │
│   ├── middleware/
│   │   ├── auth.js            # JWT verify middleware (extract user from token)
│   │   ├── authorize.js       # Role check middleware (USER / ADMIN)
│   │   ├── validate.js        # express-validator error handler chung
│   │   ├── errorHandler.js    # Global error handler (last middleware)
│   │   └── notFound.js        # 404 handler cho route không tồn tại
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── categoryController.js
│   │   ├── taskController.js
│   │   ├── subtaskController.js
│   │   ├── reminderController.js
│   │   ├── deviceController.js
│   │   ├── notificationController.js
│   │   ├── dashboardController.js
│   │   └── adminController.js
│   │
│   ├── services/
│   │   ├── authService.js
│   │   ├── userService.js
│   │   ├── categoryService.js
│   │   ├── taskService.js
│   │   ├── subtaskService.js
│   │   ├── reminderService.js
│   │   ├── deviceService.js
│   │   ├── notificationService.js
│   │   ├── dashboardService.js
│   │   └── adminService.js
│   │
│   ├── repositories/
│   │   ├── authRepo.js
│   │   ├── userRepo.js
│   │   ├── categoryRepo.js
│   │   ├── taskRepo.js
│   │   ├── subtaskRepo.js
│   │   ├── reminderRepo.js
│   │   ├── deviceRepo.js
│   │   ├── notificationLogRepo.js
│   │   └── notificationSettingRepo.js
│   │
│   ├── dto/
│   │   ├── request/
│   │   │   ├── authValidation.js
│   │   │   ├── userValidation.js
│   │   │   ├── categoryValidation.js
│   │   │   ├── taskValidation.js
│   │   │   ├── subtaskValidation.js
│   │   │   ├── reminderValidation.js
│   │   │   ├── deviceValidation.js
│   │   │   └── notificationValidation.js
│   │   └── response/
│   │       └── apiResponse.js     # ✅ Tạo response envelope { success, message, data }
│   │
│   ├── routes/
│   │   ├── index.js               # Mount tất cả sub-routes
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── taskRoutes.js
│   │   ├── subtaskRoutes.js
│   │   ├── reminderRoutes.js
│   │   ├── deviceRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── dashboardRoutes.js
│   │   └── adminRoutes.js
│   │
│   ├── schedulers/
│   │   └── reminderScheduler.js   # node-cron job: poll SCHEDULED reminders
│   │
│   ├── notifications/
│   │   ├── notificationService.js # Dispatcher: chọn Web Push hay FCM theo platform
│   │   ├── webPushSender.js       # Gửi qua web-push library
│   │   └── fcmSender.js           # Gửi qua firebase-admin SDK
│   │
│   ├── utils/
│   │   ├── ApiError.js            # Custom error class (statusCode, message, errors)
│   │   ├── catchAsync.js          # Wrapper async route handler (try/catch)
│   │   ├── dateUtils.js           # addDays, addMinutes, calculateNextDueDate
│   │   ├── pagination.js          # Parse page/pageSize, build pagination meta
│   │   └── tokenUtils.js          # generateToken, verifyToken helpers
│   │
│   └── constants/
│       └── enums.js               # TaskStatus, Priority, RepeatType, ReminderStatus...
│
├── prisma/
│   ├── schema.prisma              # DB models, relations, indexes, enums
│   └── seed.js                    # Seed roles + admin user
│
├── .env.example                   # Template env vars
├── .gitignore
├── package.json
└── README.md
```

---

## 4. Chi tiết từng bước Implement

### Phase 1: Bootstrap Project
**Mục tiêu:** Khởi tạo project, cài dependencies, cấu hình basic.

| # | Task | Chi tiết |
|---|---|---|
| 1.1 | `npm init` trong `backend/` | name: `taskalarm-backend`, type: `module`, scripts: dev/start/seed |
| 1.2 | Cài dependencies | `npm i express prisma @prisma/client jsonwebtoken bcryptjs express-validator node-cron web-push firebase-admin dotenv cors helmet` |
| 1.3 | Cài devDependencies | `npm i -D nodemon` |
| 1.4 | Tạo `.env.example` | `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`, `FCM_PROJECT_ID`, `FCM_PRIVATE_KEY`, `FCM_CLIENT_EMAIL` |
| 1.5 | Tạo `.gitignore` | `node_modules/`, `.env`, `dist/` |
| 1.6 | Tạo `src/config/index.js` | Đọc `process.env`, export config object, validate required vars |
| 1.7 | Tạo `src/server.js` | Import dotenv → prisma disconnect on exit → `app.listen()` |
| 1.8 | Tạo `src/app.js` | `express()` → `helmet()` → `cors()` → `express.json()` → mount routes → errorHandler → notFound |
| 1.9 | Scripts trong `package.json` | `"dev": "nodemon src/server.js"`, `"start": "node src/server.js"`, `"seed": "node prisma/seed.js"` |

### Phase 2: Prisma Schema + Database
**Mục tiêu:** Định nghĩa toàn bộ DB models, enums, indexes từ ERD.

| # | Task | Chi tiết |
|---|---|---|
| 2.1 | `npx prisma init` | Tạo `prisma/schema.prisma` + `.env` với `DATABASE_URL` |
| 2.2 | Định nghĩa enums trong schema | `RoleName`, `TaskStatus`, `TaskPriority`, `RepeatType`, `ReminderStatus`, `NotificationAction`, `Platform` |
| 2.3 | Định nghĩa models | 10 models: `Role`, `User`, `PasswordResetRequest`, `Category`, `Task`, `Subtask`, `Reminder`, `Device`, `NotificationLog`, `NotificationSetting` |
| 2.4 | Thêm relations | Theo ERD: `User → Role`, `Task → User/Category/Subtask/Reminder`, `Reminder → NotificationLog`, `Device → NotificationLog`, `NotificationSetting → User` |
| 2.5 | Thêm indexes | `ix_reminders_status_remind_at` (cho scheduler), `ix_tasks_user_status_due` (cho list/filter), unique constraints trên `email`, `reset_token`, `device_token` |
| 2.6 | Thêm seed script | `prisma/seed.js`: tạo roles (USER, ADMIN), admin user default |
| 2.7 | `npx prisma db push` hoặc `npx prisma migrate dev` | Sync schema lên DB |
| 2.8 | Verify | `npx prisma studio` — kiểm tra tables, indexes, seed data |

### Phase 3: Middleware & Utils
**Mục tiêu:** Xây dựng lớp middleware chung phục vụ tất cả modules.

| # | Task | Chi tiết |
|---|---|---|
| 3.1 | `ApiError` class | `{ statusCode, message, errors }` — ném lỗi thống nhất trong service |
| 3.2 | `catchAsync` wrapper | `fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)` |
| 3.3 | `validate` middleware | Lấy kết quả `express-validator` → nếu có lỗi trả 400 `{ success: false, errors }` |
| 3.4 | `auth` middleware | Verify JWT từ `Authorization: Bearer` → attach `req.user = { id, role }` |
| 3.5 | `authorize` middleware | `authorize(...roles)` → check `req.user.role` |
| 3.6 | `errorHandler` middleware | Bắt lỗi từ `ApiError` hoặc unknown → trả JSON `{ success, message, errors }` |
| 3.4 | `notFound` middleware | Catch-all 404 cho route không match |
| 3.7 | `apiResponse` helper | `success(res, statusCode, message, data)`, `error(res, statusCode, message, errors)` |
| 3.8 | `pagination` helper | Parse `page`, `pageSize`, trả `{ skip, take, meta }` |
| 3.9 | `enums.js` constants | Export các enum值: `TASK_STATUS`, `PRIORITY`, `REPEAT_TYPE`, `REMINDER_STATUS`... |
| 3.10 | `dateUtils.js` | `addDays(date, n)`, `addMinutes(date, n)`, `calculateNextDue(dueAt, repeatType)` |

### Phase 4: Routes Structure
**Mục tiêu:** Setup routing skeleton — mount tất cả routes nhưng chưa implement logic.

| # | Task | Chi tiết |
|---|---|---|
| 4.1 | Tạo `routes/index.js` | Mount: `/auth`, `/me` (user), `/categories`, `/tasks`, `/reminders`, `/devices`, `/notification-settings`, `/notification-logs`, `/dashboard`, `/admin` |
| 4.2 | Tạo từng route file | Mỗi file export `Router()` với method stubs, placeholder controller functions |

---

## 5. Module Implementation (Sau Phase 1–4)

Sau khi bootstrap xong, implement từng module theo thứ tự ưu tiên:

| Thứ tự | Module | APIs | Ghi chú |
|---|---|---|---|
| 1 | **Auth** | register, login, forgot-password, reset-password | Bearer JWT, bcrypt hash |
| 2 | **User Profile** | GET/PUT `/me`, PUT `/me/password` | ownership check |
| 3 | **Category** | CRUD + active toggle | unique name per user (ERD-R-03) |
| 4 | **Task** | CRUD + complete/reopen/cancel | Transaction: cancel reminders, create next repeat task |
| 5 | **Subtask** | CRUD + toggle | ownership qua Task |
| 6 | **Reminder** | CRUD + due/snooze/dismiss | Max 5/task, max snooze 3, scheduler poll |
| 7 | **Device** | register/list/deactivate | Soft delete (ERD-R-16) |
| 8 | **Notification Settings** | GET/PUT | One-to-one với User |
| 9 | **Notification Logs** | GET with pagination | Read-only |
| 10 | **Dashboard** | User dashboard + Admin dashboard | Aggregate queries |
| 11 | **Admin** | User list/lock/unlock | Role check |
| 12 | **Scheduler** | node-cron reminder poll | Core feature |
| 13 | **Push Notification** | Web Push + FCM | Register device → send on trigger |

---

## 6. Environment Variables

```env
# Server
PORT=8080
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/taskalarm?schema=public"

# JWT
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRES_IN=7d

# Web Push (VAPID)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_EMAIL=mailto:admin@taskalarm.com

# Firebase Cloud Messaging
FCM_PROJECT_ID=your-firebase-project-id
FCM_PRIVATE_KEY=your-firebase-private-key
FCM_CLIENT_EMAIL=your-firebase-client-email
```

---

## 7. API Conventions

Theo `05_TaskAlarm_API_Specification.md`:

- **Prefix:** `/api/v1/`
- **Auth:** `Authorization: Bearer <JWT>` header
- **Response envelope:**
  ```json
  { "success": true, "message": "...", "data": {} }
  ```
- **Error response:**
  ```json
  { "success": false, "message": "...", "errors": { "field": "message" } }
  ```
- **Pagination:** `?page=1&pageSize=20`
- **Time format:** ISO-8601 with offset, backend stores UTC
- **HTTP Status:** 200, 201, 400, 401, 403, 404, 500

---

## 8. Validation Rules (express-validator)

| Entity | Field | Rule |
|---|---|---|
| RegisterRequest | `email` | `notEmpty().isEmail()` |
| RegisterRequest | `password` | `notEmpty().isLength({ min: 6, max: 50 })` |
| TaskRequest | `title` | `notEmpty().isLength({ max: 255 })` |
| TaskRequest | `dueAt` | `notEmpty().isISO8601()` |
| TaskRequest | `priority` | `notEmpty().isIn(['LOW','MEDIUM','HIGH','URGENT'])` |
| TaskRequest | `repeatType` | `isIn(['NONE','DAILY','WEEKLY','MONTHLY'])` |
| ReminderRequest | `remindAt` | `notEmpty().isISO8601()` + service layer `<= task.dueAt` |
| CategoryRequest | `categoryName` | `notEmpty().isLength({ max: 100 })` |
| DeviceRequest | `deviceToken` | `notEmpty()` |
| DeviceRequest | `platform` | `notEmpty().isIn(['WEB','ANDROID','IOS'])` |

---

## 9. Business Rules quan trọng cần implement ở Service Layer

| ID | Rule | Implement |
|---|---|---|
| BR-09 | Tối đa 5 reminders/task | Check count trước khi thêm |
| BR-10 | `remindAt <= dueAt` | Validate trong service (cần query task) |
| BR-11 | Hoàn thành/hủy task → cancel reminders | Transaction: update task status + cancel reminders |
| BR-13 | Snooze tối đa 3 lần | Check `snooze_count < 3` trước khi snooze |
| BR-15 | Task repeat → tự sinh task mới | Khi complete: tạo task mới + copy reminders với dueAt mới |
| ERD-R-03 | Category name unique per user | Unique compound index hoặc check trong service |
| ERD-R-13 | Cancel reminders khi task complete/cancel | Trong cùng transaction |
| ERD-R-14 | Tạo task mới khi repeat task complete | Trong cùng transaction |
| ERD-R-18 | Không hard delete task/reminder/log | Soft delete hoặc check notification_logs trước khi xóa |

---

## 10. Acceptance Criteria

Phase 1–4 hoàn thành khi:

- [ ] `npm run dev` chạy không lỗi, server listen trên PORT
- [ ] `npx prisma db push` sync schema thành công
- [ ] `npx prisma studio` hiển thị đúng 10 tables + indexes
- [ ] Seed roles + admin user hoạt động (`npm run seed`)
- [ ] `GET /api/v1/health` trả `{ status: "ok" }`
- [ ] Tất cả routes được mount đúng (trả 404 cho endpoint chưa implement)
- [ ] Auth middleware hoạt động (test với mock JWT)
- [ ] Error handler trả đúng response envelope
