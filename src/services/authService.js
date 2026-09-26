import api, { getAccessToken, getRefreshToken, API_BASE_URL } from './apiClient'
import { getSession, setSession, clearSession } from './session'
import { clearQueryCache } from '../lib/useCachedQuery'
import { clearChatMessages } from '../lib/chatHistory'

// Chuẩn hoá user trả về từ backend (có thể là {userId,...} hoặc {id,...})
// về shape frontend quen dùng: { id, fullName, email, phoneNumber, avatarUrl, role, isActive, createdAt }
function normalizeUser(u) {
  if (!u) return null
  return {
    id: u.id ?? u.userId,
    fullName: u.fullName,
    email: u.email,
    phoneNumber: u.phoneNumber ?? '',
    avatarUrl: u.avatarUrl ?? null,
    role: u.role?.roleName ?? u.role ?? 'USER',
    plan: u.plan ?? 'FREE',
    planStartedAt: u.planStartedAt ?? null,
    planExpiresAt: u.planExpiresAt ?? null,
    points: u.points ?? 0,
    loginStreak: u.loginStreak ?? 0,
    inviteCode: u.inviteCode ?? null,
    isActive: u.isActive ?? true,
    createdAt: u.createdAt,
  }
}

// POST /api/v1/auth/send-verification-code
// Gửi mã xác nhận email (1 email = 1 tài khoản) → register yêu cầu mã này
export async function sendVerificationCode(email) {
  return api('POST', '/auth/send-verification-code', { body: { email } })
}

// POST /api/v1/auth/register (yêu cầu verificationCode đã gửi qua email)
export async function register({ fullName, email, password, phoneNumber, inviteCode, verificationCode } = {}) {
  const res = await api('POST', '/auth/register', {
    body: {
      fullName,
      email,
      password,
      phoneNumber,
      inviteCode: inviteCode || undefined,
      verificationCode,
    },
  })
  if (res.success) res.data = normalizeUser(res.data)
  return res
}

// POST /api/v1/auth/login
export async function login({ email, password } = {}) {
  const res = await api('POST', '/auth/login', { body: { email, password } })
  if (!res.success) return res
  const user = normalizeUser(res.data?.user)
  const session = {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
    user,
  }
  setSession(session)
  // Giữ shape cũ mà UI đang dùng: data.user = thông tin người dùng
  return { success: true, message: res.message, data: session }
}

// POST /api/v1/auth/logout – xoá phiên local ngay, revoke refresh token trên server (best-effort)
export async function logout() {
  const token = getAccessToken()
  clearSession()
  // Xoá luôn dữ liệu đã lưu để máy dùng chung không lộ số liệu của tài khoản cũ
  clearQueryCache()
  // và cả lịch sử hội thoại với Trợ lý AI (có thể chứa tên công việc riêng tư)
  clearChatMessages()
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
    } catch {
      /* best effort */
    }
  }
}

// GET /api/v1/me – user hiện tại (để khôi phục phiên khi mở app)
export async function fetchCurrentUser() {
  const token = getAccessToken()
  if (!token) return null
  const res = await api('GET', '/me')
  if (!res.success) {
    // Token không hợp lệ/hết hạn (đã thử refresh) → xoá phiên
    clearSession()
    return null
  }
  const user = normalizeUser(res.data)
  // Luôn giữ token đang hoạt động – đọc lại sau call (api() có thể đã refresh token)
  setSession({ accessToken: getAccessToken() || token, refreshToken: getRefreshToken(), user })
  return user
}

// Đồng bộ – trả user từ phiên đã lưu (không gọi mạng)
export function currentUser() {
  return getSession()?.user || null
}

// PUT /api/v1/me – cập nhật hồ sơ
export async function updateProfile(payload = {}) {
  const res = await api('PUT', '/me', { body: payload })
  if (res.success) {
    res.data = normalizeUser(res.data)
    // Cập nhật user trong phiên hiện tại
    const session = getSession()
    if (session) setSession({ ...session, user: res.data })
  }
  return res
}

// PUT /api/v1/me/password – đổi mật khẩu
export async function changePassword({ currentPassword, newPassword } = {}) {
  return api('PUT', '/me/password', {
    body: { currentPassword, newPassword },
  })
}

// POST /api/v1/auth/forgot-password
// Khi backend chạy ở môi trường dev, response trả kèm resetToken để test
// (production phải gửi qua email) – ta lưu tạm để mô phỏng link trong email.
export async function forgotPassword({ email } = {}) {
  const res = await api('POST', '/auth/forgot-password', { body: { email } })
  if (res.success && res.data?.resetToken) {
    localStorage.setItem('mnq:resetToken', res.data.resetToken)
  }
  return res
}

// POST /api/v1/auth/reset-password
export async function resetPassword({ resetToken, newPassword } = {}) {
  return api('POST', '/auth/reset-password', {
    body: { resetToken, newPassword },
  })
}

// Reset token demo cho giao diện (backend log khi dev; UI mô phỏng)
export function getResetToken() {
  return localStorage.getItem('mnq:resetToken')
}

export function setDemoResetToken(token) {
  if (token) localStorage.setItem('mnq:resetToken', token)
  else localStorage.removeItem('mnq:resetToken')
}
