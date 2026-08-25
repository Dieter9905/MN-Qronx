# Phase 3 – Technical Spec: Business Modules (Production-Ready)

> **Phiên bản:** 2.0 – Refactored  
> **Ngày:** 2026-08-19  
> **Tác giả:** Principal Software Architect (AI-refactored)

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Global Patterns & Anti-Patterns](#2-global-patterns--anti-patterns)
3. [Module 1: Authentication (Dual-Token)](#3-module-1-authentication-dual-token)
4. [Module 2: User Profile](#4-module-2-user-profile)
5. [Module 3: Categories](#5-module-3-categories)
6. [Module 4: Tasks (Core)](#6-module-4-tasks-core)
7. [Module 5: Subtasks](#7-module-5-subtasks)
8. [Module 6: Reminders](#8-module-6-reminders)
9. [Module 7: Devices + Notifications](#9-module-7-devices--notifications)
10. [Module 8: Dashboard + Admin](#10-module-8-dashboard--admin)
11. [Module 9: Reminder Scheduler (Refactored)](#11-module-9-reminder-scheduler-refactored)
12. [Rate Limiting](#12-rate-limiting)
13. [Thứ tự triển khai & Effort](#13-thứ-tự-triển-khai--effort)

---

## 1. Tổng quan

Triển khai 9 module nghiệp vụ cho TaskAlarm Backend. Mỗi module đủ: **Routes → Validation → Controller → Service → Repository → Swagger docs**.

### Architecture Rules

| Rule | Chi tiết |
|---|---|
| **No async I/O trong Transaction** | Prisma `$transaction` chỉ dùng cho DB queries thuần túy. Push notification, email, HTTP calls phải nằm ngoài transaction. |
| **Ownership check** | Mọi thao tác trên resource phải verify `resource.userId === currentUser.id` ở service layer. |
| **Response envelope** | Mọi response theo `{ success, message, data?, errors? }` |
| **Soft Delete** | `Task`, `Reminder`, `NotificationLog` không hard delete (ERD-R-18). `Device` soft delete (ERD-R-16). |
| **Prisma Error P2002** | Bắt unique constraint violation → trả 400 thân thiện, không để crash. |

---

## 2. Global Patterns & Anti-Patterns

### ✅ Ownership Check Pattern

```js
// services/shared/assertOwnership.js
import { PrismaClient } from '@prisma/client'
import ApiError from '../../utils/ApiError.js'

const prisma = new PrismaClient()

/**
 * Verify resource belongs to user. Throw 404/403 if not.
 * @param {string} model   – Prisma model name (e.g. 'task')
 * @param {object} where   – { id: resourcePrimaryKey, userId }
 * @param {string} label   – Human-readable name for error messages
 * @returns The found entity
 */
export async function assertOwnership(model, where, label = 'dữ liệu') {
  const entity = await prisma[model].findUnique({ where })
  if (!entity) throw ApiError.notFound(`Không tìm thấy ${label}`)
  // where.userId is already part of the query, so if found, ownership is guaranteed
  return entity
}
```

### ✅ Prisma P2002 Handler

```js
// services/shared/handlePrismaError.js
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import ApiError from '../../utils/ApiError.js'

export function handlePrismaError(err, context = {}) {
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'trường'
      throw ApiError.badRequest(`${field} đã tồn tại`, { [field]: `${field} đã tồn tại trong hệ thống` })
    }
    if (err.code === 'P2025') {
      throw ApiError.notFound('Không tìm thấy dữ liệu')
    }
  }
  throw err
}
```

### ✅ Transaction Pattern (DB-only)

```js
// CHỈ dùng cho các query DB thuần túy
// KHÔNG gọi API, gửi email, push notification bên trong
await prisma.$transaction(async (tx) => {
  const task = await tx.task.create({ data: ... })
  await tx.reminder.createMany({ data: [...] })
  return task
})
```

### ❌ Anti-Pattern (TUYỆT ĐỐI KHÔNG)

```js
// SAI: Gọi async I/O bên trong transaction
await prisma.$transaction(async (tx) => {
  await tx.reminder.update({ ... })
  await sendPushNotification(device, payload)  // ← BLOCKS, có thể timeout transaction
})
```

---

## 3. Module 1: Authentication (Dual-Token)

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Đăng ký User mới |
| POST | `/api/v1/auth/login` | Public | Đăng nhập → trả `accessToken` + `refreshToken` |
| POST | `/api/v1/auth/refresh-token` | Public | Nhận `refreshToken` → trả `accessToken` mới |
| POST | `/api/v1/auth/logout` | User | Revoke `refreshToken` hiện tại |
| POST | `/api/v1/auth/forgot-password` | Public | Gửi reset token (hash trước khi lưu) |
| POST | `/api/v1/auth/reset-password` | Public | Đặt lại mật khẩu + revoke toàn bộ token |

### Files

```
backend/src/
├── routes/authRoutes.js
├── controllers/authController.js
├── services/authService.js
├── repositories/authRepo.js
└── dto/request/authValidation.js
```

### Schema Changes

```prisma
// Thêm vào model User
model User {
  // ... existing fields
  tokenVersion   Int      @default(0) @map("token_version")
  refreshTokens  RefreshToken[]
}

// Model mới: RefreshToken
model RefreshToken {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  tokenHash   String   @unique @db.VarChar(64) @map("token_hash")
  expiresAt   DateTime @map("expires_at")
  createdAt   DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

### Validation Rules

```js
register: [
  body('fullName').notEmpty().withMessage('Họ tên không được để trống').isLength({ max: 150 }),
  body('email').notEmpty().withMessage('Email không được để trống').isEmail().withMessage('Email không hợp lệ'),
  body('password').notEmpty().withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6, max: 50 }).withMessage('Mật khẩu phải từ 6-50 ký tự'),
]

login: [
  body('email').notEmpty().isEmail(),
  body('password').notEmpty(),
]

refreshToken: [
  body('refreshToken').notEmpty().withMessage('Refresh token không được để trống'),
]

logout: [
  // No body needed – uses req.user from auth middleware
]

forgotPassword: [
  body('email').notEmpty().isEmail(),
]

resetPassword: [
  body('resetToken').notEmpty().withMessage('Reset token không được để trống'),
  body('newPassword').notEmpty().isLength({ min: 6, max: 50 }),
]
```

### Service Logic

```
register(fullName, email, password):
  1. Check email unique → catch P2002 → 400 "Email đã tồn tại"
  2. Hash password (bcrypt, salt=10)
  3. Transaction:
     a. Create user (role = USER)
     b. Create notificationSetting (default values)
  4. Return { userId, fullName, email }

login(email, password):
  1. Find user by email (include role)
  2. If not found → 400 "Email hoặc mật khẩu không đúng" (generic message)
  3. If !isActive → 403 "Tài khoản đã bị khóa"
  4. Compare password (bcrypt.compare)
  5. If mismatch → 400 "Email hoặc mật khẩu không đúng"
  6. Generate tokens:
     - accessToken = jwt.sign({ id, role, tokenVersion }, secret, { expiresIn: '15m' })
     - refreshToken = crypto.randomBytes(40).toString('hex')
  7. Save refreshToken (SHA-256 hash) → RefreshToken table (expiresAt = now + 7d)
  8. Return { accessToken, refreshToken, user: { userId, fullName, email, role } }

refreshToken(oldRefreshToken):
  1. hash = SHA-256(oldRefreshToken)
  2. Find RefreshToken by tokenHash
  3. If not found → 401 "Refresh token không hợp lệ"
  4. If expired → delete, 401 "Refresh token đã hết hạn"
  5. Find user → check isActive
  6. Transaction:
     a. Delete old refreshToken
     b. Create new refreshToken (SHA-256 hash, expires = now + 7d)
  7. Generate new accessToken (cùng tokenVersion)
  8. Return { accessToken, refreshToken: newRefreshToken }

logout(userId, refreshTokenValue):
  1. hash = SHA-256(refreshTokenValue)
  2. Delete RefreshToken by tokenHash + userId
  3. Return success

forgotPassword(email):
  1. Find user by email
  2. If not found → return success (không reveal email existence)
  3. Generate resetToken = crypto.randomBytes(32).toString('hex')
  4. Hash resetToken (SHA-256) before save
  5. Save PasswordResetRequest:
     - resetTokenHash = SHA-256(resetToken)
     - expiresAt = now + 1h
  6. Return { message: "Nếu email tồn tại, hướng dẫn đã được gửi" }
  // Response luôn success dù email có tồn tại hay không (prevent email enumeration)

resetPassword(resetToken, newPassword):
  1. hash = SHA-256(resetToken)
  2. Find PasswordResetRequest by resetTokenHash
  3. If not found → 400 "Token không hợp lệ"
  4. If expired → delete, 400 "Token đã hết hạn"
  5. If usedAt != null → 400 "Token đã được sử dụng"
  6. Transaction:
     a. Hash newPassword (bcrypt)
     b. Update user.passwordHash
     c. Increment user.tokenVersion (revoke ALL existing tokens) ← FIX #1.5
     d. Delete ALL refreshTokens for this user (revoke sessions)
     e. Mark resetRequest.usedAt = now
  7. Return success
```

### Response Examples

```json
// POST /auth/login - 200
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "a1b2c3d4e5f6...",
    "user": {
      "userId": 1,
      "fullName": "Nguyễn Văn Minh",
      "email": "minh@example.com",
      "role": "USER"
    }
  }
}

// POST /auth/refresh-token - 200
{
  "success": true,
  "message": "Làm mới token thành công",
  "data": {
    "accessToken": "eyJhbGciOi...(new)",
    "refreshToken": "x9y8z7w6v5u4..."
  }
}
```

### Token Revocation

```
Khi nào revoke toàn bộ token:
  - changePassword → increment tokenVersion
  - resetPassword  → increment tokenVersion + delete all refreshTokens

Auth middleware kiểm tra:
  1. Verify accessToken →得到 { id, role, tokenVersion }
  2. Find user by id → compare tokenVersion
  3. Nếu mismatch → 401 "Phiên đã hết hạn, vui lòng đăng nhập lại"
```

---

## 4. Module 2: User Profile

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/me` | User | Lấy hồ sơ |
| PUT | `/api/v1/me` | User | Cập nhật fullName, phoneNumber |
| PUT | `/api/v1/me/password` | User | Đổi mật khẩu + revoke token |

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
  body('currentPassword').notEmpty().withMessage('Mật khẩu hiện tại không được để trống'),
  body('newPassword').notEmpty().isLength({ min: 6, max: 50 })
    .withMessage('Mật khẩu mới phải từ 6-50 ký tự'),
]
```

### Service Logic

```
getProfile(userId):
  1. Find user by id (select: id, fullName, email, phoneNumber, role, isActive, createdAt)
  2. Return user object (KHÔNG trả passwordHash)

updateProfile(userId, { fullName, phoneNumber }):
  1. Update user (only provided fields)
  2. Return updated user

changePassword(userId, currentPassword, newPassword):
  1. Find user, get passwordHash
  2. Compare currentPassword with hash
  3. If mismatch → 400 "Mật khẩu hiện tại không đúng"
  4. Hash newPassword (bcrypt)
  5. Transaction:
     a. Update user.passwordHash
     b. Increment user.tokenVersion ← REVOKE ALL TOKENS
     c. Delete ALL user's refreshTokens ← Force re-login
  6. Return success { message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." }
```

---

## 5. Module 3: Categories

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
  body('isActive').isBoolean().toStrictBoolean(),
]
```

### Service Logic

```
getByUser(userId, isActive?):
  1. Find many by userId, optional filter isActive
  2. Return list

create(userId, categoryName, colorCode):
  1. Create category (Prisma unique compound: @@unique([userId, categoryName]))
  2. Catch P2002 → 400 "Danh mục này đã tồn tại"
  3. Return created category

update(userId, categoryId, { categoryName?, colorCode? }):
  1. assertOwnership('category', { categoryId, userId }, 'danh mục')
  2. Update fields (only provided)
  3. Catch P2002 → 400 "Tên danh mục đã tồn tại"
  4. Return updated category

toggleActive(userId, categoryId, isActive):
  1. assertOwnership('category', { categoryId, userId }, 'danh mục')
  2. Update isActive (ERD-R-17: không xóa cứng, chỉ ẩn)
  3. Return updated category
```

---

## 6. Module 4: Tasks (Core)

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks` | User | Danh sách (filter, sort, paginate) |
| POST | `/api/v1/tasks` | User | Tạo mới + reminders |
| GET | `/api/v1/tasks/{taskId}` | User | Chi tiết (include subtasks, reminders) |
| PUT | `/api/v1/tasks/{taskId}` | User | Cập nhật |
| DELETE | `/api/v1/tasks/{taskId}` | User | Soft delete (an toàn) |
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
  body('categoryId').optional({ values: 'null' }).isInt({ min: 1 }),
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
  body('categoryId').optional({ values: 'null' }).isInt({ min: 1 }),
]
```

### Service Logic – Create

```
create(userId, taskData):
  1. Validate:每一 reminder.remindAt <= taskData.dueAt (ERD-R-09)
  2. Validate: reminders.length <= 5 (ERD-R-10)
  3. If taskData.categoryId → assertOwnership('category', { categoryId, userId })
  4. Transaction:
     a. Create task (status=TODO, userId)
     b. Create reminders (status=SCHEDULED, remindAt each)
  5. Return task + reminders

// remindAt validation:
for each reminder in reminders:
  if (reminder.remindAt > taskData.dueAt):
    throw ApiError.badRequest(
      'Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc',
      { [`reminders[${i}].remindAt`]: 'Phải <= dueAt' }
    )
```

### Service Logic – Complete (ERD-R-13, R-14) + Smart Repeat

```
complete(userId, taskId):
  1. assertOwnership('task', { taskId, userId })
  2. If task.status in [COMPLETED, CANCELLED] → 400 "Công việc đã kết thúc"
  3. Transaction:
     a. Update task: status=COMPLETED, completedAt=now
     b. Bulk update reminders: status IN (SCHEDULED, TRIGGERED) → CANCELLED
     c. If repeatType != NONE:
        nextDueAt = calculateSmartNextDue(task.dueAt, task.repeatType)

        // Clone task:
        newTask = create task:
          - userId, categoryId, title, description, priority, repeatType
          - parentTaskId = taskId
          - dueAt = nextDueAt
          - status = TODO

        // Clone reminders:
        for each reminder of original task (status=CANCELLED):
          newRemindAt = shiftSameOffset(reminder.remindAt, task.dueAt, nextDueAt)
          create reminder: taskId=newTask.taskId, remindAt=newRemindAt, status=SCHEDULED

  4. Return { completedTask, nextTask? }

// ── Smart nextDueAt (FIX #3: Handle Overdue) ──
function calculateSmartNextDue(originalDueAt, repeatType):
  now = new Date()
  base = max(originalDueAt, now)  // If overdue, use now instead of old dueAt

  switch repeatType:
    DAILY:  return startOfDay(addDays(base, 1)) + originalTimeOfDay
    WEEKLY: return startOfWeek(addWeeks(base, 1)) + originalTimeOfDay
    MONTHLY: return startOfMonth(addMonths(base, 1)) + originalTimeOfDay

  // Example: Task due 2026-08-15 09:00, completed on 2026-08-20 14:00
  // old logic: nextDueAt = 2026-08-16 09:00 (wrong, in the past)
  // new logic: nextDueAt = 2026-08-21 09:00 (correct, based on now)

// ── Shift reminder offset proportionally ──
function shiftSameOffset(remindAt, oldDueAt, newDueAt):
  offsetMs = oldDueAt - remindAt  // How long before due
  return newDueAt - offsetMs      // Same offset from new due
```

### Service Logic – Delete (Soft Delete – FIX #3.5)

```
delete(userId, taskId):
  1. assertOwnership('task', { taskId, userId })
  2. Check: has sent notifications?
     hasLogs = await prisma.notificationLog.count({
       where: { reminder: { task: { taskId } }, action: 'SENT' }
     })
  3. If hasLogs > 0 → 400 "Không thể xóa công việc đã phát sinh thông báo. Hãy hủy thay vì xóa."
  4. Transaction:
     a. Soft delete reminders: updateMany → status = CANCELLED (chưa triggered)
     b. Delete subtasks (hard delete – subtask không cần lịch sử)
     c. Hard delete task (an toàn vì chưa có notification log)
     // Nếu đã có notification log → chỉ cho CANCEL, không cho DELETE
  5. Return success

// Phân biệt:
// - DELETE (xóa cứng): chỉ khi chưa có notification log
// - CANCEL (hủy): luôn được, task giữ lại lịch sử
```

### Service Logic – Cancel

```
cancel(userId, taskId):
  1. assertOwnership('task', { taskId, userId })
  2. Transaction:
     a. Update task: status=CANCELLED
     b. Bulk update reminders: status IN (SCHEDULED, TRIGGERED) → CANCELLED
  3. Return success
```

### Service Logic – Reopen

```
reopen(userId, taskId):
  1. assertOwnership('task', { taskId, userId })
  2. If task.status not in [COMPLETED, CANCELLED] → 400 "Chỉ mở lại công việc đã hoàn thành/hủy"
  3. Transaction:
     a. Update task: status=TODO, completedAt=null
     b. (Không tự động khôi phục reminders đã CANCELLED – user phải tạo lại)
  4. Return updated task
```

---

## 7. Module 5: Subtasks

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks/{taskId}/subtasks` | User | Danh sách (sắp xếp theo displayOrder) |
| POST | `/api/v1/tasks/{taskId}/subtasks` | User | Thêm mới |
| PUT | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}` | User | Sửa nội dung |
| POST | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}/toggle` | User | Toggle hoàn thành |
| DELETE | `/api/v1/tasks/{taskId}/subtasks/{subtaskId}` | User | Xóa |

### Files

```
├── routes/subtaskRoutes.js
├── controllers/subtaskController.js
├── services/subtaskService.js
├── repositories/subtaskRepo.js
└── dto/request/subtaskValidation.js
```

### Validation

```js
create: [
  param('taskId').isInt({ min: 1 }),
  body('content').notEmpty().isLength({ max: 255 }),
]

update: [
  param('taskId').isInt({ min: 1 }),
  param('subtaskId').isInt({ min: 1 }),
  body('content').notEmpty().isLength({ max: 255 }),
]
```

### Service Logic

```
// Mọi thao tác cần ownership check qua taskId:
//   task = await assertOwnership('task', { taskId, userId })
//   if (!task) → 404

list(taskId, userId):
  1. assertOwnership('task', { taskId, userId })
  2. Find many subtasks WHERE taskId, orderBy displayOrder
  3. Return list

create(taskId, userId, content):
  1. assertOwnership('task', { taskId, userId })
  2. maxOrder = await prisma.subtask.aggregate({ where: { taskId }, _max: { displayOrder: true } })
  3. Create subtask: content, displayOrder = (maxOrder || 0) + 1
  4. Return subtask

update(taskId, subtaskId, userId, content):
  1. assertOwnership('task', { taskId, userId })
  2. Find subtask by { subtaskId, taskId } → 404 if not found
  3. Update content
  4. Return updated subtask

toggleComplete(taskId, subtaskId, userId):
  1. assertOwnership('task', { taskId, userId })
  2. Find subtask by { subtaskId, taskId }
  3. Toggle isCompleted (prisma: { isCompleted: !current })
  4. Return updated subtask

remove(taskId, subtaskId, userId):
  1. assertOwnership('task', { taskId, userId })
  2. Find subtask by { subtaskId, taskId }
  3. Delete subtask
  4. Return success
```

---

## 8. Module 6: Reminders

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/tasks/{taskId}/reminders` | User | Danh sách theo task |
| POST | `/api/v1/tasks/{taskId}/reminders` | User | Thêm nhắc nhở (tối đa 5) |
| PUT | `/api/v1/tasks/{taskId}/reminders/{reminderId}` | User | Sửa (chỉ SCHEDULED) |
| DELETE | `/api/v1/tasks/{taskId}/reminders/{reminderId}` | User | Xóa (chỉ SCHEDULED) |
| GET | `/api/v1/reminders/due` | User | Reminder đến hạn (polling) |
| GET | `/api/v1/reminders/{reminderId}` | User | Chi tiết + task info |
| POST | `/api/v1/reminders/{reminderId}/snooze` | User | Hoãn (max 3, clamp ≤ dueAt) |
| POST | `/api/v1/reminders/{reminderId}/dismiss` | User | Tắt |

### Files

```
├── routes/reminderRoutes.js
├── controllers/reminderController.js
├── services/reminderService.js
├── repositories/reminderRepo.js
└── dto/request/reminderValidation.js
```

### Validation

```js
addReminder: [
  param('taskId').isInt({ min: 1 }),
  body('remindAt').notEmpty().isISO8601(),
]

updateReminder: [
  param('taskId').isInt({ min: 1 }),
  param('reminderId').isInt({ min: 1 }),
  body('remindAt').notEmpty().isISO8601(),
]

snooze: [
  param('reminderId').isInt({ min: 1 }),
  body('snoozeMinutes').optional().isInt({ min: 1, max: 60 }),
]
```

### Service Logic – Add Reminder

```
addReminder(taskId, userId, remindAt):
  1. assertOwnership('task', { taskId, userId })
  2. Validate: remindAt <= task.dueAt (ERD-R-09)
  3. Count active reminders: COUNT WHERE taskId AND status != CANCELLED
  4. If count >= 5 → 400 "Mỗi công việc chỉ được có tối đa 5 nhắc nhở đang hoạt động"
  5. Create reminder (status=SCHEDULED, snoozeCount=0)
  6. Return created reminder
```

### Service Logic – Update Reminder

```
updateReminder(taskId, reminderId, userId, newRemindAt):
  1. assertOwnership('task', { taskId, userId })
  2. Find reminder by { reminderId, taskId }
  3. If status != SCHEDULED → 400 "Chỉ có thể sửa nhắc nhở chưa đến giờ"
  4. Validate: newRemindAt <= task.dueAt
  5. Update remindAt
  6. Return updated reminder
```

### Service Logic – Snooze (FIX #5: Clamp ≤ dueAt)

```
snooze(userId, reminderId, snoozeMinutes?):
  1. Find reminder + ownership (via task.userId)
  2. If status not in [TRIGGERED, SNOOZED] → 400 "Chỉ có thể hoãn nhắc nhở đang kêu"
  3. If snoozeCount >= 3 → 400 "Nhắc nhở này đã được hoãn tối đa 3 lần"
  4. Get snoozeMinutes:
     a. If provided in body → use that value
     b. Else → load notificationSettings.defaultSnoozeMinutes for user
  5. Calculate new remindAt = now + snoozeMinutes

  // ── FIX #5: Clamp to not exceed task.dueAt ──
  6. Load task.dueAt
  7. If newRemindAt > task.dueAt:
     newRemindAt = task.dueAt  // Clamp to dueAt

  8. Update reminder:
     - remindAt = newRemindAt
     - status = SCHEDULED (re-queue for scheduler)
     - snoozeCount += 1

  // NOT inside transaction – NotificationLog created separately
  9. Create NotificationLog (action=SNOOZED) outside DB transaction

  10. Return updated reminder

// Validation (ERD-R-12): snoozeCount checked at step 3, enforced at DB level too (CHECK 0-3)
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

### Service Logic – Due (Polling)

```
getDueReminders(userId, to?):
  1. to = to || new Date()
  2. Find all reminders WHERE:
     - task.userId = userId
     - status IN (SCHEDULED, TRIGGERED)
     - remindAt <= to
  3. Include task (title, description, priority, dueAt)
  4. Return list (limit 10 per poll)
```

---

## 9. Module 7: Devices + Notifications

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/v1/devices` | User | Đăng ký thiết bị |
| GET | `/api/v1/devices` | User | Danh sách active |
| DELETE | `/api/v1/devices/{deviceId}` | User | Gỡ (soft delete) |
| GET | `/api/v1/notification-settings` | User | Lấy cài đặt |
| PUT | `/api/v1/notification-settings` | User | Cập nhật |
| GET | `/api/v1/notification-logs` | User | Lịch sử (paginate) |

### Files

```
├── routes/deviceRoutes.js
├── routes/notificationRoutes.js
├── controllers/deviceController.js
├── controllers/notificationController.js
├── services/deviceService.js
├── services/notificationService.js
├── repositories/deviceRepo.js
├── repositories/notificationLogRepo.js
└── repositories/notificationSettingRepo.js
```

### Validation

```js
registerDevice: [
  body('deviceToken').notEmpty().withMessage('Device token không được để trống'),
  body('platform').notEmpty().isIn(['WEB', 'ANDROID', 'IOS']),
]

updateSettings: [
  body('alarmSound').optional().isLength({ max: 50 }),
  body('defaultSnoozeMinutes').optional().isInt({ min: 1, max: 60 }),
  body('vibrationEnabled').optional().isBoolean(),
]
```

### Service Logic – Device

```
register(userId, deviceToken, platform):
  1. Check if deviceToken exists (any user):
     existing = await prisma.device.findUnique({ where: { deviceToken } })
  2. If exists:
     a. If existing.userId === userId → update isActive=true
     b. If existing.userId !== userId → reassign to current user, isActive=true
     // ERD-R-16: device_token belongs to one user at a time
  3. If not exists:
     a. Create device (isActive=true)
  4. Return device

listActive(userId):
  1. Find many: userId, isActive=true
  2. Return list

deactivate(userId, deviceId):
  1. assertOwnership('device', { deviceId, userId }, 'thiết bị')
  2. Update isActive=false (ERD-R-16: soft delete, giữ lịch sử)
  3. Return success
```

### Service Logic – Notification Settings

```
getSettings(userId):
  1. Find by userId
  2. If not found → create default (alarmSound=DEFAULT, defaultSnoozeMinutes=5, vibrationEnabled=true)
  3. Return settings

updateSettings(userId, data):
  1. Upsert: if exists → update, else → create
  2. Return updated settings
```

### Service Logic – Notification Logs

```
getLogs(userId, { from?, to?, page, pageSize }):
  1. Build WHERE: reminder.task.userId = userId, optional date range
  2. Find many with pagination, orderBy sentAt DESC
  3. Include: reminder.task (title), device (name, platform)
  4. Return { data, pagination: { total, page, pageSize, totalPages } }
```

---

## 10. Module 8: Dashboard + Admin

### API Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/dashboard` | User | Thống kê cá nhân (optimized) |
| GET | `/api/v1/admin/dashboard` | Admin | Thống kê hệ thống |
| GET | `/api/v1/admin/users` | Admin | Danh sách user (search, paginate) |
| POST | `/api/v1/admin/users/{userId}/lock` | Admin | Khóa tài khoản |
| POST | `/api/v1/admin/users/{userId}/unlock` | Admin | Mở khóa |

### Files

```
├── routes/dashboardRoutes.js
├── routes/adminRoutes.js
├── controllers/dashboardController.js
├── controllers/adminController.js
├── services/dashboardService.js
├── services/adminService.js
└── repositories/dashboardRepo.js
```

### Service Logic – User Dashboard (FIX #6: Optimized Query)

```
getDashboard(userId):
  // ── FIX #6: Single GROUP BY query instead of 4 separate COUNT queries ──
  now = new Date()
  todayStart = startOfDay(now)

  // Single query with CASE expressions:
  result = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('TODO', 'IN_PROGRESS')
                        AND due_at >= ${todayStart}
                        AND due_at < ${todayStart} + INTERVAL '1 day') AS "todayCount",
      COUNT(*) FILTER (WHERE status IN ('TODO', 'IN_PROGRESS')
                        AND due_at < ${now}) AS "overdueCount",
      COUNT(*) FILTER (WHERE status = 'COMPLETED') AS "completedCount",
      COUNT(*) FILTER (WHERE status IN ('TODO', 'IN_PROGRESS')
                        AND due_at >= ${now}) AS "upcomingCount"
    FROM tasks
    WHERE user_id = ${userId}
  `

  return {
    todayCount:    Number(result[0].todayCount),
    overdueCount:  Number(result[0].overdueCount),
    completedCount:Number(result[0].completedCount),
    upcomingCount: Number(result[0].upcomingCount),
  }
```

### Service Logic – Admin Dashboard

```
getAdminDashboard():
  [totalUsers, totalTasks, todayNotifications] = await Promise.all([
    prisma.user.count(),
    prisma.task.count(),
    prisma.notificationLog.count({
      where: { sentAt: { gte: startOfDay(now) } }
    }),
  ])
  return { totalUsers, totalTasks, todayNotifications }
```

### Service Logic – Admin Users

```
listUsers({ keyword?, isActive?, page, pageSize }):
  where = { AND: [] }
  if keyword: where.AND.push({ OR: [
    { fullName: { contains: keyword, mode: 'insensitive' } },
    { email: { contains: keyword, mode: 'insensitive' } },
  ]})
  if isActive !== undefined: where.AND.push({ isActive })

  [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, select: { id, fullName, email, role, isActive, createdAt } }),
    prisma.user.count({ where }),
  ])
  return { data: users, pagination: paginationMeta(total, page, pageSize) }

lockUser(userId):
  1. Find user by id → 404
  2. If user.role === 'ADMIN' → 400 "Không thể khóa tài khoản Admin"
  3. Update isActive=false
  4. Delete ALL user's refreshTokens (force logout)
  5. Return success

unlockUser(userId):
  1. Find user → 404
  2. Update isActive=true
  3. Return success
```

---

## 11. Module 9: Reminder Scheduler (Refactored)

### Architecture: Cron → DB → Queue → Worker

```
┌─────────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│  node-cron   │────▶│  DB:     │────▶│  Queue    │────▶│  Worker  │
│  (mỗi 5s)   │     │  UPDATE  │     │  (BullMQ/ │     │  (Push   │
│  Poll query  │     │  status→ │     │   Redis)  │     │  FCM/Web)│
│              │     │ PROCESSING│     │           │     │          │
└─────────────┘     └──────────┘     └───────────┘     └──────────┘
     Phase 1            Phase 2           Phase 3          Phase 4
   (Cron poll)     (Atomic update)    (Enqueue jobs)  (Async push)
```

**TUYỆT ĐỐI KHÔNG:** Gọi Firebase/APNs/Web Push bên trong Prisma `$transaction`.

### Files

```
├── schedulers/reminderScheduler.js     # Cron job – Phase 1-3
├── notifications/pushWorker.js         # Worker – Phase 4
├── notifications/webPushSender.js      # Web Push sender
├── notifications/fcmSender.js          # FCM sender
└── queues/reminderQueue.js             # Queue abstraction
```

### Phase 1: Cron Job (DB poll + Atomic Update)

```js
// schedulers/reminderScheduler.js
import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { enqueueReminders } from '../queues/reminderQueue.js'

const prisma = new PrismaClient()
const BATCH_SIZE = 50  // Max reminders per poll to avoid overload
let isRunning = false  // Prevent overlapping runs

// Poll mỗi 5 giây
cron.schedule('*/5 * * * * *', async () => {
  // ── FIX #4: Prevent overlapping runs (single-instance lock) ──
  if (isRunning) return
  isRunning = true

  try {
    const now = new Date()

    // ── Phase 1+2: Atomic find-and-update (no I/O inside) ──
    // Use updateMany with returning to atomically claim reminders
    const updated = await prisma.$executeRaw`
      UPDATE reminders
      SET status = 'PROCESSING', updated_at = NOW()
      WHERE reminder_id IN (
        SELECT reminder_id FROM reminders
        WHERE status = 'SCHEDULED'
          AND remind_at <= ${now}
        ORDER BY remind_at ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED  -- Skip rows locked by other instances
      )
      RETURNING reminder_id
    `

    if (updated === 0) return  // No due reminders

    // ── Phase 3: Fetch full data and enqueue (outside transaction) ──
    const dueReminders = await prisma.reminder.findMany({
      where: { status: 'PROCESSING' },
      include: {
        task: {
          include: {
            user: {
              include: {
                devices: { where: { isActive: true } },
                notificationSetting: true,
              },
            },
          },
        },
      },
      take: BATCH_SIZE,
    })

    // ── Phase 4: Enqueue to worker (async I/O happens here, NOT in DB transaction) ──
    await enqueueReminders(dueReminders)

  } catch (err) {
    console.error('[Scheduler] Error:', err)
    // Reset any stuck PROCESSING reminders back to SCHEDULED after timeout
    await resetStuckReminders()
  } finally {
    isRunning = false
  }
})

// ── Recovery: Reset stuck PROCESSING reminders (timeout > 30s) ──
async function resetStuckReminders() {
  const timeout = new Date(Date.now() - 30_000)
  await prisma.reminder.updateMany({
    where: {
      status: 'PROCESSING',
      updatedAt: { lt: timeout },
    },
    data: { status: 'SCHEDULED' },
  })
}
```

### Phase 2: Queue Abstraction

```js
// queues/reminderQueue.js
// Simple in-memory queue (swap for BullMQ + Redis in production)
const queue = []

export async function enqueueReminders(reminders) {
  for (const reminder of reminders) {
    for (const device of reminder.task.user.devices) {
      queue.push({
        reminderId: reminder.reminderId,
        taskId: reminder.task.taskId,
        taskTitle: reminder.task.title,
        taskPriority: reminder.task.priority,
        userId: reminder.task.userId,
        deviceId: device.deviceId,
        deviceToken: device.deviceToken,
        platform: device.platform,
        user: {
          fullName: reminder.task.user.fullName,
          alarmSound: reminder.task.user.notificationSetting?.alarmSound || 'DEFAULT',
        },
      })
    }
  }
  processQueue()
}

async function processQueue() {
  while (queue.length > 0) {
    const job = queue.shift()
    await processPushJob(job)
  }
}

// Production: Use BullMQ
// import { Queue, Worker } from 'bullmq'
// const reminderQueue = new Queue('reminders', { connection: redisConnection })
// const worker = new Worker('reminders', processPushJob, { connection: redisConnection })
```

### Phase 4: Push Worker (Async I/O – OUTSIDE transaction)

```js
// notifications/pushWorker.js
import { PrismaClient } from '@prisma/client'
import { sendWebPush } from './webPushSender.js'
import { sendFCM } from './fcmSender.js'

const prisma = new PrismaClient()

export async function processPushJob(job) {
  try {
    let success = false

    switch (job.platform) {
      case 'WEB':
        success = await sendWebPush(job.deviceToken, {
          title: `⏰ ${job.taskTitle}`,
          body: `Ưu tiên: ${job.taskPriority}`,
          data: { taskId: job.taskId, reminderId: job.reminderId },
        })
        break
      case 'ANDROID':
      case 'IOS':
        success = await sendFCM(job.deviceToken, {
          title: `⏰ ${job.taskTitle}`,
          body: `Ưu tiên: ${job.taskPriority}`,
          priority: 'high',
          data: { taskId: job.taskId, reminderId: job.reminderId },
        })
        break
    }

    // ── Log result (separate DB call, NOT inside transaction) ──
    await prisma.notificationLog.create({
      data: {
        reminderId: job.reminderId,
        deviceId: job.deviceId,
        action: 'SENT',
      },
    })

    // Mark reminder as TRIGGERED (if not already)
    await prisma.reminder.updateMany({
      where: { reminderId: job.reminderId, status: 'PROCESSING' },
      data: { status: 'TRIGGERED' },
    })

  } catch (err) {
    console.error(`[PushWorker] Failed for reminder ${job.reminderId}:`, err)
    // Revert to SCHEDULED for retry on next poll
    await prisma.reminder.updateMany({
      where: { reminderId: job.reminderId, status: 'PROCESSING' },
      data: { status: 'SCHEDULED' },
    })
  }
}
```

### Horizontal Scaling (Single-Instance Lock)

```
Option A (Simple – single instance):
  - In-memory `isRunning` flag prevents overlapping cron runs
  - Sufficient for 1 server deployment

Option B (Multi-instance – Production):
  - Use Redis Redlock for distributed lock
  - Or use DB advisory lock: SELECT pg_advisory_lock(1)
  - Each instance tries to acquire lock before polling

Option C (Recommended for scale):
  - Replace cron+DB polling with BullMQ repeatable jobs
  - BullMQ handles deduplication, concurrency, retries natively
```

---

## 12. Rate Limiting

### Setup

```bash
npm install express-rate-limit
```

### Configuration

```js
// middleware/rateLimiter.js
import rateLimit from 'express-rate-limit'

// General limiter: 100 req / 15 phút / IP
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều request, vui lòng thử lại sau' },
})

// Strict limiter cho endpoints nhạy cảm: 5 req / 15 phút / IP
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều lần thử, vui lòng thử lại sau 15 phút' },
})

