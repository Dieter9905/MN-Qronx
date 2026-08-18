import { db, getSession, setSession } from '../lib/db'
import { ok, fail, request, fakeToken, ApiError } from './api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function publicUser(user) {
  const { password, ...pub } = user
  return pub
}

// POST /api/v1/auth/register
export function register({ fullName, email, password }) {
  return request(() => {
    if (!fullName?.trim()) return fail('Vui lòng nhập họ tên', { fullName: 'Họ tên không được để trống' })
    if (!email?.trim()) return fail('Vui lòng nhập email', { email: 'Email không được để trống' })
    if (!EMAIL_RE.test(email.trim())) return fail('Email không hợp lệ', { email: 'Email không đúng định dạng' })
    if (!password || password.length < 6) {
      return fail('Mật khẩu phải có ít nhất 6 ký tự', { password: 'Mật khẩu phải có ít nhất 6 ký tự' })
    }
    if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return fail('Email đã được sử dụng', { email: 'Email này đã tồn tại trong hệ thống' })
    }
    const user = {
      id: db.nextId(db.users),
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      phoneNumber: '',
      role: 'USER',
      isActive: true,
      createdAt: db.nowIso(),
    }
    db.saveUsers([...db.users, user])
    // Tạo cài đặt thông báo mặc định cho User mới
    db.saveSettings([
      ...db.notificationSettings,
      { userId: user.id, alarmSound: 'classic', defaultSnoozeMinutes: 10, vibrationEnabled: true, updatedAt: db.nowIso() },
    ])
    return ok('Đăng ký thành công', publicUser(user))
  }, { latency: 400 })
}

// POST /api/v1/auth/login
export function login({ email, password }) {
  return request(() => {
    const user = db.users.find((u) => u.email.toLowerCase() === (email || '').trim().toLowerCase())
    if (!user || user.password !== password) {
      return fail('Email hoặc mật khẩu không đúng')
    }
    if (!user.isActive) return fail('Tài khoản của bạn đã bị khóa')
    const token = fakeToken(user)
    const session = { accessToken: token, user: publicUser(user) }
    setSession(session)
    return ok('Đăng nhập thành công', session)
  }, { latency: 350 })
}

// POST /api/v1/auth/forgot-password
export function forgotPassword({ email }) {
  return request(() => {
    if (!email?.trim()) return fail('Vui lòng nhập email', { email: 'Email không được để trống' })
    if (!EMAIL_RE.test(email.trim())) return fail('Email không hợp lệ', { email: 'Email không đúng định dạng' })
    // Không tiết lộ email có tồn tại hay không (tránh dò email – theo wireframe)
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (user) {
      // Mô phỏng gửi email – token demo ghi vào session để mô phỏng link trong email
      const resetToken = `reset-${user.id}-${Date.now().toString(36)}`
      localStorage.setItem('mnq:resetToken', resetToken)
    }
    return ok('Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư của bạn.')
  }, { latency: 500 })
}

// POST /api/v1/auth/reset-password
export function resetPassword({ resetToken, password, confirmPassword }) {
  return request(() => {
    const stored = localStorage.getItem('mnq:resetToken')
    if (!resetToken || resetToken !== stored) {
      return fail('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')
    }
    if (!password || password.length < 6) {
      return fail('Mật khẩu phải có ít nhất 6 ký tự', { password: 'Mật khẩu phải có ít nhất 6 ký tự' })
    }
    if (password !== confirmPassword) {
      return fail('Mật khẩu xác nhận không khớp', { confirmPassword: 'Xác nhận mật khẩu không khớp' })
    }
    const id = Number(resetToken.split('-')[1])
    const users = db.users.map((u) => (u.id === id ? { ...u, password } : u))
    db.saveUsers(users)
    localStorage.removeItem('mnq:resetToken')
    return ok('Đặt lại mật khẩu thành công. Bạn có thể đăng nhập với mật khẩu mới.')
  }, { latency: 400 })
}

export function logout() {
  setSession(null)
}

export function currentUser() {
  const session = getSession()
  if (!session?.user) return null
  const user = db.users.find((u) => u.id === session.user.id)
  return user ? publicUser(user) : null
}

export function getResetToken() {
  return localStorage.getItem('mnq:resetToken')
}

export function throwIfLocked() {
  const session = getSession()
  if (!session?.user) return
  const user = db.users.find((u) => u.id === session.user.id)
  if (user && !user.isActive) {
    setSession(null)
    throw new ApiError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.')
  }
}
