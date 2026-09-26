import app from '../src/app.js'
import prisma from '../src/config/prisma.js'
import jwt from 'jsonwebtoken'
import config from '../src/config/index.js'

let server
let PORT
const BASE = () => `http://127.0.0.1:${PORT}/api/v1`

// ─── Server lifecycle ──────────────────────────────────

export async function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      PORT = server.address().port
      resolve()
    })
  })
}

export async function stopServer() {
  return new Promise((resolve) => {
    if (server) server.close(resolve)
    else resolve()
  })
}

// ─── HTTP helpers ──────────────────────────────────────

export async function api(method, path, { body, token, query } = {}) {
  let url = `${BASE()}${path}`
  if (query) {
    const params = new URLSearchParams(query).toString()
    url += `?${params}`
  }

  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(url, opts)
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

// ─── Auth helpers ──────────────────────────────────────

/**
 * Bước 1 của đăng ký: xin mã xác nhận qua email.
 * Backend trả devCode khi KHÔNG gửi được email (đúng cảnh chạy test), nhờ vậy
 * test không phụ thuộc vào dịch vụ email bên ngoài.
 */
export async function requestVerificationCode(email) {
  return api('POST', '/auth/send-verification-code', { body: { email } })
}

/** Đăng ký đầy đủ 2 bước: xin mã xác nhận email → đăng ký bằng mã đó. */
export async function register(email, password, fullName) {
  const codeRes = await requestVerificationCode(email)
  const verificationCode = codeRes.data?.data?.devCode
  return api('POST', '/auth/register', {
    body: { email, password, fullName, phoneNumber: '0901234567', verificationCode },
  })
}

export async function login(email, password) {
  return api('POST', '/auth/login', { body: { email, password } })
}

export async function getAccessToken(refreshToken) {
  return api('POST', '/auth/refresh-token', { body: { refreshToken } })
}

export function makeToken(userId, role = 'USER') {
  return jwt.sign({ id: userId, role }, config.jwt.secret, { expiresIn: '1h' })
}

// ─── DB helpers ────────────────────────────────────────

/**
 * GET thô (không parse JSON) — dùng cho endpoint trả nhị phân như ảnh đính kèm
 * trong hội thoại hỗ trợ, nơi cần cả status, content-type và bytes thật.
 */
export async function rawGet(path, token) {
  const res = await fetch(`${BASE()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const buffer = Buffer.from(await res.arrayBuffer())
  return { status: res.status, contentType: res.headers.get('content-type'), buffer }
}

// ─── DB helpers ────────────────────────────────────────

export async function cleanup() {
  // ⚠️ CHỈ xoá dữ liệu của tài khoản test (`*@example.com`).
  // Trước đây các lệnh deleteMany() không có `where` nên mỗi lần chạy test là
  // xoá sạch công việc / danh mục / nhắc nhở / thiết bị của MỌI người dùng
  // trong DATABASE_URL — mà biến này đang trỏ vào Postgres production.
  const testUser = { user: { email: { endsWith: '@example.com' } } }
  const testUserTask = { task: { user: { email: { endsWith: '@example.com' } } } }

  // Hội thoại hỗ trợ (tin nhắn + ảnh tự xoá theo khoá ngoại)
  await prisma.supportConversation.deleteMany({ where: testUser })
  await prisma.notificationLog.deleteMany({ where: { reminder: testUserTask } })
  await prisma.notificationSetting.deleteMany({ where: testUser })
  await prisma.device.deleteMany({ where: testUser })
  await prisma.refreshToken.deleteMany({ where: testUser })
  await prisma.passwordResetRequest.deleteMany({ where: testUser })
  await prisma.reminder.deleteMany({ where: testUserTask })
  await prisma.subtask.deleteMany({ where: testUserTask })
  await prisma.task.deleteMany({ where: testUser })
  await prisma.category.deleteMany({ where: testUser })
  await prisma.emailVerificationCode.deleteMany({ where: { email: { endsWith: '@example.com' } } })
  // Keep roles and admin user
}

export { prisma }
