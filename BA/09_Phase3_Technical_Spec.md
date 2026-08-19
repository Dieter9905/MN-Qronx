# Phase 3 – Technical Spec: Business Modules

## Tổng quan

Triển khai từng module nghiệp vụ theo thứ tự ưu tiên. Mỗi module có đủ:
- **Routes** – URL mapping, HTTP methods, middleware chain
- **Validation** – express-validator rules (request body / params / query)
- **Controller** – nhận request, gọi service, trả response
- **Service** – business logic, transaction, validation nghiệp vụ
- **Repository** – Prisma queries
- **Swagger docs** – annotation cho Swagger UI

---

## Module 1: Authentication

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Đăng ký User mới |
| POST | `/api/v1/auth/login` | Public | Đăng nhập, trả JWT |
| POST | `/api/v1/auth/forgot-password` | Public | Gửi reset token qua email |
| POST | `/api/v1/auth/reset-password` | Public | Đặt lại mật khẩu |

### Files

```
backend/src/
├── routes/authRoutes.js
├── controllers/authController.js
├── services/authService.js
├── repositories/authRepo.js
└── dto/request/authValidation.js
```

### Validation Rules

```js
// authValidation.js
register: [
  body('fullName').notEmpty().withMessage('Họ tên không được để trống')
    .isLength({ max: 150 }),
  body('email').notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ'),
  body('password').notEmpty().withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6, max: 50 }).withMessage('Mật khẩu phải từ 6-50 ký tự'),
]

login: [
  body('email').notEmpty().isEmail(),
  body('password').notEmpty(),
]

forgotPassword: [
  body('email').notEmpty().isEmail(),
]

resetPassword: [
  body('resetToken').notEmpty(),
  body('newPassword').notEmpty().isLength({ min: 6, max: 50 }),
]
```

### Service Logic

```
register(fullName, email, password):
  1. Check email unique (repo.findByEmail)
  2. Hash password (bcrypt.hash, salt=10)
  3. Create user (repo.create → role = USER)
  4. Auto-create NotificationSetting cho user mới
  5. Return { userId, fullName, email }

login(email, password):
  1. Find user by email (repo.findByEmail, include role)
  2. If not found → 400 "Email hoặc mật khẩu không đúng"
  3. If !isActive → 403 "Tài khoản đã bị khóa"
  4. Compare password (bcrypt.compare)
  5. Generate JWT (jsonwebtoken) chứa { id, role }
  6. Return { accessToken, user: { userId, fullName, email, role } }

forgotPassword(email):
  1. Find user by email
  2. If not found → return success (không reveal)
  3. Generate resetToken (crypto.randomBytes(32).toString('hex'))
  4. Save PasswordResetRequest (expiresAt = now + 1h)
  5. (Phase sau: gửi email qua nodemailer)

resetPassword(resetToken, newPassword):
  1. Find PasswordResetRequest by token
  2. Check: exists, not expired, not used
  3. Hash new password
  4. Update user.passwordHash
  5. Mark resetRequest.usedAt = now
  6. Return success
```

### Response Examples

```json
// POST /auth/login - 200
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "userId": 1,
      "fullName": "Nguyễn Văn Minh",
      "email": "minh@example.com",
      "role": "USER"
    }
  }
}
```

---

## Module 2: User Profile

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/me` | User | Lấy hồ sơ |
| PUT | `/api/v1/me` | User | Cập nhật fullName, phoneNumber |
| PUT | `/api/v1/me/password` | User | Đổi mật khẩu |

### Files

```
├── routes/userRoutes.js
├── controllers/userController.js
├── services/userService.js
├── repositories/userRepo.js
└── dto/request/userValidation.js
```

### Validation

```js
updateProfile: [
  body('fullName').optional().notEmpty().isLength({ max: 150 }),
  body('phoneNumber').optional().isLength({ max: 20 }),
]

changePassword: [
  body('currentPassword').notEmpty(),
  body('newPassword').notEmpty().isLength({ min: 6, max: 50 }),
]
```

### Service Logic

```
getProfile(userId):
  1. Find user by id (exclude passwordHash)
  2. Return user object

updateProfile(userId, fullName, phoneNumber):
  1. Update user (only provided fields)
  2. Return updated user

changePassword(userId, currentPassword, newPassword):
  1. Find user, get passwordHash
  2. Compare currentPassword with hash
  3. If mismatch → 400 "Mật khẩu hiện tại không đúng"
  4. Hash newPassword
  5. Update passwordHash
  6. Return success
```

---

## Module 3: Categories

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/categories` | User | Danh sách (query: isActive) |
| POST | `/api/v1/categories` | User | Tạo mới |
| PUT | `/api/v1/categories/{categoryId}` | User | Cập nhật tên/màu |
| PATCH | `/api/v1/categories/{categoryId}/active` | User | Ẩn/hiện |

