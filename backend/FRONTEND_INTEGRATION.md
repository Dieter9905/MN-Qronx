# Frontend Integration Guide

> Hướng dẫn cho Frontend team kết nối với TaskAlarm Backend API

## Quick Start

```bash
# 1. Backend đã deploy trên VPS riêng (xem README.md)
# URL: https://mn-qronx.id.vn/api/v1

# 2. Hoặc chạy local:
cd backend && docker compose up -d && npm run seed && npm run dev
# Server: http://localhost:8080
```

## Base URL

| Environment | URL |
|---|---|
| Local | `http://localhost:8080/api/v1` |
| Production | `https://mn-qronx.id.vn/api/v1` |

## Swagger Docs

Mở `http://localhost:8080/docs` (hoặc production URL + `/docs`) để xem toàn bộ API.

## Auth Flow

```js
// 1. Register
const res = await fetch(`${BASE_URL}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fullName, email, password })
})
// Response: { success: true, data: { id, fullName, email, role, ... } }

// 2. Login → nhận accessToken + refreshToken
const loginRes = await fetch(`${BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})
const { accessToken, refreshToken, user } = loginRes.data.data

// 3. Lưu token
localStorage.setItem('accessToken', accessToken)
localStorage.setItem('refreshToken', refreshToken)

// 4. Gọi API có auth
const profile = await fetch(`${BASE_URL}/me`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
})

// 5. Refresh khi token hết hạn (401)
const refreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
})
// Response: { data: { accessToken: 'new-token' } }
```

## API Client Pattern

Tạo file `src/services/apiClient.js`:

```js
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

async function api(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${path}`, opts)
  const data = await res.json()

  // Auto refresh token on 401
  if (res.status === 401 && !path.includes('/auth/')) {
    const refreshed = await refreshToken()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed}`
      const retry = await fetch(`${BASE_URL}${path}`, { ...opts, headers })
      return retry.json()
    }
  }

  return data
}

async function refreshToken() {
  const rt = localStorage.getItem('refreshToken')
  if (!rt) return null
  const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt })
  })
  if (res.ok) {
    const { accessToken } = (await res.json()).data
    localStorage.setItem('accessToken', accessToken)
    return accessToken
  }
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  return null
}

export default api
```

## Response Format

Tất cả responses đều theo format:

```json
// Success
{ "success": true, "message": "Thao tác thành công", "data": { ... } }

// Error
{ "success": false, "message": "Lỗi ...", "errors": { "field": "chi tiết" } }

// Paginated
{ "success": true, "data": { "items": [...], "total": 45, "page": 1, "pageSize": 20 } }
```

## Response Shapes (Đã transform sẵn cho Frontend)

### User

```json
{
  "id": 1,
  "fullName": "Nguyen Van A",
  "email": "a@example.com",
  "phoneNumber": "0901234567",
  "role": "USER",
  "isActive": true,
  "createdAt": "2026-08-21T..."
}
```

### Category

```json
{
  "id": 1,
  "userId": 1,
  "name": "Cong viec",
  "color": "#FF5722",
  "isActive": true,
  "taskCount": 5
}
```

### Task

```json
{
  "id": 101,
  "userId": 1,
  "title": "Hoan thanh bao cao",
  "description": "...",
  "priority": "HIGH",
  "status": "TODO",
  "dueAt": "2026-08-23T...",
  "repeatType": "NONE",
  "overdue": false,
  "category": { "id": 1, "name": "Cong viec", "color": "#FF5722" },
  "subtasks": [
    { "id": 1, "content": "Thu thap du lieu", "isCompleted": true }
  ],
  "reminders": [
    { "id": 1, "remindAt": "2026-08-22T...", "status": "SCHEDULED" }
  ]
}
```

### Dashboard

```json
{
  "todayCount": 3,
  "overdueCount": 2,
  "completedCount": 15,
  "upcomingCount": 5,
  "todayTasks": [ /* Task[] */ ],
  "overdueTasks": [ /* Task[] */ ]
}
```

## Mapping từ Mock DB sang Real API

### authService.js

```js
// TRƯỚC (mock)
import { db, getSession, setSession } from '../lib/db'
export function login({ email, password }) {
  return request(() => {
    const user = db.users.find(...)
    return ok('Thao tác thành công', { accessToken: token, user })
  })
}

// SAU (real API)
import api from './apiClient'
export async function login({ email, password }) {
  const res = await api('POST', '/auth/login', { body: { email, password } })
  if (!res.success) return res
  localStorage.setItem('accessToken', res.data.accessToken)
  localStorage.setItem('refreshToken', res.data.refreshToken)
  return res
}
```

### categoryService.js

```js
// TRƯỚC
export function getCategories() {
  return request(() => {
    const { user } = requireAuth(currentSession())
    return ok('Thao tác thành công', db.categories.filter(...))
  })
}

// SAU
import api from './apiClient'
export async function getCategories() {
  return api('GET', '/categories', { token: localStorage.getItem('accessToken') })
}
```

### taskService.js

