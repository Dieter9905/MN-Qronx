import { db, getSession } from '../lib/db'
import { ok, fail, request, requireAuth } from './api'
import { MAX_REMINDERS_PER_TASK } from '../lib/constants'
import { addDays, addMonths, isOverdue } from '../lib/format'

function currentSession() {
  return getSession()
}

export function enrichTask(task) {
  const category = db.categories.find((c) => c.id === task.categoryId)
  const subtasks = db.subtasks.filter((s) => s.taskId === task.id)
  const reminders = db.reminders
    .filter((r) => r.taskId === task.id)
    .sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt))
  return {
    ...task,
    category,
    subtasks,
    reminders,
    overdue: isOverdue(task),
  }
}

function sortTasks(list, sort) {
  const arr = [...list]
  if (sort === 'dueAsc') arr.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
  else if (sort === 'dueDesc') arr.sort((a, b) => new Date(b.dueAt) - new Date(a.dueAt))
  else if (sort === 'priorityDesc') {
    const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    arr.sort((a, b) => order[a.priority] - order[b.priority] || new Date(a.dueAt) - new Date(b.dueAt))
  } else arr.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
  return arr
}

// GET /api/v1/tasks (hỗ trợ lọc + tìm kiếm + phân trang)
export function getTasks(filters = {}) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const {
      status, priority, categoryId, keyword, dueFrom, dueTo, sort = 'dueAsc',
      page = 1, pageSize = 20,
    } = filters

    let list = db.tasks.filter((t) => t.userId === user.id)
    if (status) {
      if (status === 'OVERDUE') list = list.filter((t) => isOverdue(t))
      else list = list.filter((t) => t.status === status)
    }
    if (priority) list = list.filter((t) => t.priority === priority)
    if (categoryId) list = list.filter((t) => t.categoryId === Number(categoryId))
    if (keyword) list = list.filter((t) => t.title.toLowerCase().includes(keyword.toLowerCase()))
    if (dueFrom) list = list.filter((t) => new Date(t.dueAt) >= new Date(dueFrom))
    if (dueTo) list = list.filter((t) => new Date(t.dueAt) <= new Date(dueTo))

    const total = list.length
    const sorted = sortTasks(list, sort)
    const start = (page - 1) * pageSize
    const items = sorted.slice(start, start + pageSize).map(enrichTask)

    return ok('Thao tác thành công', { items, total, page: Number(page), pageSize: Number(pageSize) })
  }, { latency: 300 })
}

// GET /api/v1/tasks/{id}
export function getTask(id) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(id) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    return ok('Thao tác thành công', enrichTask(task))
  }, { latency: 250 })
}

function validateReminders(reminders, dueAt) {
  if (!Array.isArray(reminders) || reminders.length === 0) return null
  if (reminders.length > MAX_REMINDERS_PER_TASK) {
    return { [`reminders`]: `Mỗi công việc chỉ được có tối đa ${MAX_REMINDERS_PER_TASK} nhắc nhở đang hoạt động` }
  }
  const errors = {}
  reminders.forEach((r, i) => {
    if (r.remindAt && new Date(r.remindAt) > new Date(dueAt)) {
      errors[`reminders[${i}].remindAt`] = 'Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc'
    }
  })
  return Object.keys(errors).length ? errors : null
}

// POST /api/v1/tasks
export function createTask(payload) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    if (!payload.title?.trim()) return fail('Tiêu đề không được để trống', { title: 'Tiêu đề công việc không được để trống' })
    if (!payload.dueAt) return fail('Thời hạn không được để trống', { dueAt: 'Vui lòng chọn thời điểm đến hạn' })
    const remindErrors = validateReminders(payload.reminders, payload.dueAt)
    if (remindErrors) return fail('Thông tin đầu vào không hợp lệ', remindErrors)

    const task = {
      id: db.nextId(db.tasks),
      userId: user.id,
      categoryId: payload.categoryId || null,
      title: payload.title.trim(),
      description: payload.description || '',
      priority: payload.priority || 'MEDIUM',
      status: 'TODO',
      dueAt: payload.dueAt,
      repeatType: payload.repeatType || 'NONE',
      parentTaskId: payload.parentTaskId || null,
      createdAt: db.nowIso(),
    }
    db.saveTasks([...db.tasks, task])

    const newSubtasks = (payload.subtasks || []).filter((s) => s.content?.trim()).map((s) => ({
      id: db.nextId(db.subtasks),
      taskId: task.id,
      content: s.content.trim(),
      isCompleted: false,
      createdAt: db.nowIso(),
    }))
    if (newSubtasks.length) db.saveSubtasks([...db.subtasks, ...newSubtasks])

    const newReminders = (payload.reminders || []).filter((r) => r.remindAt).map((r) => ({
      id: db.nextId(db.reminders),
      taskId: task.id,
      remindAt: r.remindAt,
      status: 'SCHEDULED',
      snoozeCount: 0,
      createdAt: db.nowIso(),
    }))
    if (newReminders.length) db.saveReminders([...db.reminders, ...newReminders])

    return ok('Tạo công việc thành công', enrichTask({ ...task, subtasks: newSubtasks, reminders: newReminders }))
  }, { latency: 400 })
}

