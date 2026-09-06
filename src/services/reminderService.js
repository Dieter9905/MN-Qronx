import api from './apiClient'
import { toReminder, toTask, toCategory } from './normalize'
import { getCategories } from './categoryService'
import { getTask } from './taskService'

// Số ngày tối đa cho phép hiển thị alarm cho task quá hạn
const MAX_OVERDUE_DAYS = 1

// Gắn category cho task của reminder (backend /reminders/due không include category)
async function attachCategories(reminders) {
  const catRes = await getCategories({ isActive: true })
  const cats = catRes.success ? catRes.data || [] : []
  const catMap = {}
  cats.forEach((c) => {
    catMap[c.id] = c
  })
  return reminders.map((r) => {
    const cat = r.task?.categoryId ? catMap[r.task.categoryId] : null
    return { ...r, task: { ...r.task, category: cat } }
  })
}

function enrichReminderWithTask(reminder) {
  const task = reminder.task
  return {
    id: reminder.id ?? reminder.reminderId,
    taskId: reminder.taskId ?? task?.taskId,
    remindAt: reminder.remindAt,
    status: reminder.status,
    snoozeCount: reminder.snoozeCount ?? 0,
    createdAt: reminder.createdAt,
    task: task
      ? {
          ...toTask(task),
          category: task.category ? toCategory(task.category) : null,
        }
      : null,
  }
}

// GET /api/v1/reminders/due – polling dự phòng khi thiết bị vừa online
export async function getDueReminders(to = new Date().toISOString()) {
  const res = await api('GET', '/reminders/due')
  if (!res.success) return res
  const now = new Date()
  const maxOverdueDate = new Date(now.getTime() - MAX_OVERDUE_DAYS * 24 * 60 * 60 * 1000)

  let list = (res.data || [])
    .map(enrichReminderWithTask)
    .filter((r) => r.status === 'SCHEDULED' && r.remindAt && new Date(r.remindAt) <= new Date(to))
    // Bỏ qua alarm cho task đã quá hạn quá lâu
    .filter((r) => !(r.task?.dueAt && new Date(r.task.dueAt) < maxOverdueDate))

  list = await attachCategories(list)
  res.data = list
  return res
}

// GET /api/v1/reminders/{reminderId}
export async function getReminderDetail(reminderId) {
  const res = await api('GET', `/reminders/${reminderId}`)
  if (!res.success) return res
  let [enriched] = await attachCategories([enrichReminderWithTask(res.data)])
  res.data = enriched
  return res
}

// POST /api/v1/reminders/{id}/snooze
export async function snoozeReminder(reminderId, { snoozeMinutes } = {}) {
  const body = {}
  if (snoozeMinutes) body.snoozeMinutes = snoozeMinutes
  const res = await api('POST', `/reminders/${reminderId}/snooze`, { body })
  if (res.success) res.data = toReminder(res.data)
  return res
}

// POST /api/v1/reminders/{id}/dismiss
export async function dismissReminder(reminderId) {
  const res = await api('POST', `/reminders/${reminderId}/dismiss`)
  return res
}

// POST /api/v1/tasks/{taskId}/reminders – thêm nhắc nhở mới
export async function addReminder(taskId, remindAt) {
  const res = await api('POST', `/tasks/${taskId}/reminders`, { body: { remindAt } })
  if (res.success) res.data = toReminder(res.data)
  return res
}

// DELETE /api/v1/tasks/{taskId}/reminders/{reminderId}
export async function removeReminder(taskId, reminderId) {
  return api('DELETE', `/tasks/${taskId}/reminders/${reminderId}`)
}

// Demo: báo thức thử nghiệm – mô phỏng local từ task có sẵn (không tạo dữ liệu thật)
export async function triggerDemoAlarm(taskId) {
  const res = await getTask(taskId)
  if (!res.success) return res
  const task = res.data
  const reminder = {
    id: `demo-${task.id}`,
    taskId: task.id,
    remindAt: new Date().toISOString(),
    status: 'TRIGGERED',
    snoozeCount: 0,
    createdAt: new Date().toISOString(),
    demo: true,
    task,
  }
  return { success: true, message: 'Đã kích hoạt báo thức demo', data: reminder }
}
