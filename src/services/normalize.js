// Chuẩn hoá dữ liệu backend (Express/Prisma) về shape frontend
// Frontend quen dùng: { id, name, color } thay vì { categoryId, categoryName, colorCode }…

export function toCategory(cat) {
  if (!cat) return null
  return {
    id: cat.id ?? cat.categoryId,
    userId: cat.userId,
    name: cat.name ?? cat.categoryName,
    color: cat.color ?? cat.colorCode ?? '#2563EB',
    isActive: cat.isActive ?? true,
    createdAt: cat.createdAt,
    taskCount: cat.taskCount ?? cat._count?.tasks ?? 0,
  }
}

export function toSubtask(sub) {
  if (!sub) return null
  return {
    id: sub.id ?? sub.subtaskId,
    taskId: sub.taskId,
    content: sub.content,
    isCompleted: sub.isCompleted ?? false,
    displayOrder: sub.displayOrder ?? 0,
    createdAt: sub.createdAt,
  }
}

export function toReminder(rem) {
  if (!rem) return null
  return {
    id: rem.id ?? rem.reminderId,
    taskId: rem.taskId,
    remindAt: rem.remindAt,
    status: rem.status,
    snoozeCount: rem.snoozeCount ?? 0,
    createdAt: rem.createdAt,
  }
}

export function toTask(task) {
  if (!task) return null
  const overdue =
    task.overdue ??
    (task.status !== 'COMPLETED' &&
      task.status !== 'CANCELLED' &&
      task.dueAt &&
      new Date(task.dueAt) < new Date())
  return {
    id: task.id ?? task.taskId,
    userId: task.userId,
    categoryId: task.categoryId ?? null,
    parentTaskId: task.parentTaskId ?? null,
    title: task.title,
    description: task.description ?? '',
    priority: task.priority ?? 'MEDIUM',
    status: task.status ?? 'TODO',
    dueAt: task.dueAt,
    repeatType: task.repeatType ?? 'NONE',
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
    overdue,
    category: toCategory(task.category),
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(toSubtask) : [],
    reminders: Array.isArray(task.reminders) ? task.reminders.map(toReminder) : [],
  }
}

export function toUser(u) {
  if (!u) return null
  return {
    id: u.id ?? u.userId,
    fullName: u.fullName,
    email: u.email,
    phoneNumber: u.phoneNumber ?? '',
    avatarUrl: u.avatarUrl ?? null,
    role: u.role?.roleName ?? u.role ?? 'USER',
    plan: u.plan ?? 'FREE',
    isActive: u.isActive ?? true,
    createdAt: u.createdAt,
  }
}

export function toDevice(dev) {
  if (!dev) return null
  return {
    id: dev.id ?? dev.deviceId,
    userId: dev.userId,
    name: dev.name || `${dev.platform || 'Web'} – Trình duyệt hiện tại`,
    platform: dev.platform,
    isActive: dev.isActive,
    lastSeenAt: dev.lastSeenAt || dev.updatedAt || dev.createdAt,
    createdAt: dev.createdAt,
  }
}

export function toNotificationLog(log) {
  if (!log) return null
  const task = log.reminder?.task
  return {
    id: log.id ?? log.notificationLogId,
    userId: log.userId ?? task?.userId,
    taskId: log.taskId ?? log.reminder?.taskId ?? task?.taskId,
    taskTitle: log.taskTitle ?? task?.title,
    deviceName:
      log.deviceName || (log.device ? `${log.device.platform || 'Web'}` : 'Web – Trình duyệt hiện tại'),
    action: log.action,
    sentAt: log.sentAt ?? log.createdAt,
  }
}

export function toSettings(s) {
  if (!s) return null
  return {
    userId: s.userId,
    alarmSound: s.alarmSound ?? 'classic',
    defaultSnoozeMinutes: s.defaultSnoozeMinutes ?? 10,
    vibrationEnabled: s.vibrationEnabled ?? true,
    updatedAt: s.updatedAt,
  }
}

// Backend đôi khi trả { items, pagination: { total, page, pageSize } } thay vì để ở top-level
// → chuẩn hoá về { items, total, page, pageSize } mà frontend quen dùng.
export function paginate(data, page = 1, pageSize = 20) {
  const pg = data?.pagination
  return {
    items: data?.items ?? [],
    total: pg?.total ?? data?.total ?? 0,
    page: pg?.page ?? data?.page ?? Number(page),
    pageSize: pg?.pageSize ?? data?.pageSize ?? Number(pageSize),
  }
}
