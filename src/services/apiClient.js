// API Client thật – kết nối tới TaskAlarm Backend (Express + Prisma)
// Envelope chuẩn: { success, message, data } / { success, false, message, errors }
//
// Auth: accessToken lưu localStorage 'mnq:accessToken', refreshToken 'mnq:refreshToken'.
// Nếu request trả 401 (token hết hạn), tự động gọi /auth/refresh-token rồi thử lại 1 lần.

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://taskalarm-api.onrender.com/api/v1'

const BASE_URL = API_BASE_URL

/**
 * Đánh thức máy chủ (fire-and-forget) trước khi người dùng thật sự cần.
 * Web service gói free của Render "ngủ" sau 15 phút không có request, lần truy
 * cập sau phải chờ khởi động ~30-60 giây. Gọi sớm ngay khi mở app để máy chủ
 * boot trong lúc người dùng còn đang đọc trang hoặc gõ mật khẩu.
 */
export function warmUpServer() {
  try {
    return fetch(`${BASE_URL}/health`, { cache: 'no-store' }).catch(() => {})
  } catch {
    return Promise.resolve()
  }
}

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

// ID thiết bị ổn định (dùng cho chống lạm dụng mời bạn bè: 1 IP + 1 thiết bị = 1 tài khoản)
export function getDeviceId() {
  let id = localStorage.getItem('mnq:deviceId')
  if (!id) {
    id =
      'dev-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 10) +
      '-' +
      Math.random().toString(36).slice(2, 10)
    localStorage.setItem('mnq:deviceId', id)
  }
  return id
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
    headers['X-Device-Id'] = getDeviceId()
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

/**
 * Tải dữ liệu nhị phân (vd: file âm thanh MP3) kèm token xác thực.
 * @returns {Promise<Blob>}
 */
export async function apiBlob(path) {
  const token = getAccessToken()
  const res = await fetch(BASE_URL + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu từ máy chủ (${res.status})`)
  }
  return res.blob()
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
