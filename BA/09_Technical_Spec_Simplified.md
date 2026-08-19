# Technical Spec – TaskAlarm (Đồ án Sinh viên CNTT)

> **Phiên bản:** Đơn giản hóa cho đồ án năm 3
> **Mục tiêu:** Backend REST API phục vụ ứng dụng quản lý công việc với nhắc nhở kiểu báo thức
> **Nguyên tắc:** Layered Architecture (Route → Controller → Service → Prisma), không over-engineering

---

## 1. Tổng quan

TaskAlarm là ứng dụng quản lý thời gian cá nhân trên **Website** và **Mobile App**, dùng chung một REST API Backend. Điểm khác biệt: cơ chế **nhắc nhở kiểu báo thức** — khi đến giờ hẹn, hệ thống gửi Push Notification kèm âm thanh, buộc người dùng chọn **Hoãn (Snooze)** hoặc **Tắt (Dismiss)**.

### 1.1. Kiến trúc tổng thể

```
┌─────────────────┐     ┌─────────────────┐
│  Website (SPA)  │     │Mobile App(Dự tính)│
│  React + Vite   │     │  React Native   │
└────────┬────────┘     └────────┬────────┘
         │  REST API + JWT       │
         └──────────┬────────────┘
                    ▼
         ┌─────────────────────┐
         │   Backend (Node.js) │
         │   Express + Prisma  │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │PostgreSQL(Supabase) │
         └─────────────────────┘
```

### 1.2. Tech Stack

| Thành phần | Library | Lý do chọn |
|---|---|---|
| Runtime | Node.js 20+ LTS | Yeah node |
| Framework | Express.js 4.x | Phổ biến, tài liệu nhiều |
| ORM | Prisma 6.x | Type-safe, tự generate CRUD |
| Auth | jsonwebtoken + bcryptjs | JWT chuẩn ngành, bcrypt hash mật khẩu |
| Validation | express-validator 7.x | Validate request đơn giản |
| Scheduler | node-cron 3.x | Cron job nhẹ nhàng, không cần Redis |
| Push (Web) | web-push 3.x | Web Push chuẩn qua VAPID |
| Push (Mobile) | firebase-admin 12.x | FCM miễn phí cho Android/iOS |
| Env config | dotenv 16.x | Đọc biến môi trường |

---

## 2. Cấu trúc thư mục

```
backend/
├── src/
│   ├── app.js                 # Express app: middleware + mount routes
│   ├── server.js              # Entry point: dotenv → prisma → listen
│   │
│   ├── config/
│   │   └── index.js           # Đọc env vars, export config object
│   │
│   ├── middleware/
│   │   ├── auth.js            # JWT verify → attach req.user
│   │   ├── authorize.js       # Role check (USER / ADMIN)
│   │   ├── validate.js        # express-validator error handler
│   │   ├── errorHandler.js    # Global error → JSON response
│   │   └── notFound.js        # 404 catch-all
│   │
│   ├── controllers/           # Nhận req → gọi service → trả res
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── categoryController.js
│   │   ├── taskController.js
│   │   ├── subtaskController.js
│   │   ├── reminderController.js
│   │   ├── deviceController.js
│   │   ├── dashboardController.js
│   │   └── adminController.js
│   │
│   ├── services/              # Business logic thuần
│   │   ├── authService.js
│   │   ├── userService.js
│   │   ├── categoryService.js
│   │   ├── taskService.js
│   │   ├── subtaskService.js
│   │   ├── reminderService.js
│   │   ├── deviceService.js
│   │   ├── dashboardService.js
│   │   └── adminService.js
│   │
│   ├── repositories/          # Prisma Client queries
│   │   ├── authRepo.js
│   │   ├── userRepo.js
│   │   ├── categoryRepo.js
│   │   ├── taskRepo.js
│   │   ├── subtaskRepo.js
│   │   ├── reminderRepo.js
│   │   ├── deviceRepo.js
│   │   └── notificationRepo.js
│   │
│   ├── routes/                # Mount tất cả sub-routes
│   │   ├── index.js
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── taskRoutes.js
│   │   ├── reminderRoutes.js
│   │   ├── deviceRoutes.js
│   │   ├── dashboardRoutes.js
│   │   └── adminRoutes.js
│   │
│   ├── schedulers/
│   │   └── reminderScheduler.js   # node-cron: quét mỗi 1 phút
│   │
│   ├── notifications/
│   │   ├── webPushSender.js       # Gửi Web Push (VAPID)
│   │   └── fcmSender.js           # Gửi FCM (firebase-admin)
│   │
│   ├── dto/
│   │   ├── request/               # Validation rules (express-validator)
│   │   │   ├── authValidation.js
│   │   │   ├── taskValidation.js
│   │   │   └── ...
│   │   └── response/
│   │       └── apiResponse.js     # { success, message, data }
│   │
│   ├── utils/
│   │   ├── ApiError.js            # Custom error (statusCode, message)
│   │   ├── catchAsync.js          # async wrapper (try/catch)
│   │   ├── dateUtils.js           # addDays, addWeeks, addMonths
│   │   └── pagination.js          # Parse page/pageSize
│   │
│   └── constants/
│       └── enums.js               # TaskStatus, Priority, RepeatType...
│
├── prisma/
│   ├── schema.prisma              # DB models + relations + indexes
│   └── seed.js                    # Seed roles + admin user
│
├── .env.example
├── package.json
└── README.md
```

