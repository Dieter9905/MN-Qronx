import { db, getSession } from '../lib/db'
import { ok, fail, request, requireAuth } from './api'
import { MAX_SNOOZE_COUNT } from '../lib/constants'

function currentSession() {
  return getSession()
}

function getTaskForReminder(user, reminder) {
  return db.tasks.find((t) => t.id === reminder.taskId && t.userId === user.id)
}

// Số ngày tối đa cho phép hiển thị alarm cho task quá hạn
const MAX_OVERDUE_DAYS = 7

// GET /api/v1/reminders/due – polling dự phòng khi thiết bị vừa online (mô phỏng)
export function getDueReminders(to = new Date().toISOString()) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const now = new Date()
    const maxOverdueDate = new Date(now.getTime() - MAX_OVERDUE_DAYS * 24 * 60 * 60 * 1000)
    
    const due = db.reminders
      .filter(
        (r) =>
          r.status === 'SCHEDULED' &&
          new Date(r.remindAt) <= new Date(to) &&
          getTaskForReminder(user, r)
      )
      .map((r) => {
        const task = getTaskForReminder(user, r)
        const category = db.categories.find((c) => c.id === task.categoryId)
        return { ...r, task: { ...task, category } }
      })
      .filter((r) => {
        // Bỏ qua alarm cho task đã quá hạn quá lâu (trên 7 ngày)
        const taskDueAt = new Date(r.task.dueAt)
        if (taskDueAt < maxOverdueDate) {
          // Tự động hủy reminder quá hạn
          db.saveReminders(
            db.reminders.map((rem) =>
              rem.id === r.id ? { ...rem, status: 'CANCELLED' } : rem
            )
          )
          return false
        }
        return true
      })
    
    return ok('Thao tác thành công', due)
  }, { latency: 120 })
}

export function getReminderDetail(reminderId) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const reminder = db.reminders.find((r) => r.id === Number(reminderId))
    if (!reminder) return fail('Không tìm thấy nhắc nhở')
    const task = getTaskForReminder(user, reminder)
    if (!task) return fail('Không tìm thấy công việc')
    const category = db.categories.find((c) => c.id === task.categoryId)
    return ok('Thao tác thành công', { ...reminder, task: { ...task, category } })
  }, { latency: 120 })
}

// POST /api/v1/reminders/{id}/snooze
export function snoozeReminder(reminderId, { snoozeMinutes, log } = {}) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const reminder = db.reminders.find((r) => r.id === Number(reminderId))
    if (!reminder) return fail('Không tìm thấy nhắc nhở')
    if (reminder.snoozeCount >= MAX_SNOOZE_COUNT) {
      return fail('Không thể hoãn thêm', { reminderId: `Nhắc nhở này đã được hoãn tối đa ${MAX_SNOOZE_COUNT} lần` })
    }
    const task = getTaskForReminder(user, reminder)
    if (!task) return fail('Không tìm thấy công việc')
    const minutes = snoozeMinutes || db.getSettingsForUser(user.id)?.defaultSnoozeMinutes || 10
    const newAt = new Date(new Date().getTime() + minutes * 60000).toISOString()
    const updated = { ...reminder, status: 'SCHEDULED', remindAt: newAt, snoozeCount: reminder.snoozeCount + 1 }
    db.saveReminders(db.reminders.map((r) => (r.id === reminder.id ? updated : r)))
    if (log) {
      db.saveLogs([
        ...db.notificationLogs,
        {
          id: db.nextId(db.notificationLogs),
          userId: user.id,
          taskId: task.id,
          taskTitle: task.title,
          deviceName: 'Web – Trình duyệt hiện tại',
          action: 'SNOOZED',
          sentAt: db.nowIso(),
        },
      ])
    }
    return ok(`Đã hoãn nhắc nhở ${minutes} phút`, updated)
  }, { latency: 250 })
}

// POST /api/v1/reminders/{id}/dismiss
export function dismissReminder(reminderId, { log } = {}) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const reminder = db.reminders.find((r) => r.id === Number(reminderId))
    if (!reminder) return fail('Không tìm thấy nhắc nhở')
    const task = getTaskForReminder(user, reminder)
    if (!task) return fail('Không tìm thấy công việc')
    const updated = { ...reminder, status: 'DISMISSED' }
    db.saveReminders(db.reminders.map((r) => (r.id === reminder.id ? updated : r)))
    if (log) {
      db.saveLogs([
        ...db.notificationLogs,
        {
          id: db.nextId(db.notificationLogs),
          userId: user.id,
          taskId: task.id,
          taskTitle: task.title,
          deviceName: 'Web – Trình duyệt hiện tại',
          action: 'DISMISSED',
          sentAt: db.nowIso(),
        },
      ])
    }
    return ok('Đã tắt nhắc nhở', updated)
  }, { latency: 250 })
}

// POST /api/v1/tasks/{taskId}/reminders – thêm nhắc nhở mới (tối đa 5)
export function addReminder(taskId, remindAt) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(taskId) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    const active = db.reminders.filter((r) => r.taskId === task.id && r.status === 'SCHEDULED')
    if (active.length >= 5) return fail('Mỗi công việc chỉ được có tối đa 5 nhắc nhở đang hoạt động')
    if (!remindAt) return fail('Vui lòng chọn thời điểm nhắc nhở')
    if (new Date(remindAt) > new Date(task.dueAt)) {
      return fail('Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc', { remindAt: 'Nhắc nhở phải trước hoặc bằng thời hạn' })
    }
    const reminder = {
      id: db.nextId(db.reminders),
      taskId: task.id,
      remindAt,
      status: 'SCHEDULED',
      snoozeCount: 0,
      createdAt: db.nowIso(),
    }
    db.saveReminders([...db.reminders, reminder])
    return ok('Đã thêm nhắc nhở', reminder)
  }, { latency: 200 })
}

export function removeReminder(taskId, reminderId) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(taskId) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    const reminder = db.reminders.find((r) => r.id === Number(reminderId) && r.taskId === task.id)
    if (!reminder) return fail('Không tìm thấy nhắc nhở')
    if (reminder.status !== 'SCHEDULED') return fail('Chỉ có thể xóa nhắc nhở chưa kích hoạt')
    db.saveReminders(db.reminders.filter((r) => r.id !== reminder.id))
    return ok('Đã xóa nhắc nhở')
  }, { latency: 200 })
}

// Demo: kích hoạt một báo thức thử nghiệm (gắn vào task hiện có)
export function triggerDemoAlarm(taskId) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(taskId) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    const category = db.categories.find((c) => c.id === task.categoryId)
    const reminder = {
      id: db.nextId(db.reminders),
      taskId: task.id,
      remindAt: db.nowIso(),
      status: 'TRIGGERED',
      snoozeCount: 0,
      createdAt: db.nowIso(),
      demo: true,
    }
    db.saveReminders([...db.reminders, reminder])
    db.saveLogs([
      ...db.notificationLogs,
      {
        id: db.nextId(db.notificationLogs),
        userId: user.id,
        taskId: task.id,
        taskTitle: task.title,
        deviceName: 'Web – Trình duyệt hiện tại',
        action: 'SENT',
        sentAt: db.nowIso(),
      },
    ])
    return ok('Đã kích hoạt báo thức demo', { ...reminder, task: { ...task, category } })
  }, { latency: 400 })
}
