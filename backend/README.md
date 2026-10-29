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

### 3. Kiểm tra gửi thư

```bash
npm run mail:test -- ban@example.com   # gửi thử qua đường đang cấu hình
npm run mail:resend                    # xác thực tên miền + in bản ghi DNS cho Resend
```

> Chỉ còn hai đường gửi: **Resend** (API HTTPS) và **SMTP**. `MAIL_TRANSPORT=auto`
> dùng Resend nếu có `RESEND_API_KEY`, không thì SMTP. Chi tiết và cách khắc phục:
> [docs/email-domain-setup.md](../docs/email-domain-setup.md).

### 4. Test

```bash
npm test                      # Chạy 35 tests
```

Server chạy tại `http://localhost:8080`. Swagger UI tại `/docs`.

## Deploy lên VPS (production)

Production bây giờ chạy trên VPS riêng (đã cài Node 22, Nginx, PostgreSQL 16):

- Code: `/opt/mn-qronx` trên VPS, backend chạy systemd service `mn-qronx`
  (`/etc/systemd/system/mn-qronx.service`), DB Postgres local trên VPS (`qronx`).
- `DATABASE_URL`, `JWT_SECRET`, `PORT=8081`, `NODE_ENV=production`,
  `FRONTEND_URL=https://mn-qronx.id.vn` đặt trong `/opt/mn-qronx/backend/.env` (chmod 600).
- Start: `systemctl start mn-qronx` — log xem bằng `journalctl -u mn-qronx -f`.
- Nginx serve frontend `/var/www/qronx` + proxy `/api` và `/docs` về `127.0.0.1:8081`,
  HTTPS bằng certbot (tự gia hạn).
- API URL: `https://mn-qronx.id.vn/api/v1` · Swagger: `https://mn-qronx.id.vn/docs`
- Frontend build với `VITE_API_URL=https://mn-qronx.id.vn/api/v1` rồi copy `dist/`
  vào `/var/www/qronx`.

> Không còn dùng Render nữa — server VPS luôn chạy, không sleep, cron scheduler
> trong process hoạt động bình thường.

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
