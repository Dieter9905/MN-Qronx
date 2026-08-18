import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    // Kiểm tra phiên đã lưu (localStorage) khi app khởi động
    try {
      const u = authService.currentUser()
      if (u) setUser(u)
    } catch {
      authService.logout()
    } finally {
      setInitializing(false)
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const res = await authService.login(credentials)
    if (res.success) setUser(res.data.user)
    return res
  }, [])

  const register = useCallback(async (payload) => {
    return authService.register(payload)
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
  }, [])

  const refresh = useCallback(() => {
    setUser(authService.currentUser())
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
