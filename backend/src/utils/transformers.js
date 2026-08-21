/**
 * Response Transformers
 * Map backend Prisma field names → frontend mock DB field names
 *
 * Frontend uses: { id, name, color } etc.
 * Backend uses:  { categoryId, categoryName, colorCode } etc.
 */

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
    createdAt: rem.createdAt,
  }
}

// ─── Task (enriched) ───────────────────────────────────

export function transformTask(task) {
  if (!task) return null
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
    completedAt: task.completedAt || null,
    createdAt: task.createdAt,
    overdue: task.overdue ?? false,
    category: task.category ? transformCategory(task.category) : null,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(transformSubtask) : [],
    reminders: Array.isArray(task.reminders) ? task.reminders.map(transformReminder) : [],
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