---

## 3. Database Schema (Prisma)

> Giữ nguyên ERD gốc, chỉ thêm bảng `RefreshToken` cho cơ chế Auth mới.

### 3.1. Enums

```prisma
enum RoleName         { USER  ADMIN }
enum TaskStatus       { TODO  IN_PROGRESS  COMPLETED  CANCELLED }
enum TaskPriority     { LOW  MEDIUM  HIGH  URGENT }
enum RepeatType       { NONE  DAILY  WEEKLY  MONTHLY }
enum ReminderStatus   { SCHEDULED  TRIGGERED  SNOOZED  DISMISSED  CANCELLED }
enum NotificationAction { SENT  SNOOZED  DISMISSED }
enum Platform         { WEB  ANDROID  IOS }
```

### 3.2. Models (tóm tắt)

| Model | Mô tả | Quan hệ chính |
|---|---|---|
| `Role` | Vai trò USER/ADMIN | → User |
| `User` | Tài khoản người dùng | → Role, Category, Task, Device, NotificationSetting |
| `PasswordResetRequest` | Yêu cầu reset password | → User |
| `Category` | Danh mục công việc (unique name per user) | → User, Task |
| `Task` | Công việc (tự tham chiếu qua parentTaskId cho repeat) | → User, Category, Subtask, Reminder |
| `Subtask` | Việc con (checklist) | → Task |
| `Reminder` | Thời điểm nhắc nhở | → Task, NotificationLog |
| `Device` | Thiết bị nhận Push (soft delete bằng isActive) | → User, NotificationLog |
| `NotificationLog` | Lịch sử gửi thông báo | → Reminder, Device |
| `NotificationSetting` | Cài đặt thông báo cá nhân (1-1 User) | → User |
| **`RefreshToken`** | **Phiên đăng nhập** | **→ User** |

### 3.3. Bảng RefreshToken (mới)

```prisma
model RefreshToken {
  tokenId   Int      @id @default(autoincrement()) @map("token_id")
  userId    Int      @map("user_id")
  token     String   @unique @db.VarChar(500)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [userId])

  @@index([userId])
  @@map("refresh_tokens")
}
```

### 3.4. Indexes quan trọng

```prisma
// Cho Reminder Scheduler: quét nhanh reminder đến hạn
@@index([status, remindAt], map: "ix_reminders_status_remind_at")

// Cho Task list: filter theo user + due date
@@index([userId, dueAt], map: "ix_tasks_user_due")

// Cho Category: unique name per user
@@unique([userId, categoryName])
```

---

## 4. Authentication – AccessToken + RefreshToken

### 4.1. Nguyên lý

