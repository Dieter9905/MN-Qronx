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
  return prefixes.some((p) => urlpath.includes(p))
}

function isTaskListResponse(data) {
  return data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)
}

function transformData(data, urlpath) {
  if (!data || typeof data !== 'object') return data

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
    // Complete/cancel response
    if (data.completedTask) {
      return {
        completedTask: transformTask(data.completedTask),
        nextTask: data.nextTask ? transformTask(data.nextTask) : null,
      }
    }
    return transformTask(data)
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
