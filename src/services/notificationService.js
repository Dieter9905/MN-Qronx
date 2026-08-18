import { db, getSession } from '../lib/db'
import { ok, request, requireAuth } from './api'
import { ALARM_SOUNDS } from '../lib/constants'

function currentSession() {
  return getSession()
}

// GET /api/v1/notification-settings
export function getNotificationSettings() {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const settings = db.getSettingsForUser(user.id) || {
      userId: user.id,
      alarmSound: 'classic',
      defaultSnoozeMinutes: 10,
      vibrationEnabled: true,
      updatedAt: db.nowIso(),
    }
    return ok('Thao tác thành công', settings)
  }, { latency: 200 })
}

// PUT /api/v1/notification-settings
export function updateNotificationSettings(payload) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const current = db.getSettingsForUser(user.id) || {
      userId: user.id,
      alarmSound: 'classic',
      defaultSnoozeMinutes: 10,
      vibrationEnabled: true,
    }
    const updated = {
      ...current,
      ...payload,
      updatedAt: db.nowIso(),
    }
    if (payload.alarmSound && !ALARM_SOUNDS.some((s) => s.id === payload.alarmSound)) {
      return fail('Âm thanh báo thức không hợp lệ')
    }
    db.saveSettings(db.notificationSettings.map((s) => (s.userId === user.id ? updated : s)))
    return ok('Cập nhật cài đặt thành công', updated)
  }, { latency: 300 })
}

// GET /api/v1/notification-logs
export function getNotificationLogs({ from, to, page = 1, pageSize = 20 } = {}) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    let list = db.notificationLogs.filter((l) => l.userId === user.id)
    if (from) list = list.filter((l) => new Date(l.sentAt) >= new Date(from))
    if (to) list = list.filter((l) => new Date(l.sentAt) <= new Date(to))
    list = list.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
    const total = list.length
    const start = (page - 1) * pageSize
    return ok('Thao tác thành công', {
      items: list.slice(start, start + pageSize),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    })
  }, { latency: 250 })
}

// GET /api/v1/notification-logs/statistics (thêm cho Admin dashboard)
export function getNotificationStats(days = 7) {
  return request(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
    const buckets = []
    for (let i = 0; i < days; i += 1) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
      buckets.push({
        label: `${day.getDate()}/${day.getMonth() + 1}`,
        count: db.notificationLogs.filter((l) => new Date(l.sentAt) >= day && new Date(l.sentAt) < next).length,
      })
    }
    return ok('Thao tác thành công', buckets)
  }, { latency: 200 })
}