```
┌─────────────────────────────────────────────────────┐
│  Client (Web/Mobile)                                │
│                                                     │
│  AccessToken  (JWT)  ── hết hạn 1 giờ ──→ hết hiệu lực │
│  RefreshToken (string) ── hết hạn 7 ngày ──→ hết hiệu lực │
└─────────────────────────────────────────────────────┘
         │                        │
         │ Authorization:         │ POST /auth/refresh-token
         │ Bearer <accessToken>   │ body: { refreshToken }
         ▼                        ▼
┌──────────────────────────────────────────────────────┐
│  Backend                                            │
│                                                      │
│  1. Verify accessToken (jwt.verify)                  │
│     → Hết hạn? → Trả 401                            │
│     → OK? → proceed                                  │
│                                                      │
│  2. Verify refreshToken (查 DB)                       │
│     → Không tìm thấy / hết hạn? → Trả 401            │
│     → OK? → cấp lại accessToken mới                  │
│                                                      │
│  3. Khi đổi mật khẩu / logout                        │
│     → Xóa refreshToken trong DB → phiên bị hủy       │
└──────────────────────────────────────────────────────┘
```

### 4.2. Flow chi tiết

| Khi nào | Xử lý |
|---|---|
| **Đăng nhập** | Tạo AccessToken (JWT, hết hạn **1 giờ**) + Lưu RefreshToken vào DB (hết hạn **7 ngày**) |
| **Access hết hạn** | Client gửi refreshToken → Backend kiểm tra DB → cấp accessToken mới |
| **Đổi mật khẩu** | Xóa **tất cả** RefreshToken của user → mọi phiên cũ bị hủy |
| **Logout** | Xóa RefreshToken hiện tại trong DB |

### 4.3. Pseudocode – AuthService

```js
// ─── Đăng nhập ───────────────────────────────────────
async login(email, password) {
  const user = await userRepo.findByEmail(email);
  if (!user || !await bcrypt.compare(password, user.passwordHash))
    throw ApiError.badRequest('Email hoặc mật khẩu không đúng');
  if (!user.isActive)
    throw ApiError.forbidden('Tài khoản đã bị khóa');

  // Tạo AccessToken (JWT, 1 giờ)
  const accessToken = jwt.sign(
    { id: user.userId, role: user.roleName },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Tạo RefreshToken (chuỗi ngẫu nhiên, lưu DB)
  const refreshToken = crypto.randomBytes(40).toString('hex');
  await authRepo.saveRefreshToken(user.userId, refreshToken, 7); // 7 ngày

  return { accessToken, refreshToken, user: { ... } };
}

// ─── Làm mới AccessToken ─────────────────────────────
async refreshAccessToken(refreshToken) {
  const record = await authRepo.findRefreshToken(refreshToken);
  if (!record || record.expiresAt < new Date())
    throw ApiError.unauthorized('RefreshToken không hợp lệ hoặc đã hết hạn');

  const user = await userRepo.findById(record.userId);
  const accessToken = jwt.sign(
    { id: user.userId, role: user.roleName },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { accessToken };
}

// ─── Logout / Đổi mật khẩu ──────────────────────────
async logout(userId) {
  await authRepo.deleteRefreshTokens(userId); // Xóa tất cả refresh token
}

async changePassword(userId, currentPassword, newPassword) {
  const user = await userRepo.findById(userId);
  if (!await bcrypt.compare(currentPassword, user.passwordHash))
    throw ApiError.badRequest('Mật khẩu hiện tại không đúng');

  const newHash = await bcrypt.hash(newPassword, 10);
  await userRepo.updatePassword(userId, newHash);
  await authRepo.deleteRefreshTokens(userId); // Hủy phiên
}
```

---

## 5. API Endpoints

> Prefix: `/api/v1/` | Auth: `Authorization: Bearer <JWT>` | Response envelope: `{ success, message, data }`

### 5.1. Authentication

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | Public | Đăng ký tài khoản mới |
| POST | `/auth/login` | Public | Đăng nhập → trả accessToken + refreshToken |
| POST | `/auth/refresh-token` | Public | Cấp lại accessToken mới từ refreshToken |
| POST | `/auth/forgot-password` | Public | Gửi reset token |
| POST | `/auth/reset-password` | Public | Đặt lại mật khẩu bằng reset token |

