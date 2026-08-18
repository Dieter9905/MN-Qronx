import { db, getSession } from '../lib/db'
import { ok, fail, request, requireAuth } from './api'

function currentSession() {
  return getSession()
}

// GET /api/v1/devices
export function getDevices() {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const list = db.devices
      .filter((d) => d.userId === user.id && d.isActive)
      .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))
    return ok('Thao tác thành công', list)
  }, { latency: 250 })
}

// POST /api/v1/devices – đăng ký thiết bị hiện tại
export function registerCurrentDevice() {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const nav = typeof navigator !== 'undefined' ? navigator : {}
    const ua = nav.userAgent || 'Unknown'
    const platform = /iphone|ipad|ipod/i.test(ua) ? 'IOS' : /android/i.test(ua) ? 'ANDROID' : 'WEB'
    const name = `${platform === 'WEB' ? 'Trình duyệt' : 'Thiết bị'} – ${platform}`
    const existing = db.devices.find((d) => d.userId === user.id && d.name.startsWith(name) && d.isActive)
    if (existing) {
      const updated = { ...existing, lastSeenAt: db.nowIso() }
      db.saveDevices(db.devices.map((d) => (d.id === existing.id ? updated : d)))
      return ok('Thiết bị đã được cập nhật', updated)
    }
    const device = {
      id: db.nextId(db.devices),
      userId: user.id,
      name,
      platform,
      isActive: true,
      lastSeenAt: db.nowIso(),
      createdAt: db.nowIso(),
    }
    db.saveDevices([...db.devices, device])
    return ok('Đăng ký thiết bị thành công', device)
  }, { latency: 300 })
}

// DELETE /api/v1/devices/{id}
export function removeDevice(id) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const device = db.devices.find((d) => d.id === Number(id) && d.userId === user.id)
    if (!device) return fail('Không tìm thấy thiết bị')
    db.saveDevices(db.devices.map((d) => (d.id === device.id ? { ...d, isActive: false } : d)))
    return ok('Đã gỡ thiết bị')
  }, { latency: 250 })
}
