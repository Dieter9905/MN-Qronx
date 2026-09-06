// API Client thật – kết nối tới TaskAlarm Backend (Express + Prisma)
// Envelope chuẩn: { success, message, data } / { success, false, message, errors }
//
// Auth: accessToken lưu localStorage 'mnq:accessToken', refreshToken 'mnq:refreshToken'.
// Nếu request trả 401 (token hết hạn), tự động gọi /auth/refresh-token rồi thử lại 1 lần.

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://taskalarm-api.onrender.com/api/v1'

const BASE_URL = API_BASE_URL

export function getAccessToken() {
  return localStorage.getItem('mnq:accessToken')
}

export function getRefreshToken() {
  return localStorage.getItem('mnq:refreshToken')
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem('mnq:accessToken', accessToken)
  if (refreshToken) localStorage.setItem('mnq:refreshToken', refreshToken)
}

export function clearTokens() {
  localStorage.removeItem('mnq:accessToken')
  localStorage.removeItem('mnq:refreshToken')
}

/**
 * Gọi endpoint thật.
 * @returns {Promise<{success:boolean, message:string, data?:any, errors?:object}>}
 *          Luôn resolve về envelope; chỉ throw khi lỗi mạng (không kết nối được server).
 */
export async function api(method, path, { body, query } = {}) {
  let url = BASE_URL + path
  if (query && Object.keys(query).length) {
    const clean = {}
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    })
    const params = new URLSearchParams(clean).toString()
    if (params) url += `?${params}`
  }

  const doFetch = (token) => {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const opts = { method, headers }
    if (body !== undefined) opts.body = JSON.stringify(body)
    return fetch(url, opts)
  }

  let res
  try {
    res = await doFetch(getAccessToken())
  } catch {
    throw new Error('Không thể kết nối server. Vui lòng kiểm tra kết nối mạng.')
  }

  // Token hết hạn → refresh 1 lần rồi thử lại
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const ok = await refreshAccessToken()
    if (ok) {
      try {
        res = await doFetch(getAccessToken())
      } catch {
        throw new Error('Không thể kết nối server. Vui lòng kiểm tra kết nối mạng.')
      }
    }
  }

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (res.ok) {
    return data || { success: true, message: 'Thao tác thành công', data: null }
  }

  // Lỗi nghiệp vụ từ backend – trả về envelope để UI hiển thị message/errors
  return (
    data || {
      success: false,
      message: `Lỗi máy chủ (${res.status})`,
    }
  )
}

async function refreshAccessToken() {
  const rt = getRefreshToken()
  if (!rt) {
    clearTokens()
    return false
  }
  try {
    const r = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
    const payload = await r.json()
    if (r.ok && payload.success && payload.data?.accessToken) {
      setTokens(payload.data.accessToken, rt)
      return true
    }
    clearTokens()
    return false
  } catch {
    clearTokens()
    return false
  }
}

export default api
