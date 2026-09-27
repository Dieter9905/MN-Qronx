/**
 * Response Transformers
 * Map backend Prisma field names → frontend mock DB field names
 *
 * Frontend uses: { id, name, color } etc.
 * Backend uses:  { categoryId, categoryName, colorCode } etc.
 */

import { parseRepeatDays } from './dateUtils.js'
// Thứ tự lượt luân phiên phải do MỘT chỗ định nghĩa (taskShareService) — giao diện
// đọc đúng thứ tự đó để nói "kỳ sau đến lượt ai", thay vì tự đoán ở trình duyệt.
import { rotationOrder } from '../services/taskShareService.js'

// ─── User ──────────────────────────────────────────────

export function transformUser(user) {
  if (!user) return null
  return {
    id: user.userId,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber || '',
    avatarUrl: user.avatarUrl || null,
    role: user.role?.roleName || user.roleName || 'USER',
    plan: user.plan || 'FREE',
    planStartedAt: user.planStartedAt || null,
    planExpiresAt: user.planExpiresAt || null,
    points: user.points || 0,
    loginStreak: user.loginStreak || 0,
    lastLoginDate: user.lastLoginDate || null,
    inviteCode: user.inviteCode || null,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }
}

export function transformUserPublic(user) {
  if (!user) return null
  const { passwordHash, ...rest } = user
  return transformUser(rest)
}

// ─── Category ──────────────────────────────────────────

export function transformCategory(cat) {
  if (!cat) return null
  return {
    id: cat.categoryId,
    userId: cat.userId,
    name: cat.categoryName,
    color: cat.colorCode || '#2563EB',
    isActive: cat.isActive,
    createdAt: cat.createdAt,
    taskCount: cat._count?.tasks ?? cat.taskCount ?? 0,
  }
}

// ─── Subtask ───────────────────────────────────────────

export function transformSubtask(sub) {
  if (!sub) return null
  return {
    id: sub.subtaskId,
    taskId: sub.taskId,
    content: sub.content,
    isCompleted: sub.isCompleted,
    displayOrder: sub.displayOrder,
    createdAt: sub.createdAt,
  }
}

// ─── Reminder ──────────────────────────────────────────

export function transformReminder(rem) {
  if (!rem) return null
  return {
    id: rem.reminderId,
    taskId: rem.taskId,
    remindAt: rem.remindAt,
    status: rem.status,
    snoozeCount: rem.snoozeCount,
    // Số lần chuông đã kêu lại trong chế độ nhắc dai (gói Pro)
    nagCount: rem.nagCount ?? 0,
    createdAt: rem.createdAt,
  }
}

// ─── Giao việc cho người khác (Pro) ────────────────────

/**
 * Một dòng "việc này giao cho người này" (nhìn từ phía chủ việc).
 * Cố ý KHÔNG trả email của người nhận ra ngoài danh sách công khai — chỉ dùng để
 * hiển thị lại cho chính chủ việc, người đã tự nhập email đó.
 */
export function transformTaskShare(share) {
  if (!share) return null
  return {
    shareId: share.shareId,
    taskId: share.taskId,
    note: share.note || '',
    doneAt: share.doneAt || null,
    createdAt: share.createdAt,
    assignee: share.assignee
      ? {
          id: share.assignee.userId,
          fullName: share.assignee.fullName,
          email: share.assignee.email,
          avatarUrl: share.assignee.avatarUrl || null,
        }
      : null,
  }
}

/**
 * Một việc NGƯỜI KHÁC nhờ tôi làm (nhìn từ phía người nhận).
 * Trả kèm đủ thông tin để hiển thị việc mà không phải mở /tasks/:id — người được
 * giao không có quyền xem chi tiết việc của chủ qua đường đó.
 */
