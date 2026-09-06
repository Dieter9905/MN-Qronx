// Phiên đăng nhập frontend – lưu user + accessToken + refreshToken
// vào localStorage dưới một key duy nhất 'mnq:session'.

import { setTokens, clearTokens } from './apiClient'

const SESSION_KEY = 'mnq:session'

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    clearTokens()
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  if (session.accessToken || session.refreshToken) {
    setTokens(session.accessToken, session.refreshToken)
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  clearTokens()
}

export function sessionUser() {
  return getSession()?.user || null
}

export default sessionUser
