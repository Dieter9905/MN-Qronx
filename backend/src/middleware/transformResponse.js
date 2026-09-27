/**
 * Response Transformer Middleware
 *
 * Intercepts res.success() calls and transforms backend field names
 * to match frontend mock DB field names.
 *
 * Backend: { taskId, categoryName, colorCode, ... }
 * Frontend: { id, name, color, ... }
 */

import {
  transformUser,
  transformCategory,
  transformTask,
  transformSubtask,
  transformReminder,
  transformTaskShare,
  transformAssignedTask,
  transformDevice,
  transformNotificationSetting,
  transformNotificationLog,
} from '../utils/transformers.js'

// Paths that need specific transforms
const CATEGORY_PATHS = ['/categories']
const TASK_PATHS = ['/tasks']
const REMINDER_PATHS = ['/reminders']
const DEVICE_PATHS = ['/devices']
const DASHBOARD_PATHS = ['/dashboard']
const ADMIN_PATHS = ['/admin']

function matchPath(urlpath, prefixes) {
  // Split path into segments and check against prefixes
  const segments = urlpath.split('/').filter(Boolean)
  // Remove 'api/v1' prefix if present
  const apiIndex = segments.indexOf('api')
  const pathSegments = apiIndex >= 0 ? segments.slice(apiIndex + 2) : segments
  
  return prefixes.some((p) => {
    const prefixSegments = p.split('/').filter(Boolean)
    // Check if path starts with prefix segments
    if (pathSegments.length < prefixSegments.length) return false
    return prefixSegments.every((seg, i) => pathSegments[i] === seg)
  })
}

function isTaskListResponse(data) {
  return data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)
}

/** Các đoạn đường dẫn sau /api/v1, đã bỏ query string (vd: ['tasks','12','subtasks']). */
function pathSegmentsOf(urlpath) {
  const segments = urlpath.split('?')[0].split('/').filter(Boolean)
  const apiIndex = segments.indexOf('api')
  return apiIndex >= 0 ? segments.slice(apiIndex + 2) : segments
}

function transformData(data, urlpath) {
  if (!data || typeof data !== 'object') return data

  const segments = pathSegmentsOf(urlpath)

  // ── Việc con / nhắc nhở NẰM TRONG công việc (/tasks/:id/subtasks|reminders) ──
  // Phải xử lý TRƯỚC nhánh "một công việc": cả subtask lẫn reminder đều có
  // trường `taskId`, nên trước đây chúng bị transformTask biến thành một công
  // việc rỗng (id = taskId, mất `content`) — thêm việc con xong bấm tích là báo
  // "Không tìm thấy việc con", còn nhắc nhở vừa thêm thì mất nội dung.
  if (segments[0] === 'tasks' && segments[2] === 'subtasks') {
    return Array.isArray(data) ? data.map(transformSubtask) : transformSubtask(data)
  }
  if (segments[0] === 'tasks' && segments[2] === 'reminders') {
    return Array.isArray(data) ? data.map(transformReminder) : transformReminder(data)
  }
  // Cùng lý do với việc con/nhắc nhở ở trên: mỗi dòng giao việc đều có `taskId`,
  // nên nếu rơi vào nhánh "một công việc" thì transformTask biến nó thành một công
  // việc rỗng và mất hết tên người được giao.
  if (segments[0] === 'tasks' && segments[2] === 'shares') {
    // POST (giao việc) và DELETE (thu hồi) trả về KÈM cả công việc đã cập nhật để
    // giao diện vẽ lại khối "người được giao" ngay, không phải gọi thêm một lượt.
    if (data.task && data.task.taskId) {
      return {
        ...data,
        task: transformTask(data.task),
        ...(data.share ? { share: transformTaskShare(data.share) } : {}),
      }
    }
    return Array.isArray(data) ? data.map(transformTaskShare) : transformTaskShare(data)
  }

  // PUT /tasks/:id/rotation trả về công việc đã cập nhật (kèm danh sách người được
  // giao và lượt mới) để giao diện vẽ lại khối luân phiên ngay, không phải gọi
  // thêm một lượt nữa.
  if (segments[0] === 'tasks' && segments[2] === 'rotation') {
    return data.task && data.task.taskId ? { ...data, task: transformTask(data.task) } : data
  }

  // ── Việc người khác nhờ tôi làm (/me/assigned) ──
  // Không khớp TASK_PATHS nên phải xử lý riêng; trả thẳng dạng đã sẵn dùng.
  if (segments[0] === 'me' && segments[1] === 'assigned') {
    if (Array.isArray(data)) return data.map(transformAssignedTask)
    // PUT /me/assigned/:taskId chỉ trả { taskId, doneAt } — không có gì để chuyển
    return data
  }

  // ── Category list ──
  if (matchPath(urlpath, CATEGORY_PATHS) && Array.isArray(data)) {
    return data.map(transformCategory)
  }

  // ── Single category ──
  if (matchPath(urlpath, CATEGORY_PATHS) && data.categoryId) {
    return transformCategory(data)
  }

  // ── Task list (paginated) ──
  if (matchPath(urlpath, TASK_PATHS) && isTaskListResponse(data)) {
    return {
      ...data,
      items: data.items.map(transformTask),
    }
  }

  // ── Task create response (returns { task, reminders }) ──
  if (matchPath(urlpath, TASK_PATHS) && data.task && data.task.taskId) {
    return {
      ...transformTask(data.task),
      reminders: (data.reminders || []).map(transformReminder),
    }
  }

  // ── Single task ──
  if (matchPath(urlpath, TASK_PATHS) && data.taskId) {
    return transformTask(data)
  }

  // ── Complete response ({ completedTask, nextTask }) ──
  if (matchPath(urlpath, TASK_PATHS) && data.completedTask) {
    return {
      completedTask: transformTask(data.completedTask),
      nextTask: data.nextTask ? transformTask(data.nextTask) : null,
    }
  }

  // ── Reminder list ──
  if (matchPath(urlpath, REMINDER_PATHS) && Array.isArray(data)) {
    return data.map(transformReminder)
  }

  // ── Single reminder ──
  if (matchPath(urlpath, REMINDER_PATHS) && data.reminderId) {
    return transformReminder(data)
  }

  // ── Device list ──
  if (matchPath(urlpath, DEVICE_PATHS) && Array.isArray(data)) {
    return data.map(transformDevice)
  }

  // ── Single device ──
  if (matchPath(urlpath, DEVICE_PATHS) && data.deviceId) {
    return transformDevice(data)
  }

  // ── Notification setting ──
  if (matchPath(urlpath, DEVICE_PATHS) && data.notificationSettingId) {
    return transformNotificationSetting(data)
  }

  // ── Notification log list (paginated) ──
  if (matchPath(urlpath, ['/logs']) && isTaskListResponse(data)) {
    return {
      ...data,
      items: data.items.map(transformNotificationLog),
    }
  }

  return data
}

export default function transformResponse(req, res, next) {
  // Override res.status().json() to intercept response
  const originalStatus = res.status.bind(res)

  res.status = function (code) {
    const res2 = originalStatus(code)

    // Override json to transform
    const originalJson = res2.json.bind(res2)
    res2.json = function (body) {
      if (body && body.success && body.data) {
        body.data = transformData(body.data, req.originalUrl)
      }
      return originalJson(body)
    }

    return res2
  }

  next()
}
