# TaskAlarm Backend

> REST API phục vụ ứng dụng quản lý thời gian cá nhân với cơ chế nhắc nhở kiểu báo thức.

## Tech Stack

| Thành phần | Library |
|---|---|
| Runtime | Node.js 20+ LTS |
| Framework | Express.js 5.x |
| ORM | Prisma 6.x |
| Auth | JWT (AccessToken 1h + RefreshToken 7 ngày) |
| Scheduler | node-cron (mỗi 1 phút) |
| Push | web-push (VAPID) + firebase-admin (FCM) |
| Test | Vitest |

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd backend
npm install
```

### 2. Setup Database

**Cách nhanh — Docker Compose (khuyến nghị):**

```bash
docker compose up -d          # Start PostgreSQL
npx prisma db push            # Sync schema
npm run seed                  # Seed roles + admin user
npm run dev                   # Start server
```

**Cách thủ công — PostgreSQL riêng:**

```bash
# Tạo database taskalarm trên PostgreSQL
cp .env.example .env          # Chỉnh DATABASE_URL
npx prisma db push
npm run seed
npm run dev
```

### 3. Test

```bash
npm test                      # Chạy 35 tests
```

Server chạy tại `http://localhost:8080`. Swagger UI tại `/docs`.

## Deploy lên Render (Free)

### Cách 1: Render Blueprint (tự động)

1. Push code lên GitHub
2. Vào [render.com](https://render.com) → New → Blueprint
3. Chọn repo → Render tự đọc `render.yaml`
4. Deploy xong, có URL: `https://taskalarm-api.onrender.com`

### Cách 2: Manual

1. Tạo **Web Service** trên Render
   - Build Command: `npm install && npx prisma generate && npx prisma db push && npm run seed`
   - Start Command: `node src/server.js`
   - Plan: Free
2. Tạo **PostgreSQL** database trên Render
3. Copy Internal Database URL vào env var `DATABASE_URL`
4. Thêm env vars:
   - `JWT_SECRET` = random string
   - `NODE_ENV` = production
   - `PORT` = 10000

### Sau khi deploy

- API URL: `https://taskalarm-api.onrender.com/api/v1`
- Swagger: `https://taskalarm-api.onrender.com/docs`
- Set `VITE_API_URL` trên frontend: `https://taskalarm-api.onrender.com/api/v1`

> ⚠️ Render Free tier: server sẽ sleep sau 15 phút không có request. First request sau sleep mất ~30s.

## API Endpoints

> Prefix: `/api/v1/` | Auth: `Authorization: Bearer <JWT>`

### Authentication

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | Public | Đăng ký |
| POST | `/auth/login` | Public | Đăng nhập → accessToken + refreshToken |
| POST | `/auth/refresh-token` | Public | Cấp lại accessToken |
| POST | `/auth/forgot-password` | Public | Gửi reset token |
| POST | `/auth/reset-password` | Public | Đặt lại mật khẩu |
| POST | `/auth/logout` | User | Đăng xuất |

### User Profile

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/me` | User | Hồ sơ |
| PUT | `/me` | User | Cập nhật |
| PUT | `/me/password` | User | Đổi mật khẩu |
| GET | `/me/stats` | User | Thống kê cá nhân |
| GET | `/me/activity` | User | 5 thông báo gần nhất |

### Categories

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/categories` | User | Danh sách |
| POST | `/categories` | User | Tạo mới |
| PUT | `/categories/:id` | User | Cập nhật |
| PATCH | `/categories/:id/active` | User | Ẩn/hiện |

### Tasks

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/tasks` | User | Danh sách (filter, sort, paginate) |
| POST | `/tasks` | User | Tạo + reminders |
| GET | `/tasks/:id` | User | Chi tiết |
| PUT | `/tasks/:id` | User | Cập nhật |
| DELETE | `/tasks/:id` | User | Xóa |
| POST | `/tasks/:id/complete` | User | Hoàn thành + repeat |
| POST | `/tasks/:id/reopen` | User | Mở lại |
| POST | `/tasks/:id/cancel` | User | Hủy |

### Subtasks

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/tasks/:taskId/subtasks` | User | Danh sách |
| POST | `/tasks/:taskId/subtasks` | User | Thêm |
| PUT | `/tasks/:taskId/subtasks/:id` | User | Sửa |
| POST | `/tasks/:taskId/subtasks/:id/toggle` | User | Toggle |
| DELETE | `/tasks/:taskId/subtasks/:id` | User | Xóa |

### Reminders

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/tasks/:taskId/reminders` | User | Danh sách |
| POST | `/tasks/:taskId/reminders` | User | Thêm (max 5) |
| PUT | `/tasks/:taskId/reminders/:id` | User | Sửa |
| DELETE | `/tasks/:taskId/reminders/:id` | User | Xóa |
| GET | `/reminders/due` | User | Đến hạn |
| POST | `/reminders/:id/snooze` | User | Hoãn (max 3) |
| POST | `/reminders/:id/dismiss` | User | Tắt |

### Devices & Notifications

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/devices` | User | Đăng ký thiết bị |
| GET | `/devices` | User | Danh sách |
| DELETE | `/devices/:id` | User | Gỡ |
| GET | `/devices/settings` | User | Cài đặt |
| PUT | `/devices/settings` | User | Cập nhật |
| GET | `/devices/logs` | User | Lịch sử |

### Dashboard & Admin

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/dashboard` | User | Thống kê cá nhân |
| GET | `/admin/dashboard` | Admin | Tổng quan hệ thống |
| GET | `/admin/users` | Admin | Danh sách user |
| POST | `/admin/users/:id/lock` | Admin | Khóa |
| POST | `/admin/users/:id/unlock` | Admin | Mở khóa |

## Seed Accounts

| Email | Password | Role |
|---|---|---|
| admin@taskalarm.com | Admin@123 | ADMIN |

## Project Structure

```
backend/
├── src/
│   ├── app.js              # Express app
│   ├── server.js            # Entry point
│   ├── config/              # Config + Prisma singleton
│   ├── middleware/           # auth, authorize, validate, errorHandler
│   ├── controllers/         # Route handlers
│   ├── services/            # Business logic
│   ├── repositories/        # Prisma queries
│   ├── routes/              # Route definitions
│   ├── schedulers/          # node-cron reminder scanner
│   ├── notifications/       # Web Push + FCM senders
│   ├── dto/                 # Validation + response format
│   ├── utils/               # ApiError, catchAsync, dateUtils, pagination
│   └── constants/           # Enums
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.js              # Seed data
├── tests/                   # Vitest test suite (35 tests)
└── docker-compose.yml       # PostgreSQL setup
```

## Business Rules

| Rule | Mô tả |
|---|---|
| BR-09 | Max 5 reminders/task |
| BR-10 | remindAt ≤ dueAt |
| BR-11 | Complete/Cancel → cancel reminders |
| BR-13 | Snooze max 3 times |
| BR-15 | Repeat → auto-create next task |
| ERD-R-03 | Category name unique per user |
