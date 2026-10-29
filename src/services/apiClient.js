// API Client thật – kết nối tới TaskAlarm Backend (Express + Prisma)
// Envelope chuẩn: { success, message, data } / { success, false, message, errors }
//
// Auth: accessToken lưu localStorage 'mnq:accessToken', refreshToken 'mnq:refreshToken'.
// Nếu request trả 401 (token hết hạn), tự động gọi /auth/refresh-token rồi thử lại 1 lần.

// Production chạy trên VPS riêng (https://mn-qronx.id.vn, Nginx → systemd mn-qronx)
// — không còn dùng Render nữa. VITE_API_URL chỉ cần đặt khi dev/build nơi khác.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://mn-qronx.id.vn/api/v1'

const BASE_URL = API_BASE_URL

/**
 * Đánh thức máy chủ (fire-and-forget) và chặn rác kết nối mạng ngắn hạn.
 * Trước đây dùng cho backend Render gói free (ngủ sau 15 phút, lần đầu truy
 * cập chờ 30-60 giây); giờ chạy trên VPS 24/7 nhưng giữ lại để bắt lỗi mạng sớm.
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

// ── Timeout mỗi lần gọi ───────────────────────────────────────────────
// Mạng VN thường rớt ngắn (IP nhà mạng/cấp 3 xoay vòng khiến đường TCP
// đang dùng chết êm), fetch mặc định treo vô hạn → người dùng tưởng máy
// chủ "đang khởi động lại". Chốt 15 giây rồi hủy, trả lỗi rõ ràng; bấm
// thử lại là tạo kết nối mới theo IP hiện tại nên thường sống ngay.
const REQUEST_TIMEOUT_MS = 15000

// ─── Không gian đang chọn (Cá nhân / Lớp học / Nhóm) ──────────────────
// WorkspaceContext gọi setActiveWorkspaceId() mỗi lần người dùng đổi chế độ;
// mọi request sau đó tự mang X-Workspace để backend lọc đúng không gian.
// null = ngữ cảnh Cá nhân mặc định (giữ nguyên hành vi cũ, kể cả extension).
let activeWorkspaceId = null

export function setActiveWorkspaceId(id) {
  const parsed = Number(id)
  activeWorkspaceId = Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function getActiveWorkspaceId() {
  return activeWorkspaceId
}

function fetchWithTimeout(url, opts = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...opts, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  )
}

function networkError(err) {
  return err?.name === 'AbortError'
    ? new Error('Phản hồi quá chậm (quá 15 giây) — mạng có thể bị gián đoạn thoáng qua. Bấm thử lại nhé.')
    : new Error('Không gọi được máy chủ — kiểm tra kết nối mạng rồi bấm thử lại.')
}

/**
 * Gọi endpoint thật.
 * @returns {Promise<{success:boolean, message:string, data?:any, errors?:object}>}
 *          Luôn resolve về envelope; chỉ throw khi lỗi mạng (không kết nối được server).
 */
export async function api(method, path, { body, query, headers: extraHeaders } = {}) {
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
    // Ngữ cảnh không gian đang chọn; request nào tự truyền X-Workspace thì
    // extraHeaders bên dưới sẽ ghi đè (ví dụ trang Lịch gọi cho từng lớp).
    if (activeWorkspaceId) headers['X-Workspace'] = String(activeWorkspaceId)
    // Header riêng khi cần — chủ yếu là X-Workspace (không gian Lớp/Nhóm)
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        if (v !== undefined && v !== null && v !== '') headers[k] = v
      }
    }
    const opts = { method, headers }
    if (body !== undefined) opts.body = JSON.stringify(body)
    return fetchWithTimeout(url, opts)
  }

  let res
  try {
    res = await doFetch(getAccessToken())
  } catch (e) {
    throw networkError(e)
  }

  // Token hết hạn → refresh 1 lần rồi thử lại
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const ok = await refreshAccessToken()
    if (ok) {
      try {
        res = await doFetch(getAccessToken())
      } catch (e) {
        throw networkError(e)
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

  // Lỗi nghiệp vụ từ backend – trả về envelope để UI hiển thị message/errors.
  // Kèm `status` để lớp gọi biết lỗi nào nên thử lại: 429/5xx là hạ tầng tạm
  // hỏng (hạ tầng tạm thời), còn 4xx là lỗi
  // nghiệp vụ thì thử lại vô ích.
  return {
    ...(data || {
      success: false,
      message: `Lỗi máy chủ (${res.status})`,
    }),
    status: res.status,
  }
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
    const r = await fetchWithTimeout(`${BASE_URL}/auth/refresh-token`, {
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