// PUT /api/v1/tasks/{id}
export function updateTask(id, payload) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(id) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    if (!payload.title?.trim()) return fail('Tiêu đề không được để trống', { title: 'Tiêu đề công việc không được để trống' })
    if (!payload.dueAt) return fail('Thời hạn không được để trống', { dueAt: 'Vui lòng chọn thời điểm đến hạn' })
    const remindErrors = validateReminders(payload.reminders || task.reminders, payload.dueAt)
    if (remindErrors) return fail('Thông tin đầu vào không hợp lệ', remindErrors)

    const updated = {
      ...task,
      categoryId: payload.categoryId ?? task.categoryId,
      title: payload.title.trim(),
      description: payload.description ?? task.description,
      priority: payload.priority ?? task.priority,
      dueAt: payload.dueAt,
      repeatType: payload.repeatType ?? task.repeatType,
    }
    db.saveTasks(db.tasks.map((t) => (t.id === task.id ? updated : t)))

    // Đồng bộ subtasks & reminders
    if (Array.isArray(payload.subtasks)) {
      const kept = payload.subtasks.filter((s) => s.id && db.subtasks.some((x) => x.id === s.id && x.taskId === task.id))
      const added = payload.subtasks.filter((s) => !s.id && s.content?.trim()).map((s) => ({
        id: db.nextId(db.subtasks),
        taskId: task.id,
        content: s.content.trim(),
        isCompleted: false,
        createdAt: db.nowIso(),
      }))
      db.saveSubtasks([...db.subtasks.filter((s) => s.taskId !== task.id), ...kept, ...added])
    }

    if (Array.isArray(payload.reminders)) {
      const kept = payload.reminders
        .filter((r) => r.id && db.reminders.some((x) => x.id === r.id && x.taskId === task.id && x.status === 'SCHEDULED'))
        .map((r) => ({ ...r, remindAt: r.remindAt }))
      const added = payload.reminders.filter((r) => !r.id && r.remindAt).map((r) => ({
        id: db.nextId(db.reminders),
        taskId: task.id,
        remindAt: r.remindAt,
        status: 'SCHEDULED',
        snoozeCount: 0,
        createdAt: db.nowIso(),
      }))
      db.saveReminders([...db.reminders.filter((r) => !(r.taskId === task.id && r.status === 'SCHEDULED')), ...kept, ...added])
    }

    return ok('Cập nhật công việc thành công', enrichTask({ ...updated, subtasks: payload.subtasks, reminders: payload.reminders }))
  }, { latency: 400 })
}

// DELETE /api/v1/tasks/{id}
export function deleteTask(id) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(id) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    const hasLog = db.notificationLogs.some((l) => l.taskId === task.id)
    if (hasLog) {
      return fail('Công việc này đã phát sinh lịch sử thông báo, không thể xóa. Bạn có thể hủy công việc thay thế.')
    }
    db.saveTasks(db.tasks.filter((t) => t.id !== task.id))
    db.saveSubtasks(db.subtasks.filter((s) => s.taskId !== task.id))
    db.saveReminders(db.reminders.filter((r) => r.taskId !== task.id))
    return ok('Xóa công việc thành công')
  }, { latency: 350 })
}

function cancelRemindersForTask(taskId) {
  db.saveReminders(
    db.reminders.map((r) =>
      r.taskId === taskId && r.status === 'SCHEDULED' ? { ...r, status: 'CANCELLED' } : r
    )
  )
}

function nextRepeatDue(dueAt, repeatType) {
  const d = new Date(dueAt)
  if (repeatType === 'DAILY') return addDays(d, 1)
  if (repeatType === 'WEEKLY') return addDays(d, 7)
  if (repeatType === 'MONTHLY') return addMonths(d, 1)
  return null
}