### 5.2. User Profile

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/me` | User | Lấy hồ sơ |
| PUT | `/me` | User | Cập nhật fullName, phoneNumber |
| PUT | `/me/password` | User | Đổi mật khẩu (xóa refresh token) |

### 5.3. Categories

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/categories` | User | Danh sách (query: isActive) |
| POST | `/categories` | User | Tạo mới |
| PUT | `/categories/{categoryId}` | User | Cập nhật tên/màu |
| PATCH | `/categories/{categoryId}/active` | User | Ẩn/hiện (soft toggle) |

### 5.4. Tasks (Core)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/tasks` | User | Danh sách (filter, sort, paginate) |
| POST | `/tasks` | User | Tạo mới + reminders (transaction) |
| GET | `/tasks/{taskId}` | User | Chi tiết (subtasks, reminders) |
| PUT | `/tasks/{taskId}` | User | Cập nhật |
| DELETE | `/tasks/{taskId}` | User | Xóa (chỉ khi chưa có notification log) |
| POST | `/tasks/{taskId}/complete` | User | Hoàn thành + sinh task repeat |
| POST | `/tasks/{taskId}/reopen` | User | Mở lại |
| POST | `/tasks/{taskId}/cancel` | User | Hủy + cancel reminders |

### 5.5. Subtasks

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/tasks/{taskId}/subtasks` | User | Danh sách việc con |
| POST | `/tasks/{taskId}/subtasks` | User | Thêm việc con |
| PUT | `/tasks/{taskId}/subtasks/{subtaskId}` | User | Sửa nội dung |
| POST | `/tasks/{taskId}/subtasks/{subtaskId}/toggle` | User | Toggle hoàn thành |
| DELETE | `/tasks/{taskId}/subtasks/{subtaskId}` | User | Xóa việc con |

### 5.6. Reminders

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/tasks/{taskId}/reminders` | User | Danh sách nhắc nhở |
| POST | `/tasks/{taskId}/reminders` | User | Thêm nhắc nhở (max 5/task) |
| PUT | `/tasks/{taskId}/reminders/{reminderId}` | User | Sửa (chỉ SCHEDULED) |
| DELETE | `/tasks/{taskId}/reminders/{reminderId}` | User | Xóa (chỉ chưa trigger) |
| GET | `/reminders/due` | User | Reminder đến hạn (polling dự phòng) |
| GET | `/reminders/{reminderId}` | User | Chi tiết + task info |
| POST | `/reminders/{reminderId}/snooze` | User | Hoãn (max 3 lần) |
| POST | `/reminders/{reminderId}/dismiss` | User | Tắt hẳn |

### 5.7. Devices & Notification

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/devices` | User | Đăng ký thiết bị |
| GET | `/devices` | User | Danh sách active |
| DELETE | `/devices/{deviceId}` | User | Gỡ (soft delete) |
| GET | `/notification-settings` | User | Lấy cài đặt |
| PUT | `/notification-settings` | User | Cập nhật |
| GET | `/notification-logs` | User | Lịch sử (paginate) |

### 5.8. Dashboard & Admin

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/dashboard` | User | todayCount, overdueCount, completedCount |
| GET | `/admin/dashboard` | Admin | Tổng users, tasks, notifications hôm nay |
| GET | `/admin/users` | Admin | Danh sách user (search, paginate) |
| POST | `/admin/users/{userId}/lock` | Admin | Khóa tài khoản |
| POST | `/admin/users/{userId}/unlock` | Admin | Mở khóa |

---

## 6. Pseudocode – Service Layer

### 6.1. TaskService

