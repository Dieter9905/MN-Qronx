import api from './apiClient'
import { toTask, toSubtask, paginate } from './normalize'
import { notifyTasksChanged } from '../lib/dataEvents'

// Mọi thao tác ĐỔI việc đều phát tín hiệu này khi máy chủ đã trả về thành công.
// Nhờ vậy việc được đánh dấu xong ở một màn hình (kể cả trên màn hình chuông)
// làm các trang đang mở khác tự tải lại, thay vì vẫn hiển thị việc cũ.

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

  // Backend không hiểu trạng thái ảo OVERDUE → lấy hết rồi lọc local
  if (status === 'OVERDUE') {
    const res = await getAllTasks({ priority, categoryId, keyword, dueFrom, dueTo, sort })
    if (!res.success) return res
    const items = (res.data?.items || []).filter((t) => t.overdue)
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

/**
 * Lấy TOÀN BỘ công việc khớp bộ lọc bằng cách duyệt từng trang.
 *
 * Máy chủ chỉ trả tối đa MAX_PAGE_SIZE (200) mỗi lần, nên chỗ nào cần "cả sổ"
 * (lịch tháng, lệnh trong chat AI, lọc quá hạn) mà xin một request pageSize lớn
 * thì phần vượt trần bị cắt im lặng — lịch thiếu việc, câu lệnh không tìm thấy
 * việc cần đánh dấu.
 */
export async function getAllTasks(filters = {}, { pageSize = 200, maxPages = 25 } = {}) {
  const first = await getTasks({ ...filters, page: 1, pageSize })
  if (!first.success) return first

  let items = first.data.items || []
  const total = first.data.total ?? items.length
  const pages = Math.min(maxPages, Math.ceil(total / pageSize))
  for (let p = 2; p <= pages; p += 1) {
    const next = await getTasks({ ...filters, page: p, pageSize })
    if (!next.success || !(next.data?.items || []).length) break
    items = items.concat(next.data.items)
  }

  first.data = { ...first.data, items, total: items.length, page: 1, pageSize: items.length }
  return first
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
  if (res.success) {
    res.data = toTask(res.data)
    notifyTasksChanged()
  }
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

  const updated = await getTask(id)
  notifyTasksChanged()
  return updated
}

// PUT /api/v1/tasks/{id} — chỉ đổi HẠN của công việc.
// Không dùng updateTask() cho việc này: hàm đó gửi kèm categoryId/priority/title,
// nên chỉ truyền { dueAt } là danh mục bị xoá và các trường khác bị ghi đè.
// Dùng khi khách dời hạn ngay trên Kế hoạch tuần.
export async function rescheduleTask(id, dueAt) {
  const res = await api('PUT', `/tasks/${id}`, { body: { dueAt } })
  if (res.success) notifyTasksChanged()
  return res
}

// DELETE /api/v1/tasks/{id} — đưa vào thùng rác (xoá mềm, giữ 30 ngày)
export async function deleteTask(id) {
  const res = await api('DELETE', `/tasks/${id}`)
  if (res.success) notifyTasksChanged()
  return res
}

// ─── Thùng rác ─────────────────────────────────────────

export async function getTrash(params = {}) {
  const res = await api('GET', '/tasks/trash', { query: params })
  // Chuẩn hoá như list thường để giao diện dùng chung một kiểu đối tượng
  return toPagedTaskList(res)
}

export async function restoreTask(id) {
  const res = await api('POST', `/tasks/${id}/restore`)
  if (res.success) notifyTasksChanged()
  return res
}

export async function emptyTrash() {
  const res = await api('DELETE', '/tasks/trash')
  if (res.success) notifyTasksChanged()
  return res
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
    notifyTasksChanged()
  }
  return res
}

// POST /api/v1/tasks/{id}/reopen
export async function reopenTask(id) {
  const res = await api('POST', `/tasks/${id}/reopen`)
  if (res.success) {
    res.data = toTask(res.data)
    notifyTasksChanged()
  }
  return res
}

// POST /api/v1/tasks/{id}/cancel
export async function cancelTask(id) {
  const res = await api('POST', `/tasks/${id}/cancel`)
  if (res.success) {
    res.data = { id: Number(id), status: 'CANCELLED' }
    notifyTasksChanged()
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

// ── Giao việc cho người khác (gói Pro) ──────────────────────
// Giao việc nằm ở trang CHI TIẾT công việc chứ không ở form tạo mới: nhờ người khác
// làm là quyết định đưa ra sau khi đã có việc, không phải lúc gõ tiêu đề.

// POST /api/v1/tasks/:id/shares — nhờ một người (theo email) làm việc này
export async function shareTask(id, { email, note } = {}) {
  const res = await api('POST', `/tasks/${id}/shares`, { body: { email, note } })
  if (res.success) res.data = { ...res.data, task: toTask(res.data?.task) }
  return res
}

// GET /api/v1/tasks/:id/shares — danh sách người được giao của một việc
export async function getTaskShares(id) {
  return api('GET', `/tasks/${id}/shares`)
}

// PUT /api/v1/tasks/:id/rotation — luân phiên người làm
//   { enabled: true|false }  → bật/tắt
//   { assigneeId }           → đổi người làm KỲ NÀY (kỳ sau vẫn xoay đúng thứ tự)
export async function setTaskRotation(id, payload = {}) {
  const res = await api('PUT', `/tasks/${id}/rotation`, { body: payload })
  if (res.success && res.data?.task) res.data = { ...res.data, task: toTask(res.data.task) }
  return res
}

// DELETE /api/v1/tasks/:id/shares/:shareId — thu hồi việc đã giao
export async function revokeTaskShare(id, shareId) {
  const res = await api('DELETE', `/tasks/${id}/shares/${shareId}`)
  if (res.success) res.data = { ...res.data, task: toTask(res.data?.task) }
  return res
}

// GET /api/v1/me/assigned — việc NGƯỜI KHÁC nhờ tôi làm
export async function getAssignedTasks() {
  const res = await api('GET', '/me/assigned')
  if (res.success) res.data = (res.data || []).map(toAssignedTask)
  return res
}

// PUT /api/v1/me/assigned/:taskId — báo xong (hoặc bỏ báo xong) phần của tôi
export async function setAssignedDone(taskId, done = true) {
  return api('PUT', `/me/assigned/${taskId}`, { body: { done } })
}

function toAssignedTask(item) {
  if (!item) return item
  return {
    shareId: item.shareId,
    taskId: item.taskId,
    title: item.title,
    description: item.description || '',
    priority: item.priority,
    dueAt: item.dueAt,
    dueOverdue: !!item.dueOverdue,
    note: item.note || '',
    doneAt: item.doneAt || null,
    isDone: !!item.doneAt,
    closed: !!item.completed,
    // Luân phiên người làm: việc này KỲ NÀY có phải lượt của tôi không. Thiếu hai
    // dòng này thì trang "Việc được giao" hiện mọi việc giống nhau, và người đến
    // lượt không biết mình đang bị chờ — đúng thứ tính năng sinh ra để nói.
    rotateEnabled: !!item.rotateEnabled,
    isMyTurn: !!item.isMyTurn,
    category: item.category || null,
    nextReminderAt: item.nextReminderAt || null,
    assignedBy: item.assignedBy || null,
    assignedAt: item.assignedAt,
  }
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