// POST /api/v1/tasks/{id}/complete
export function completeTask(id) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(id) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    if (task.status === 'COMPLETED') return fail('Công việc đã được hoàn thành trước đó')

    const completed = { ...task, status: 'COMPLETED', completedAt: db.nowIso() }
    cancelRemindersForTask(task.id)
    db.saveTasks(db.tasks.map((t) => (t.id === task.id ? completed : t)))

    let nextTask = null
    if (task.repeatType && task.repeatType !== 'NONE') {
      const due = nextRepeatDue(task.dueAt, task.repeatType)
      if (due) {
        const created = {
          id: db.nextId(db.tasks),
          userId: user.id,
          categoryId: task.categoryId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: 'TODO',
          dueAt: due.toISOString(),
          repeatType: task.repeatType,
          parentTaskId: task.id,
          createdAt: db.nowIso(),
        }
        db.saveTasks([...db.tasks, created])
        const newReminders = task.reminders.map((r) => {
          const offset = new Date(r.remindAt) - new Date(task.dueAt)
          return {
            id: db.nextId(db.reminders),
            taskId: created.id,
            remindAt: new Date(new Date(due).getTime() + offset).toISOString(),
            status: 'SCHEDULED',
            snoozeCount: 0,
            createdAt: db.nowIso(),
          }
        })
        if (newReminders.length) db.saveReminders([...db.reminders, ...newReminders])
        nextTask = { ...created, reminders: newReminders }
      }
    }

    return ok('Đã hoàn thành công việc', { completedTask: completed, nextTask })
  }, { latency: 350 })
}

// POST /api/v1/tasks/{id}/reopen
export function reopenTask(id) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(id) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    const { completedAt, ...rest } = task
    const reopened = { ...rest, status: 'TODO' }
    db.saveTasks(db.tasks.map((t) => (t.id === task.id ? reopened : t)))
    return ok('Đã mở lại công việc', reopened)
  }, { latency: 300 })
}

// POST /api/v1/tasks/{id}/cancel
export function cancelTask(id) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(id) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    const cancelled = { ...task, status: 'CANCELLED' }
    cancelRemindersForTask(task.id)
    db.saveTasks(db.tasks.map((t) => (t.id === task.id ? cancelled : t)))
    return ok('Đã hủy công việc', cancelled)
  }, { latency: 300 })
}

// ---------- Subtasks ----------

export function addSubtask(taskId, content) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(taskId) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    if (!content?.trim()) return fail('Nội dung việc con không được để trống')
    const sub = { id: db.nextId(db.subtasks), taskId: task.id, content: content.trim(), isCompleted: false, createdAt: db.nowIso() }
    db.saveSubtasks([...db.subtasks, sub])
    return ok('Đã thêm việc con', sub)
  }, { latency: 200 })
}

export function toggleSubtask(taskId, subtaskId) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(taskId) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    const sub = db.subtasks.find((s) => s.id === Number(subtaskId) && s.taskId === task.id)
    if (!sub) return fail('Không tìm thấy việc con')
    const updated = { ...sub, isCompleted: !sub.isCompleted }
    db.saveSubtasks(db.subtasks.map((s) => (s.id === sub.id ? updated : s)))
    return ok(updated.isCompleted ? 'Đã hoàn thành việc con' : 'Đã mở lại việc con', updated)
  }, { latency: 150 })
}

export function deleteSubtask(taskId, subtaskId) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const task = db.tasks.find((t) => t.id === Number(taskId) && t.userId === user.id)
    if (!task) return fail('Không tìm thấy công việc')
    db.saveSubtasks(db.subtasks.filter((s) => !(s.id === Number(subtaskId) && s.taskId === task.id)))
    return ok('Đã xóa việc con')
  }, { latency: 150 })
}

// GET /api/v1/dashboard
export function getDashboard() {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const mine = db.tasks.filter((t) => t.userId === user.id)

    const todayCount = mine.filter(
      (t) => new Date(t.dueAt) >= todayStart && new Date(t.dueAt) < todayEnd && t.status !== 'CANCELLED'
    ).length
    const overdueCount = mine.filter((t) => isOverdue(t)).length
    const completedCount = mine.filter((t) => t.status === 'COMPLETED').length
    const upcomingCount = mine.filter((t) => new Date(t.dueAt) >= todayEnd && t.status === 'TODO').length

    const todayTasks = mine
      .filter((t) => new Date(t.dueAt) >= todayStart && new Date(t.dueAt) < todayEnd && t.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
      .map(enrichTask)
    const overdueTasks = mine.filter((t) => isOverdue(t)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).map(enrichTask)

    return ok('Thao tác thành công', {
      todayCount,
      overdueCount,
      completedCount,
      upcomingCount,
      todayTasks,
      overdueTasks,
    })
  }, { latency: 300 })
}