### Files

```
├── routes/categoryRoutes.js
├── controllers/categoryController.js
├── services/categoryService.js
├── repositories/categoryRepo.js
└── dto/request/categoryValidation.js
```

### Validation

```js
create: [
  body('categoryName').notEmpty().isLength({ max: 100 })
    .withMessage('Tên danh mục không được để trống'),
  body('colorCode').optional().isLength({ max: 20 }),
]

update: [
  param('categoryId').isInt({ min: 1 }),
  body('categoryName').optional().notEmpty().isLength({ max: 100 }),
  body('colorCode').optional().isLength({ max: 20 }),
]

toggleActive: [
  param('categoryId').isInt({ min: 1 }),
  body('isActive').isBoolean(),
]
```

### Service Logic

```
getByUser(userId, isActive?):
  1. Find many by userId, optional filter isActive
  2. Return list

create(userId, categoryName, colorCode):
  1. Check unique (userId + categoryName) → ERD-R-03
  2. If duplicate → 400 "Danh mục này đã tồn tại"
  3. Create category
  4. Return created category

update(userId, categoryId, data):
  1. Find category by id + userId (ownership check)
  2. If not found → 404
  3. If newName conflicts → 400
  4. Update fields
  5. Return updated category

toggleActive(userId, categoryId, isActive):
  1. Find + ownership check
  2. Update isActive (ERD-R-17: không xóa cứng)
  3. Return updated category
```

---

## Module 4: Tasks (Core)

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks` | User | Danh sách (filter, sort, paginate) |
| POST | `/api/v1/tasks` | User | Tạo mới + reminders |
| GET | `/api/v1/tasks/{taskId}` | User | Chi tiết (include subtasks, reminders) |
| PUT | `/api/v1/tasks/{taskId}` | User | Cập nhật |
| DELETE | `/api/v1/tasks/{taskId}` | User | Xóa (chỉ nếu chưa có notification log) |
| POST | `/api/v1/tasks/{taskId}/complete` | User | Hoàn thành + sinh task repeat |
| POST | `/api/v1/tasks/{taskId}/reopen` | User | Mở lại |
| POST | `/api/v1/tasks/{taskId}/cancel` | User | Hủy + cancel reminders |

### Files

```
├── routes/taskRoutes.js
├── controllers/taskController.js
├── services/taskService.js
├── repositories/taskRepo.js
└── dto/request/taskValidation.js
```

### Query Params (GET /tasks)

```
?status=TODO|IN_PROGRESS|COMPLETED|CANCELLED
&priority=LOW|MEDIUM|HIGH|URGENT
&categoryId=3
&keyword=ôn tập
&dueFrom=2026-08-01T00:00:00+07:00
&dueTo=2026-08-31T23:59:59+07:00
&page=1&pageSize=20
&sort=dueAsc|dueDesc|priorityDesc
```

### Validation

```js
create: [
  body('title').notEmpty().isLength({ max: 255 }),
  body('dueAt').notEmpty().isISO8601(),
  body('priority').notEmpty().isIn(['LOW','MEDIUM','HIGH','URGENT']),
  body('repeatType').optional().isIn(['NONE','DAILY','WEEKLY','MONTHLY']),
  body('categoryId').optional().isInt({ min: 1 }),
  body('description').optional().isString(),
  body('reminders').optional().isArray({ max: 5 }),
  body('reminders.*.remindAt').notEmpty().isISO8601(),
]

update: [
  param('taskId').isInt({ min: 1 }),
  body('title').optional().notEmpty().isLength({ max: 255 }),
  body('dueAt').optional().isISO8601(),
  body('priority').optional().isIn(['LOW','MEDIUM','HIGH','URGENT']),
  body('repeatType').optional().isIn(['NONE','DAILY','WEEKLY','MONTHLY']),
  body('categoryId').optional().isInt({ min: 1 }),
]
```

### Service Logic – Create

```
create(userId, taskData):
  1. Validate: remindAt <= dueAt (ERD-R-09)
  2. Validate: max 5 reminders (ERD-R-10)
  3. Transaction ($transaction):
     a. Create task (status=TODO, userId)
     b. Create reminders (status=SCHEDULED, remindAt each)
  4. Return task + reminders

// remindAt validation:
for each reminder in reminders:
  if reminder.remindAt > task.dueAt:
    throw 400 "Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc"

// max reminders:
activeCount = await repo.countActiveReminders(taskId)
if activeCount + newReminders.length > 5:
  throw 400 "Mỗi công việc chỉ được có tối đa 5 nhắc nhở đang hoạt động"