```js
// TRƯỚC
export function getTasks(filters) {
  return request(() => {
    // ... 20 dòng logic filter/sort/paginate trên mock DB
  })
}

// SAU - Backend xử lý filter/sort/paginate
import api from './apiClient'
export async function getTasks(filters = {}) {
  const query = new URLSearchParams(filters).toString()
  return api('GET', `/tasks?${query}`, { token: localStorage.getItem('accessToken') })
}
```

### dashboardService.js

```js
// TRƯỚC - 30 dòng tính count thủ công
export function getDashboard() {
  return request(() => {
    const todayCount = mine.filter(...).length
    // ...
  })
}

// SAU - 1 dòng
import api from './apiClient'
export async function getDashboard() {
  return api('GET', '/dashboard', { token: localStorage.getItem('accessToken') })
}
```

## Danh sách tất cả endpoints

### Auth (Public)

| Method | Endpoint | Body |
|---|---|---|
| POST | `/auth/register` | `{ fullName, email, password }` |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/refresh-token` | `{ refreshToken }` |
| POST | `/auth/forgot-password` | `{ email }` |
| POST | `/auth/reset-password` | `{ resetToken, newPassword }` |

### Auth (Require Login)

| Method | Endpoint | Body |
|---|---|---|
| POST | `/auth/logout` | - |

### User Profile

| Method | Endpoint | Body/Query |
|---|---|---|
| GET | `/me` | - |
| PUT | `/me` | `{ fullName?, phoneNumber?, avatarUrl? }` |
| PUT | `/me/password` | `{ currentPassword, newPassword }` |
| GET | `/me/stats` | - |
| GET | `/me/activity` | - |

### Categories

| Method | Endpoint | Body/Query |
|---|---|---|
| GET | `/categories` | `?isActive=true` |
| POST | `/categories` | `{ categoryName, colorCode? }` |
| PUT | `/categories/:id` | `{ categoryName?, colorCode? }` |
| PATCH | `/categories/:id/active` | `{ isActive: bool }` |

### Tasks

| Method | Endpoint | Body/Query |
|---|---|---|
| GET | `/tasks` | `?status=&priority=&categoryId=&keyword=&sort=&page=&pageSize=` |
| POST | `/tasks` | `{ title, description?, categoryId?, priority?, dueAt, repeatType?, reminders? }` |
| GET | `/tasks/:id` | - |
| PUT | `/tasks/:id` | `{ title?, description?, priority?, dueAt?, repeatType? }` |
| DELETE | `/tasks/:id` | - |
| POST | `/tasks/:id/complete` | - |
| POST | `/tasks/:id/reopen` | - |
| POST | `/tasks/:id/cancel` | - |

### Subtasks

| Method | Endpoint | Body |
|---|---|---|
| GET | `/tasks/:taskId/subtasks` | - |
| POST | `/tasks/:taskId/subtasks` | `{ content }` |
| PUT | `/tasks/:taskId/subtasks/:id` | `{ content }` |
| POST | `/tasks/:taskId/subtasks/:id/toggle` | - |
| DELETE | `/tasks/:taskId/subtasks/:id` | - |

### Reminders

| Method | Endpoint | Body/Query |
|---|---|---|
| GET | `/tasks/:taskId/reminders` | - |
| POST | `/tasks/:taskId/reminders` | `{ remindAt }` |
| PUT | `/tasks/:taskId/reminders/:id` | `{ remindAt }` |
| DELETE | `/tasks/:taskId/reminders/:id` | - |
| GET | `/reminders/due` | - |
| POST | `/reminders/:id/snooze` | `{ snoozeMinutes? }` |
| POST | `/reminders/:id/dismiss` | - |

### Devices

| Method | Endpoint | Body/Query |
|---|---|---|
| POST | `/devices` | `{ deviceToken, platform }` |
| GET | `/devices` | - |
| DELETE | `/devices/:id` | - |
| GET | `/devices/settings` | - |
| PUT | `/devices/settings` | `{ alarmSound?, defaultSnoozeMinutes?, vibrationEnabled? }` |
| GET | `/devices/logs` | `?from=&to=&action=&page=&pageSize=` |

### Dashboard

| Method | Endpoint | Query |
|---|---|---|
| GET | `/dashboard` | - |

### Admin (Require ADMIN role)

| Method | Endpoint | Body/Query |
|---|---|---|
| GET | `/admin/dashboard` | - |
| GET | `/admin/users` | `?keyword=&page=&pageSize=` |
| POST | `/admin/users/:id/lock` | - |
| POST | `/admin/users/:id/unlock` | - |

## Seed Accounts

| Email | Password | Role |
|---|---|---|
| admin@taskalarm.com | Admin@123 | ADMIN |
| demo@taskalarm.com | User@1234 | USER |

## Environment Variables

```env
# Frontend .env
VITE_API_URL=http://localhost:8080/api/v1       # Local
VITE_API_URL=https://mn-qronx.id.vn/api/v1  # Production
```

## Error Handling

```js
try {
  const res = await api('POST', '/tasks', { body: taskData })
  if (!res.success) {
    // Hiển thị lỗi từ res.errors hoặc res.message
    showToast(res.message)
  } else {
    // Thành công
    navigate('/tasks')
  }
} catch (err) {
  // Network error
  showToast('Không thể kết nối server')
}
```