```js
import prisma from '../config/prisma.js';

// ─── Tạo Task + Reminders (transaction) ──────────────
async create(userId, taskData) {
  const { title, description, categoryId, priority, dueAt, repeatType, reminders } = taskData;

  // Validate: remindAt <= dueAt cho mỗi reminder
  for (const r of reminders || []) {
    if (new Date(r.remindAt) > new Date(dueAt))
      throw ApiError.badRequest('remindAt phải <= dueAt');
  }

  // Validate: max 5 reminders
  if (reminders?.length > 5)
    throw ApiError.badRequest('Tối đa 5 nhắc nhở/task');

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: { userId, title, description, categoryId, priority, dueAt, repeatType }
    });

    let savedReminders = [];
    if (reminders?.length) {
      savedReminders = await tx.reminder.createMany({
        data: reminders.map(r => ({
          taskId: task.taskId,
          remindAt: r.remindAt,
          status: 'SCHEDULED'
        }))
      });
    }

    return { task, reminders: savedReminders };
  });
}

// ─── Hoàn thành Task + Repeat Logic ──────────────────
async complete(userId, taskId) {
  const task = await taskRepo.findById(taskId);
  if (!task) throw ApiError.notFound();
  if (task.userId !== userId) throw ApiError.forbidden();
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED')
    throw ApiError.badRequest('Task đã kết thúc');

  return prisma.$transaction(async (tx) => {
    // 1. Đánh dấu hoàn thành
    await tx.task.update({
      where: { taskId },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    // 2. Hủy tất cả reminder chưa kích hoạt
    await tx.reminder.updateMany({
      where: { taskId, status: { in: ['SCHEDULED', 'TRIGGERED'] } },
      data: { status: 'CANCELLED' }
    });

    // 3. Sinh task repeat kế tiếp (nếu có)
    let nextTask = null;
    if (task.repeatType !== 'NONE') {
      const nextDueAt = calculateNextDue(task.dueAt, task.repeatType);
      nextTask = await tx.task.create({
        data: {
          userId, categoryId: task.categoryId,
          title: task.title, description: task.description,
          priority: task.priority, repeatType: task.repeatType,
          dueAt: nextDueAt, parentTaskId: taskId
        }
      });

      // Copy reminders sang task mới
      const oldReminders = await tx.reminder.findMany({
        where: { taskId, status: 'CANCELLED' } // những reminder đã bị hủy ở bước 2
      });
      if (oldReminders.length) {
        await tx.reminder.createMany({
          data: oldReminders.map(r => ({
            taskId: nextTask.taskId,
            remindAt: adjustRemindAt(r.remindAt, task.dueAt, nextDueAt),
            status: 'SCHEDULED'
          }))
        });
      }
    }

    return { completedTask: task, nextTask };
  });
}

// ─── Hủy Task ────────────────────────────────────────
async cancel(userId, taskId) {
  const task = await taskRepo.findById(taskId);
  if (!task || task.userId !== userId) throw ApiError.notFound();

  return prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { taskId }, data: { status: 'CANCELLED' }
    });
    await tx.reminder.updateMany({
      where: { taskId, status: { in: ['SCHEDULED', 'TRIGGERED'] } },
      data: { status: 'CANCELLED' }
    });
  });
}
```

### 6.2. Tính ngày Task Repeat kế tiếp

```js
// utils/dateUtils.js
function calculateNextDue(dueAt, repeatType) {
  const now = new Date();
  const due = new Date(dueAt);

  // nextDueAt = max(dueAt_cũ, now) + interval
  const base = due > now ? due : now;

  switch (repeatType) {
    case 'DAILY':   return addDays(base, 1);
    case 'WEEKLY':  return addDays(base, 7);
    case 'MONTHLY': return addMonths(base, 1);
    default:        return base;
  }
}

function adjustRemindAt(oldRemindAt, oldDueAt, newDueAt) {
  // Giữ nguyên khoảng cách giữa remindAt và dueAt
  const diff = new Date(oldDueAt) - new Date(oldRemindAt);
  return new Date(new Date(newDueAt).getTime() - diff);
}
```

### 6.3. ReminderService (Snooze / Dismiss)

