import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '../services/authService'
import { syncPushSubscription } from '../lib/push'

const AuthContext = createContext(null)

// Gói hiệu lực cho UI: gói trả phí đã quá hạn (planExpiresAt) tính như FREE
// để mọi giới hạn Plus/Pro trên giao diện ngừng ngay lập tức.
function applyEffectivePlan(u) {
  if (!u) return u
  const paid = u.plan === 'PLUS' || u.plan === 'PRO'
  if (paid && u.planExpiresAt && new Date(u.planExpiresAt) <= new Date()) {
    return { ...u, plan: 'FREE' }
  }
  return u
}

export function AuthProvider({ children }) {
  // Khởi tạo ngay từ phiên đã lưu trong localStorage để app mở tức thì.
  // Nếu để `initializing = true` rồi chờ GET /me, khi backend đang khởi động
  // (web service gói free ngủ sau 15 phút) người dùng sẽ nhìn màn hình
  // "đang khôi phục phiên" hàng chục giây — đúng lỗi "đăng nhập load lâu".
  const [user, setUser] = useState(() => applyEffectivePlan(authService.currentUser()))

  // Có người dùng đăng nhập thì đảm bảo subscription Web Push còn sống (endpoint
  // có thể đã đổi từ lần mở trước) — nhờ vậy máy chủ vẫn gửi nhắc nhở được khi
  // họ đóng trình duyệt. Âm thầm, không chặn luồng đăng nhập.
  useEffect(() => {
    if (!user) return undefined
    let alive = true
    const sync = async () => {
      if (!alive) return
      await syncPushSubscription()
    }
    sync().catch(() => {})
    return () => {
      alive = false
    }
  }, [user])
  const [initializing, setInitializing] = useState(() => !authService.currentUser())

  // Xác thực lại phiên ở chế độ ngầm (không chặn giao diện).
  // Nếu token đã hết hạn, /me trả về null → tự đăng xuất và chuyển về /login.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const u = await authService.fetchCurrentUser()
        if (!cancelled) setUser(applyEffectivePlan(u))
      } catch {
        authService.logout()
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const res = await authService.login(credentials)
    if (res.success) setUser(applyEffectivePlan(res.data.user))
    return res
  }, [])

  const register = useCallback(async (payload) => {
    return authService.register(payload)
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    const u = await authService.fetchCurrentUser()
    setUser(applyEffectivePlan(u))
    return u
  }, [])

  const value = useMemo(
    () => ({ user, initializing, login, register, logout, refresh }),
    [user, initializing, login, register, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong AuthProvider')
  return ctx
}
