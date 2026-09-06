import api from './apiClient'
import { toDevice } from './normalize'

// GET /api/v1/devices
export async function getDevices() {
  const res = await api('GET', '/devices')
  if (res.success) res.data = (res.data || []).map(toDevice)
  return res
}

function detectPlatform(ua) {
  if (/iphone|ipad|ipod/i.test(ua)) return 'IOS'
  if (/android/i.test(ua)) return 'ANDROID'
  return 'WEB'
}

// POST /api/v1/devices – đăng ký thiết bị hiện tại
export async function registerCurrentDevice() {
  const nav = typeof navigator !== 'undefined' ? navigator : {}
  const platform = detectPlatform(nav.userAgent || '')
  // Backend dùng deviceToken là khoá định danh → token giả ổn định cho trình duyệt hiện tại
  const rawToken = `web-${platform}-${(nav.userAgent || 'ua').slice(0, 48)}`
  let deviceToken = ''
  for (let i = 0; i < rawToken.length; i += 1) {
    const c = rawToken.charCodeAt(i)
    deviceToken += c.toString(16).padStart(2, '0')
  }
  const res = await api('POST', '/devices', { body: { deviceToken, platform } })
  if (res.success) res.data = toDevice(res.data)
  return res
}

// DELETE /api/v1/devices/{id}
export async function removeDevice(id) {
  return api('DELETE', `/devices/${id}`)
}