```

### Service Logic – Complete (ERD-R-13, R-14)

```
complete(userId, taskId):
  1. Find task + ownership check
  2. If already COMPLETED/CANCELLED → 400
  3. Transaction:
     a. Update task: status=COMPLETED, completedAt=now
     b. Cancel all SCHEDULED/TRIGGERED reminders → CANCELLED
     c. If repeatType != NONE:
        - Calculate nextDueAt (addDays/Weeks/Months)
        - Clone task (new task, parentTaskId=taskId, dueAt=nextDueAt, status=TODO)
        - Clone reminders (new reminders with new remindAt)
  4. Return { completedTask, nextTask? }
```

### Service Logic – Cancel

```
cancel(userId, taskId):
  1. Find task + ownership check
  2. Transaction:
     a. Update task: status=CANCELLED
     b. Cancel all SCHEDULED/TRIGGERED reminders
  3. Return success
```

### Service Logic – Delete

```
delete(userId, taskId):
  1. Find task + ownership check
  2. Check: has notification logs? (repo.hasNotificationLogs)
  3. If yes → 400 "Không thể xóa công việc đã phát sinh thông báo. Hãy hủy thay vì xóa."
  4. Transaction:
     a. Delete reminders
     b. Delete subtasks
     c. Delete task
  5. Return success
```

---

## Module 5: Subtasks

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks/{taskId}/subtasks` | User | Danh sách |
| POST | `/api/v1/tasks/{taskId}/subtasks` | User | Thêm mới |
| PUT | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}` | User | Sửa nội dung |
| POST | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}/toggle` | User | Toggle hoàn thành |
| DELETE | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}` | User | Xóa |

### Service Logic

```
// Tất cả cần ownership check qua taskId → task.userId === currentUser.id

create(taskId, content):
  1. Find task + ownership check
  2. Auto increment displayOrder
  3. Create subtask (isCompleted=false)
  4. Return subtask

toggleComplete(taskId, subtaskId):
  1. Find subtask + ownership check
  2. Toggle isCompleted
  3. Return updated subtask
```

---

## Module 6: Reminders

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks/{taskId}/reminders` | User | Danh sách theo task |
| POST | `/api/v1/tasks/{taskId}/reminders` | User | Thêm nhắc nhở |
| PUT | `/api/v1/tasks/{taskId}/reminders/{reminderId}` | User | Sửa (chỉ SCHEDULED) |
| DELETE | `/api/v1/tasks/{taskId}/reminders/{reminderId}` | User | Xóa (chỉ chưa trigger) |
| GET | `/api/v1/reminders/due` | User | Reminder đến hạn |
| GET | `/api/v1/reminders/{reminderId}` | User | Chi tiết + task info |
| POST | `/api/v1/reminders/{reminderId}/snooze` | User | Hoãn (max 3 lần) |
| POST | `/api/v1/reminders/{reminderId}/dismiss` | User | Tắt |

### Service Logic – Snooze (ERD-R-12)

```
snooze(userId, reminderId, snoozeMinutes?):
  1. Find reminder + ownership (via task.userId)
  2. If status != TRIGGERED/SNOOZED → 400 "Chỉ có thể hoãn nhắc nhở đang kêu"
  3. If snoozeCount >= 3 → 400 "Nhắc nhở này đã được hoãn tối đa 3 lần"
  4. Get snoozeMinutes from body or notificationSettings.defaultSnoozeMinutes
  5. Update: remindAt += snoozeMinutes, status=SCHEDULED, snoozeCount++
  6. Create NotificationLog (action=SNOOZED)
  7. Return updated reminder
```

### Service Logic – Dismiss

```
dismiss(userId, reminderId):
  1. Find reminder + ownership
  2. If status not in [TRIGGERED, SNOOZED] → 400
  3. Update: status=DISMISSED
  4. Create NotificationLog (action=DISMISSED)
  5. Return { reminderId, status: 'DISMISSED' }
```

### Service Logic – Due (polling)

```
getDueReminders(userId, to?):
  1. Find all reminders WHERE:
     - task.userId = userId
     - status IN (SCHEDULED, TRIGGERED)
     - remindAt <= to (default: now)
  2. Include task info (title, description, priority)
  3. Return list
```

---

## Module 7: Devices + Notifications

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/v1/devices` | User | Đăng ký thiết bị |
| GET | `/api/v1/devices` | User | Danh sách active |
| DELETE | `/api/v1/devices/{deviceId}` | User | Gỡ (soft delete) |
| GET | `/api/v1/notification-settings` | User | Lấy cài đặt |
| PUT | `/api/v1/notification-settings` | User | Cập nhật |
| GET | `/api/v1/notification-logs` | User | Lịch sử (paginate) |

### Service Logic – Device

```
register(userId, deviceToken, platform):
  1. Check token exists?
  2. If yes → update isActive=true, userId (gắn lại)
  3. If no → create device
  4. Return device

