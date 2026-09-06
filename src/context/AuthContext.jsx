import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '../services/authService'

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
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  // Khôi phục phiên từ accessToken (localStorage) → xác thực lại qua GET /me
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