```js
async snooze(userId, reminderId, snoozeMinutes) {
  const reminder = await reminderRepo.findByIdWithTask(reminderId);
  if (!reminder) throw ApiError.notFound();
  if (reminder.task.userId !== userId) throw ApiError.forbidden();
  if (!['TRIGGERED', 'SNOOZED'].includes(reminder.status))
    throw ApiError.badRequest('Chỉ hoãn được nhắc nhở đang kêu');
  if (reminder.snoozeCount >= 3)
    throw ApiError.badRequest('Đã hoãn tối đa 3 lần');

  const newRemindAt = addMinutes(new Date(), snoozeMinutes || 5);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.reminder.update({
      where: { reminderId },
      data: {
        remindAt: newRemindAt,
        status: 'SCHEDULED',
        snoozeCount: { increment: 1 }
      }
    });

    await tx.notificationLog.create({
      data: { reminderId, action: 'SNOOZED' }
    });

    return updated;
  });
}

async dismiss(userId, reminderId) {
  const reminder = await reminderRepo.findByIdWithTask(reminderId);
  if (!reminder) throw ApiError.notFound();
  if (reminder.task.userId !== userId) throw ApiError.forbidden();

  return prisma.$transaction(async (tx) => {
    await tx.reminder.update({
      where: { reminderId },
      data: { status: 'DISMISSED' }
    });
    await tx.notificationLog.create({
      data: { reminderId, action: 'DISMISSED' }
    });
  });
}
```

### 6.4. DashboardService

```js
async getDashboard(userId) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  // Dùng Promise.all chạy song song 4 query đếm
  const [todayCount, overdueCount, completedCount, upcomingCount] =
    await Promise.all([
      // Task hôm nay (đến hạn hôm nay, chưa xong)
      prisma.task.count({
        where: {
          userId,
          dueAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['TODO', 'IN_PROGRESS'] }
        }
      }),
      // Task quá hạn (đến hạn < now, chưa xong)
      prisma.task.count({
        where: {
          userId,
          dueAt: { lt: now },
          status: { in: ['TODO', 'IN_PROGRESS'] }
        }
      }),
      // Task đã hoàn thành
      prisma.task.count({
        where: { userId, status: 'COMPLETED' }
      }),
      // Task sắp tới (đến hạn > now, chưa xong)
      prisma.task.count({
        where: {
          userId,
          dueAt: { gt: now },
          status: { in: ['TODO', 'IN_PROGRESS'] }
        }
      })
    ]);

  return { todayCount, overdueCount, completedCount, upcomingCount };
}
```

---

## 7. Reminder Scheduler (node-cron)

> Chạy mỗi **1 phút**一次, quét DB tìm Reminder đến hạn → Gửi Push → Cập nhật status.

### 7.1. Pseudocode

```js
// schedulers/reminderScheduler.js
import cron from 'node-cron';
import prisma from '../config/prisma.js';
import { sendPushNotification } from '../notifications/webPushSender.js';
import { sendFcmNotification } from '../notifications/fcmSender.js';

// Chạy mỗi 1 phút
cron.schedule('*/1 * * * *', async () => {
  console.log(`[Scheduler] Quét reminders lúc ${new Date().toISOString()}`);

  const now = new Date();

  try {
    // Tìm tất cả reminder SCHEDULED đã đến hạn
    const dueReminders = await prisma.reminder.findMany({
      where: {
        status: 'SCHEDULED',
        remindAt: { lte: now }
      },
      include: {
        task: {
          include: {
            user: {
              include: {
                devices: { where: { isActive: true } }
              }
            }
          }
        }
      }
    });

    for (const reminder of dueReminders) {
      try {
        // 1. Đánh dấu TRIGGERED
        await prisma.reminder.update({
          where: { reminderId: reminder.reminderId },
          data: { status: 'TRIGGERED' }
        });

        // 2. Gửi Push đến từng device
        const payload = {
          title: `⏰ ${reminder.task.title}`,
          body: `Đến giờ làm: ${reminder.task.title}`,
          taskId: reminder.task.taskId,
          reminderId: reminder.reminderId
        };

        for (const device of reminder.task.user.devices) {
          try {
            if (device.platform === 'WEB') {
              await sendPushNotification(device.deviceToken, payload);
            } else {
              await sendFcmNotification(device.deviceToken, payload);
            }

            // 3. Ghi log
            await prisma.notificationLog.create({
              data: {
                reminderId: reminder.reminderId,
                deviceId: device.deviceId,
                action: 'SENT'
              }
            });
          } catch (err) {
            console.error(`[Scheduler] Lỗi gửi device ${device.deviceId}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`[Scheduler] Lỗi xử lý reminder ${reminder.reminderId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Lỗi quét reminders:', err);
  }
});
```

### 7.2. Khởi động Scheduler