deactivate(userId, deviceId):
  1. Find device + ownership check
  2. Update isActive=false (ERD-R-16: soft delete)
  3. Return success
```

---

## Module 8: Dashboard + Admin

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/dashboard` | User | todayCount, overdueCount, completedCount, upcomingCount |
| GET | `/api/v1/admin/dashboard` | Admin | totalUsers, totalTasks, todayNotifications |
| GET | `/api/v1/admin/users` | Admin | Danh sách user (search, paginate) |
| POST | `/api/v1/admin/users/{userId}/lock` | Admin | Khóa tài khoản |
| POST | `/api/v1/admin/users/{userId}/unlock` | Admin | Mở khóa |

### Service Logic – User Dashboard

```
getDashboard(userId):
  now = new Date()
  todayStart = startOfDay(now)
  todayEnd = endOfDay(now)

  [todayCount, overdueCount, completedCount, upcomingCount] = await Promise.all([
    repo.countTasks(userId, { dueAt: todayStart..todayEnd, status: TODO/IN_PROGRESS }),
    repo.countTasks(userId, { dueAt < now, status: TODO/IN_PROGRESS }),
    repo.countTasks(userId, { status: COMPLETED }),
    repo.countTasks(userId, { dueAt > now, status: TODO/IN_PROGRESS }),
  ])

  return { todayCount, overdueCount, completedCount, upcomingCount }
```

---

## Module 9: Reminder Scheduler

### File

```
├── schedulers/reminderScheduler.js
```

### Logic

```js
import cron from 'node-cron'

// Poll mỗi 5 giây
cron.schedule('*/5 * * * * *', async () => {
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    // 1. Find SCHEDULED reminders that are due
    const dueReminders = await tx.reminder.findMany({
      where: {
        status: 'SCHEDULED',
        remindAt: { lte: now },
      },
      include: {
        task: {
          include: {
            user: { include: { devices: { where: { isActive: true } } } },
          },
        },
      },
    })

    // 2. Mark as TRIGGERED
    for (const reminder of dueReminders) {
      await tx.reminder.update({
        where: { reminderId: reminder.reminderId },
        data: { status: 'TRIGGERED' },
      })

      // 3. Send push notification to all active devices
      for (const device of reminder.task.user.devices) {
        await sendNotification(device, reminder)
        // Log notification
        await tx.notificationLog.create({
          data: {
            reminderId: reminder.reminderId,
            deviceId: device.deviceId,
            action: 'SENT',
          },
        })
      }
    }
  })
})
```

---

## Thứ tự triển khai

| # | Module | Ưu tiên | Files | Effort |
|---|---|---|---|---|
| 1 | Auth | 🔴 Cao | 5 files | 2h |
| 2 | User Profile | 🔴 Cao | 5 files | 30m |
| 3 | Category | 🔴 Cao | 5 files | 30m |
| 4 | Task | 🔴 Cao | 5 files | 3h |
| 5 | Subtask | 🟡 Trung bình | 5 files | 30m |
| 6 | Reminder | 🔴 Cao | 5 files + scheduler | 2h |
| 7 | Device + Notification | 🟡 Trung bình | 6 files | 1h |
| 8 | Dashboard + Admin | 🟢 Thấp | 4 files | 1h |

**Tổng estimated: ~10h implement + test**

---

## Global Patterns

### Ownership Check Pattern
```js
// Mọi module cần check ownership qua service layer
async function assertOwnership(repo, id, userId, entityName) {
  const entity = await repo.findById(id)
  if (!entity) throw ApiError.notFound()
  if (entity.userId !== userId) throw ApiError.forbidden()
  return entity
}
```

### Response Envelope
```js
// Controller luôn trả qua helper
success(res, 201, 'Tạo công việc thành công', taskData)
success(res, 200, 'Thao tác thành công', data)
error(res, 400, 'Lỗi validation', errors)
```

### Transaction Pattern
```js
// Prisma interactive transaction
await prisma.$transaction(async (tx) => {
  // All queries inside use tx, not prisma
  const task = await tx.task.create({ data: ... })
  await tx.reminder.createMany({ data: [...] })
  return task
})
```

### Error Handling
```js
// Service throw ApiError, controller không cần try/catch (catchAsync handle)
throw ApiError.badRequest('Mỗi công việc chỉ được có tối đa 5 nhắc nhở đang hoạt động')
throw ApiError.notFound('Không tìm thấy dữ liệu')
throw ApiError.forbidden('Bạn không có quyền truy cập công việc này')
```
