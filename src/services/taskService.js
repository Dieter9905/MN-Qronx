import api from './apiClient'
import { toTask, toSubtask, paginate } from './normalize'

function toPagedTaskList(res) {
  if (!res.success) return res
  const p = paginate(res.data)
  res.data = { ...p, items: p.items.map(toTask) }
  return res
}

// GET /api/v1/tasks (lọc + tìm kiếm + phân trang)
export async function getTasks(filters = {}) {
  const {
    status, priority, categoryId, keyword, dueFrom, dueTo, sort = 'dueAsc',
    page = 1, pageSize = 20,
  } = filters

  // Backend không hiểu trạng thái ảo OVERDUE → lấy danh sách lớn rồi lọc local
  if (status === 'OVERDUE') {
    const res = await api('GET', '/tasks', {
      query: {
        status: '', priority, categoryId, keyword, dueFrom, dueTo,
        sort, page: 1, pageSize: 200,
      },
    })
    if (!res.success) return res
    const items = (res.data?.items || [])
      .map(toTask)
      .filter((t) => t.overdue)
    res.data = { items, total: items.length, page: Number(page), pageSize: Number(pageSize) }
    return res
  }

  const res = await api('GET', '/tasks', {
    query: {
      status, priority, categoryId, keyword, dueFrom, dueTo,
      sort, page, pageSize,
    },
  })
  return toPagedTaskList(res)
}

// GET /api/v1/tasks/{id}
export async function getTask(id) {
  const res = await api('GET', `/tasks/${id}`)
  if (res.success) res.data = toTask(res.data)
  return res
}

// POST /api/v1/tasks
export async function createTask(payload = {}) {
  const body = {
    title: payload.title,
    description: payload.description,
    categoryId: payload.categoryId || null,
    priority: payload.priority || 'MEDIUM',
    dueAt: payload.dueAt,
    repeatType: payload.repeatType || 'NONE',
    repeatDays: payload.repeatType === 'WEEKLY' && Array.isArray(payload.repeatDays) ? payload.repeatDays : undefined,
    reminders: (payload.reminders || []).map((r) => ({ remindAt: r.remindAt })),
  }
  const res = await api('POST', '/tasks', { body })
  // Backend chưa tạo subtasks khi tạo task → tạo lần lượt nếu có
  if (res.success && Array.isArray(payload.subtasks) && payload.subtasks.length > 0) {
    const id = res.data?.id
    for (const s of payload.subtasks) {
      if (s.content?.trim()) await api('POST', `/tasks/${id}/subtasks`, { body: { content: s.content } })
    }
  }
  if (res.success) res.data = toTask(res.data)
  return res
}

// PUT /api/v1/tasks/{id}
export async function updateTask(id, payload = {}) {
  // Đồng bộ subtasks (backend không hỗ trợ bulk) – xoá hết cũ đã bị bỏ, thêm mới
  const res = await api('PUT', `/tasks/${id}`, {
    body: {
      title: payload.title,
      description: payload.description,
      categoryId: payload.categoryId || null,
      priority: payload.priority,
      dueAt: payload.dueAt,
      repeatType: payload.repeatType,
      repeatDays: payload.repeatType === 'WEEKLY' && Array.isArray(payload.repeatDays) ? payload.repeatDays : undefined,
    },
  })
  if (!res.success) return res

  if (Array.isArray(payload.subtasks) || Array.isArray(payload.reminders)) {
    const detailRes = await getTask(id)
    const detail = detailRes.success ? detailRes.data : null
    const existingSubs = detail?.subtasks || []
    const existingRems = detail?.reminders || []

    for (const oldSub of existingSubs) {
      const stillThere = payload.subtasks.some(
        (s) => Number(s.id) === Number(oldSub.id) || (s.content && s.content.trim() === oldSub.content)
      )
      if (!stillThere) await api('DELETE', `/tasks/${id}/subtasks/${oldSub.id}`)
    }
    if (Array.isArray(payload.subtasks)) {
      for (const s of payload.subtasks) {
        if (!s.id && s.content?.trim()) {
          await api('POST', `/tasks/${id}/subtasks`, { body: { content: s.content } })
        }
      }
    }

    const current = existingRems
    const keptIds = payload.reminders
      .filter((r) => r.id)
      .map((r) => Number(r.id))
    for (const r of current) {
      if (r.status === 'SCHEDULED' && !keptIds.includes(Number(r.id))) {
        await api('DELETE', `/tasks/${id}/reminders/${r.id}`)
      }
    }
    for (const r of payload.reminders) {
      if (r.id) {
        await api('PUT', `/tasks/${id}/reminders/${r.id}`, { body: { remindAt: r.remindAt } })
      } else if (r.remindAt) {
        await api('POST', `/tasks/${id}/reminders`, { body: { remindAt: r.remindAt } })
      }
    }
  }

  return getTask(id)
}

// DELETE /api/v1/tasks/{id}
export async function deleteTask(id) {
  return api('DELETE', `/tasks/${id}`)
}

// POST /api/v1/tasks/{id}/complete
export async function completeTask(id) {
  const res = await api('POST', `/tasks/${id}/complete`)
  if (res.success) {
    const completed = res.data?.completedTask || {}
    const nextTask = res.data?.nextTask || null
    res.data = {
      completedTask: { id: completed.taskId ?? completed.id, status: 'COMPLETED' },
      nextTask: nextTask ? toTask(nextTask) : null,
    }
  }
  return res
}

// POST /api/v1/tasks/{id}/reopen
export async function reopenTask(id) {
  const res = await api('POST', `/tasks/${id}/reopen`)
  if (res.success) res.data = toTask(res.data)
  return res
}

// POST /api/v1/tasks/{id}/cancel
export async function cancelTask(id) {
  const res = await api('POST', `/tasks/${id}/cancel`)
  if (res.success) {
    res.data = { id: Number(id), status: 'CANCELLED' }
  }
  return res
}

// ---------- Subtasks ----------

function toSubtaskResult(res) {
  if (res.success) res.data = toSubtask(res.data)
  return res
}

export async function addSubtask(taskId, content) {
  const res = await api('POST', `/tasks/${taskId}/subtasks`, { body: { content } })
  return toSubtaskResult(res)
}

export async function toggleSubtask(taskId, subtaskId) {
  const res = await api('POST', `/tasks/${taskId}/subtasks/${subtaskId}/toggle`)
  return toSubtaskResult(res)
}

export async function deleteSubtask(taskId, subtaskId) {
  return api('DELETE', `/tasks/${taskId}/subtasks/${subtaskId}`)
}

// GET /api/v1/dashboard
export async function getDashboard() {
  const res = await api('GET', '/dashboard')
  if (res.success) {
    res.data = {
      todayCount: res.data?.todayCount ?? 0,
      overdueCount: res.data?.overdueCount ?? 0,
      completedCount: res.data?.completedCount ?? 0,
      upcomingCount: res.data?.upcomingCount ?? 0,
      todayTasks: (res.data?.todayTasks || []).map(toTask),
      overdueTasks: (res.data?.overdueTasks || []).map(toTask),
    }
  }
  return res
}