```js
// src/server.js
import app from './app.js';
import './schedulers/reminderScheduler.js';  // Import để cron chạy

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server chạy trên port ${PORT}`);
  console.log('Reminder Scheduler đã khởi động (mỗi 1 phút)');
});
```

---

## 8. Pseudocode – Controller Layer

> Controller **chỉ** nhận request, gọi service, trả response. **Không** chứa business logic.

```js
// controllers/taskController.js
import catchAsync from '../utils/catchAsync.js';
import * as taskService from '../services/taskService.js';
import { success } from '../dto/response/apiResponse.js';

// Tạo task
export const createTask = catchAsync(async (req, res) => {
  const task = await taskService.create(req.user.id, req.body);
  success(res, 201, 'Tạo công việc thành công', task);
});

// Danh sách task (filter + paginate)
export const getTasks = catchAsync(async (req, res) => {
  const { status, priority, categoryId, keyword, dueFrom, dueTo, page, pageSize, sort } = req.query;
  const result = await taskService.findAll(req.user.id, {
    status, priority, categoryId, keyword, dueFrom, dueTo, page, pageSize, sort
  });
  success(res, 200, 'Thao tác thành công', result);
});

// Hoàn thành task
export const completeTask = catchAsync(async (req, res) => {
  const result = await taskService.complete(req.user.id, parseInt(req.params.taskId));
  success(res, 200, 'Đã hoàn thành công việc', result);
});
```

```js
// controllers/authController.js
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  success(res, 200, 'Đăng nhập thành công', result);
});

export const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshAccessToken(refreshToken);
  success(res, 200, 'Làm mới token thành công', result);
});
```

---

## 9. Middleware quan trọng

```js
// middleware/auth.js – JWT Verify
import jwt from 'jsonwebtoken';

export default (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token hết hạn hoặc không hợp lệ' });
  }
};
```

```js
// middleware/authorize.js – Role Check
export default (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
  next();
};
```

---

## 10. Business Rules quan trọng

| ID | Rule | Implement ở đâu |
|---|---|---|
| BR-09 | Tối đa **5 reminders/task** | TaskService.create() – validate trước khi insert |
| BR-10 | `remindAt <= dueAt` | TaskService.create() – validate trong loop |
| BR-11 | Task hoàn thành/hủy → cancel reminders | TaskService.complete()/cancel() – trong $transaction |
| BR-13 | Snooze tối đa **3 lần** | ReminderService.snooze() – check snoozeCount |
| BR-15 | Task repeat → tự sinh task mới | TaskService.complete() – calculateNextDue() |
| ERD-R-03 | Category name unique per user | Prisma @@unique([userId, categoryName]) |
| ERD-R-13 | Cancel reminders khi task kết thúc | TaskService – trong $transaction |
| ERD-R-14 | Tạo task mới khi repeat | TaskService.complete() – trong $transaction |

---

## 11. Ước tính thời gian thực hiện

| # | Module | Nội dung | Thời gian |
|---|---|---|---|
| 1 | **Bootstrap** | Init project, cài deps, setup middleware, utils, routes skeleton | 1 giờ |
| 2 | **Prisma Schema** | Viết schema + seed data + verify | 0.5 giờ |
| 3 | **Auth** | Register, Login, RefreshToken, ForgotPassword, ResetPassword | 2 giờ |
| 4 | **User Profile** | Get/Update profile, Change password | 0.5 giờ |
| 5 | **Categories** | CRUD + toggle active | 0.5 giờ |
| 6 | **Tasks** | CRUD + Complete + Repeat logic + Cancel | 2.5 giờ |
| 7 | **Subtasks** | CRUD + Toggle | 0.5 giờ |
| 8 | **Reminders** | CRUD + Snooze + Dismiss + Due | 1.5 giờ |
| 9 | **Devices & Notifications** | Register, Push (Web + Mobile) | 1 giờ |
| 10 | **Dashboard & Admin** | User dashboard + Admin CRUD | 0.5 giờ |
| 11 | **Scheduler** | Reminder Scheduler (node-cron) | 0.5 giờ |
| 12 | **Test & Fix** | Postman test các flow chính + fix bug | 1.5 giờ |
| | **Tổng cộng** | | **~12 giờ** |

### Phân bổ theo tuần (nếu làm 3 tiếng/ngày)

| Tuần | Nhiệm vụ | Giờ |
|---|---|---|
| Tuần 1 | Bootstrap + Prisma + Auth + User Profile + Categories | 4.5 giờ |
| Tuần 2 | Tasks + Subtasks + Reminders | 4.5 giờ |
| Tuần 3 | Devices + Dashboard + Admin + Scheduler + Test | 3.5 giờ |

---

## 12. Environment Variables

```env
# Server
PORT=8080
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/taskalarm?schema=public"

