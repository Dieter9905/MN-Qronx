// Mô phỏng tầng HTTP: envelope chuẩn { success, message, data } / { success, message, errors }
// theo API Specification (BA/05_MN-Qronx_API_Specification.md)

import { getDb, getSession } from '../lib/db'

export function ok(message = 'Thao tác thành công', data = null) {
  return { success: true, message, data }
}

export function fail(message, errors = null) {
  return { success: false, message, errors }
}

export async function request(fn, { latency = 250 } = {}) {
  await new Promise((r) => setTimeout(r, latency * (0.6 + Math.random() * 0.8)))
  return fn()
}

export class ApiError extends Error {
  constructor(message, errors = null) {
    super(message)
    this.name = 'ApiError'
    this.errors = errors
  }
}

export function requireAuth(session) {
  if (!session?.user) {
    throw new ApiError('Bạn cần đăng nhập để thực hiện thao tác này', { auth: 'Chưa xác thực' })
  }
  const user = getDb().users.find((u) => u.id === session.user.id)
  if (!user) throw new ApiError('Phiên đăng nhập không hợp lệ', { auth: 'Chưa xác thực' })
  if (!user.isActive) throw new ApiError('Tài khoản của bạn đã bị khóa', { auth: 'Tài khoản đã bị khóa' })
  return { user, session }
}

// Sinh JWT giả (chỉ phục vụ demo frontend, không phải JWT thật)
function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fakeToken(user) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64UrlEncode(
    JSON.stringify({ sub: user.id, name: user.fullName, role: user.role, exp: Date.now() + 7 * 864e5 })
  )
  return `${header}.${payload}.demo-signature`
}