export function transformAssignedTask(share) {
  if (!share || !share.task) return null
  const t = share.task
  return {
    shareId: share.shareId,
    taskId: share.taskId,
    title: t.title,
    description: t.description || '',
    priority: t.priority,
    status: t.status,
    dueAt: t.dueAt,
    dueOverdue: t.dueAt ? new Date(t.dueAt).getTime() < Date.now() : false,
    note: share.note || '',
    doneAt: share.doneAt || null,
    completed: t.status === 'COMPLETED' || t.status === 'CANCELLED',
    // Luân phiên người làm: người nhận cần biết KỲ NÀY có phải lượt của mình không
    // — không có dòng này thì trang "Việc được giao" hiện mọi việc giống nhau và
    // người đến lượt không biết mình đang bị chờ.
    rotateEnabled: Boolean(t.rotateEnabled),
    isMyTurn: Boolean(t.rotateEnabled) && Number(t.turnAssigneeId) === Number(share.assigneeId),
    category: t.category ? transformCategory(t.category) : null,
    nextReminderAt: t.reminders?.[0]?.remindAt || null,
    assignedBy: share.sharedBy
      ? {
          id: share.sharedBy.userId,
          fullName: share.sharedBy.fullName,
          avatarUrl: share.sharedBy.avatarUrl || null,
        }
      : null,
    assignedAt: share.createdAt,
  }
}

// ─── Task (enriched) ───────────────────────────────────

export function transformTask(task) {
  if (!task) return null
  // Một thứ tự duy nhất cho cả danh sách người được giao lẫn vòng xoay lượt.
  const shares = rotationOrder(Array.isArray(task.shares) ? task.shares : [])
  return {
    id: task.taskId,
    userId: task.userId,
    categoryId: task.categoryId,
    parentTaskId: task.parentTaskId || null,
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    status: task.status,
    dueAt: task.dueAt,
    repeatType: task.repeatType,
    repeatDays: parseRepeatDays(task.repeatDays),
    completedAt: task.completedAt || null,
    createdAt: task.createdAt,
    // "Nhắc dai" (Pro): việc chưa xong thì chuông kêu lại mỗi N phút
    nagEveryMinutes: task.nagEveryMinutes ?? null,
    overdue: task.overdue ?? false,
    category: task.category ? transformCategory(task.category) : null,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(transformSubtask) : [],
    reminders: Array.isArray(task.reminders) ? task.reminders.map(transformReminder) : [],
    // Người được giao việc (Pro). shareCount có cả trong danh sách (nhờ _count) để
    // trang Công việc hiện được nhãn "đã giao cho N người" mà không tốn thêm query.
    assignees: shares.map(transformTaskShare),
    shareCount: task._count?.shares ?? shares.length,
    // Luân phiên người làm (Pro): kỳ này ai chịu trách nhiệm, và thứ tự lượt để
    // giao diện nói được "kỳ sau đến lượt ai". `order` là danh sách id người nhận.
    rotation: {
      enabled: Boolean(task.rotateEnabled),
      turnAssigneeId: task.rotateEnabled ? (task.turnAssigneeId ?? null) : null,
      order: shares.map((s) => Number(s.assigneeId)),
    },
  }
}

// ─── Device ────────────────────────────────────────────

export function transformDevice(dev) {
  if (!dev) return null
  return {
    id: dev.deviceId,
    userId: dev.userId,
    name: dev.name || `${dev.platform} Device`,
    platform: dev.platform,
    isActive: dev.isActive,
    lastSeenAt: dev.lastSeenAt || dev.updatedAt || dev.createdAt,
    createdAt: dev.createdAt,
  }
}

// ─── Notification Setting ──────────────────────────────

export function transformNotificationSetting(setting) {
  if (!setting) return null
  return {
    userId: setting.userId,
    alarmSound: setting.alarmSound,
    defaultSnoozeMinutes: setting.defaultSnoozeMinutes,
    vibrationEnabled: setting.vibrationEnabled,
    updatedAt: setting.updatedAt,
  }
}

// ─── Notification Log ──────────────────────────────────

export function transformNotificationLog(log) {
  if (!log) return null
  return {
    id: log.notificationLogId,
    userId: log.userId || log.reminder?.task?.userId,
    taskId: log.taskId || log.reminder?.taskId,
    taskTitle: log.taskTitle || log.reminder?.task?.title,
    deviceName: log.deviceName || log.device?.platform || 'Unknown',
    action: log.action,
    sentAt: log.sentAt,
  }
}
