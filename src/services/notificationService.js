import api, { apiBlob } from './apiClient'
import { toSettings, toNotificationLog, paginate } from './normalize'

// ── Âm thanh báo thức tùy chỉnh (import MP3) ──────────────

function toCustomSound(s) {
  if (!s) return null
  return {
    id: s.customSoundId ?? s.id,
    name: s.name,
    mimeType: s.mimeType ?? 'audio/mpeg',
    sizeBytes: s.sizeBytes ?? 0,
    createdAt: s.createdAt,
  }
}

// GET /api/v1/me/sounds – danh sách âm thanh đã import
export async function getCustomSounds() {
  const res = await api('GET', '/me/sounds')
  if (res.success) res.data = (res.data || []).map(toCustomSound)
  return res
}

// POST /api/v1/me/sounds – import âm thanh mới (base64 trong JSON)
export async function importCustomSound({ name, dataBase64, mimeType } = {}) {
  const res = await api('POST', '/me/sounds', { body: { name, dataBase64, mimeType } })
  if (res.success) res.data = toCustomSound(res.data)
  return res
}

// DELETE /api/v1/me/sounds/{id}
export async function deleteCustomSound(id) {
  return api('DELETE', `/me/sounds/${id}`)
}

// Cache object URL theo id – tránh tải lại nhiều lần
const soundUrlCache = new Map()

// Tải bytes audio của âm thanh tùy chỉnh → object URL để phát (HTMLAudioElement)
export async function getCustomSoundUrl(id) {
  if (soundUrlCache.has(id)) return soundUrlCache.get(id)
  const blob = await apiBlob(`/me/sounds/${id}/data`)
  const url = URL.createObjectURL(blob)
  soundUrlCache.set(id, url)
  return url
}

export function clearCustomSoundUrlCache() {
  soundUrlCache.forEach((url) => URL.revokeObjectURL(url))
  soundUrlCache.clear()
}

// GET /api/v1/devices/settings – cài đặt thông báo
export async function getNotificationSettings() {
  const res = await api('GET', '/devices/settings')
  if (res.success) res.data = toSettings(res.data)
  return res
}

// PUT /api/v1/devices/settings
export async function updateNotificationSettings(payload = {}) {
  const res = await api('PUT', '/devices/settings', { body: payload })
  if (res.success) res.data = toSettings(res.data)
  return res
}

// GET /api/v1/devices/logs
export async function getNotificationLogs({ from, to, action, page = 1, pageSize = 20 } = {}) {
  const res = await api('GET', '/devices/logs', {
    query: { from, to, action, page, pageSize },
  })
  if (res.success) {
    const p = paginate(res.data)
    res.data = { ...p, items: p.items.map(toNotificationLog) }
  }
  return res
}

// Thống kê log theo ngày – dùng cho Admin dashboard (tính từ lịch sử thông báo)
export async function getNotificationStats(days = 7) {
  const res = await api('GET', '/devices/logs', { query: { page: 1, pageSize: 200 } })
  const logs = res.success ? (res.data?.items || []) : []
  const buckets = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    buckets.push({
      label: `${day.getDate()}/${day.getMonth() + 1}`,
      count: logs.filter((l) => {
        const t = l.sentAt ? new Date(l.sentAt) : null
        return t && t >= day && t < next
      }).length,
    })
  }
  return { success: true, message: 'Thao tác thành công', data: buckets }
}