# JWT
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRES_IN=1h

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

## 13. Response Format chuẩn

```json
// Thành công
{
  "success": true,
  "message": "Tạo công việc thành công",
  "data": { ... }
}

// Lỗi
{
  "success": false,
  "message": "Thông tin đầu vào không hợp lệ",
  "errors": { "title": "Tiêu đề không được để trống" }
}

// Phân trang
{
  "success": true,
  "message": "Thao tác thành công",
  "data": {
    "items": [...],
    "pagination": { "page": 1, "pageSize": 20, "total": 45, "totalPages": 3 }
  }
}
```

---

## 14. Lưu ý khi bảo vệ đồ án

### Câu hỏi thường gặp từ hội đồng:

1. **"Tại sao dùng RefreshToken?"**
   → AccessToken hết hạn sau 1 giờ để giảm rủi ro khi bị đánh cắp. RefreshToken lưu trong DB, khi logout/đổi mật khẩu thì xóa trong DB → phiên bị hủy ngay lập tức.

2. **"Tại sao dùng node-cron thay vì Redis/BullMQ?"**
   → Quy mô đồ án chỉ cần 1 server instance, node-cron polling mỗi 1 phút là đủ đảm bảo nhắc nhở đúng giờ. Redis/BullMQ phù hợp hệ thống phân tán nhiều server — over-engineering cho đồ án.

3. **"Task Repeat hoạt động như thế nào?"**
   → Khi User đánh dấu hoàn thành task có repeatType != NONE, hệ thống tự tạo task mới với `dueAt = max(dueAt_cũ, now) + interval`, copy reminders, link về task gốc qua `parentTaskId`.

4. **"Tại sao dùng Prisma Transaction?"**
   → Đảm bảo atomic: nếu tạo task thành công nhưng tạo reminder thất bại, cả hai rollback. Tránh data không nhất quán.

5. **"Dashboard lấy dữ liệu bằng cách nào?"**
   → Dùng `Promise.all` chứa 4 câu `prisma.task.count()` chạy song song, mỗi câu đếm 1 loại task (hôm nay/quá hạn/hoàn thành/sắp tới). Hiệu quả hơn query SQL phức tạp.

### Demo flow khi bảo vệ:

1. **Đăng nhập** → Nhận accessToken + refreshToken
2. **Tạo task + reminders** → Verify transaction trong DB
3. **Chờ 1 phút** → Scheduler quét → Push notification đến
4. **Snooze/Dismiss** → Verify reminder status thay đổi trong DB
5. **Hoàn thành task repeat** → Verify task mới được tạo tự động
6. **Xem dashboard** → Verify 4 con số hiển thị đúng

---

## 15._so_sánh_trước_và_sau_refactor

| Yêu cầu | Trước (Production-grade) | Sau (Sinh viên) |
|---|---|---|
| Auth | JWT stateless thuần | AccessToken (JWT 1h) + RefreshToken (lưu DB) |
| Queue | Redis + BullMQ | ❌ BỎ — không cần |
| Scheduler | node-cron 5 giây + transaction locking | node-cron **1 phút**, đơn giản |
| Task Repeat | Complex RRULE logic | `calculateNextDue()` bằng JS thuần |
| Dashboard | Raw SQL `COUNT(*) FILTER` | `prisma.task.count()` × 4 |
| Transaction | Phức tạp với retry/locking | `prisma.$transaction` đơn giản |
| Response format | Production envelope | Giữ nguyên envelope chuẩn |
| Estimated effort | ~40+ giờ | **~12 giờ** |