// Login limiter: 10 req / 15 phút / IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau' },
})
```

### Mount

```js
// app.js
import { generalLimiter, strictLimiter, loginLimiter } from './middleware/rateLimiter.js'

app.use('/api/v1', generalLimiter)

// authRoutes.js
router.post('/login', loginLimiter, validate(loginRules), authController.login)
router.post('/forgot-password', strictLimiter, validate(forgotRules), authController.forgotPassword)
router.post('/reset-password', strictLimiter, validate(resetRules), authController.resetPassword)
router.post('/register', strictLimiter, validate(registerRules), authController.register)
```

---

## 13. Thứ tự triển khai & Effort

| # | Module | Files | Effort | Ghi chú |
|---|---|---|---|---|
| 1 | Auth (Dual-Token) | 6 | 4h | refreshToken table, hash token, tokenVersion, refresh/logout |
| 2 | User Profile | 5 | 1h | changePassword revoke tokens |
| 3 | Category | 5 | 1h | P2002 handling, unique compound |
| 4 | Task (Core) | 5 | 4h | Smart repeat, soft delete, ownership |
| 5 | Subtask | 5 | 1h | Simple CRUD + toggle |
| 6 | Reminder | 5 | 3h | Snooze clamp, dismiss, due polling |
| 7 | Device + Notification | 9 | 2h | Settings, logs, soft delete |
| 8 | Dashboard + Admin | 6 | 2h | GROUP BY query, admin management |
| 9 | Scheduler + Push Worker | 5 | 4h | Cron→Atomic→Queue→Worker, FCM/WebPush |
| 10 | Rate Limiting + Integration | 3 | 1h | Rate limiter, final wiring |
| 11 | Testing + Bug Fixes | - | 5h | Integration tests, edge cases |

**Tổng estimated: 24–32 hours**

---

## Summary of Fixes Applied

| # | Issue | Fix |
|---|---|---|
| 1.1 | Single token, no revocation | **Dual-Token** (access 15m + refresh 7d), refreshTokens table, tokenVersion |
| 1.2 | No logout | `POST /auth/logout` – delete refresh token |
| 1.3 | Plain-text reset token | **SHA-256 hash** before storing in DB |
| 1.4 | No token revocation on password change | **tokenVersion++** + delete all refreshTokens |
| 2.1 | Category unique not in Prisma | `@@unique([userId, categoryName])` + P2002 catch |
| 2.2 | Prisma P2002 crash | `handlePrismaError()` utility |
| 3.1 | Repeat task uses old dueAt when overdue | **Smart nextDueAt** = `max(dueAt, now) + interval` |
| 3.2 | Hard delete unsafe for tasks | **Soft delete** + notification log check before delete |
| 4.1 | Async I/O inside Prisma transaction | **Refactored: Cron → Atomic DB update → Queue → Worker** |
| 4.2 | No horizontal scaling support | **FOR UPDATE SKIP LOCKED** + `isRunning` guard + Redis Redlock option |
| 5.1 | Snooze can exceed dueAt | **Clamp newRemindAt = min(newRemindAt, task.dueAt)** |
| 6.1 | Dashboard: 4 separate COUNT queries | **Single `GROUP BY` / `FILTER` query** |
| 6.2 | No rate limiting | **express-rate-limit** on login, forgot-password, register |
