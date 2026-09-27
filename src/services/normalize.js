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
    // Số lần chuông đã kêu lại trong chế độ nhắc dai. Thiếu dòng này thì trang chi
    // tiết không bao giờ hiện được "đã nhắc lại N lần vì việc chưa xong" — tính
    // năng chạy đúng ở máy chủ mà khách không thấy gì.
    nagCount: rem.nagCount ?? 0,
    createdAt: rem.createdAt,
  }
}

/** Một người được giao việc (gói Pro). */
export function toTaskShare(share) {
  if (!share) return null
  return {
    shareId: share.shareId,
    taskId: share.taskId,
    note: share.note || '',
    doneAt: share.doneAt || null,
    createdAt: share.createdAt,
    assignee: share.assignee
      ? {
          id: share.assignee.id ?? share.assignee.userId,
          fullName: share.assignee.fullName,
          email: share.assignee.email,
          avatarUrl: share.assignee.avatarUrl || null,
        }
      : null,
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
  // Hàm này là DANH SÁCH TRẮNG: trường nào không kể tên ở đây thì giao diện không
  // bao giờ thấy, dù máy chủ trả về đúng. Đã sập bẫy hai lần (nagEveryMinutes và
  // nagCount) nên khi máy chủ thêm trường mới cho công việc, phải thêm cả ở đây.
  const assignees = Array.isArray(task.assignees) ? task.assignees.map(toTaskShare) : []
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
    repeatDays: normalizeRepeatDays(task.repeatDays),
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
    overdue,
    category: toCategory(task.category),
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(toSubtask) : [],
    reminders: Array.isArray(task.reminders) ? task.reminders.map(toReminder) : [],
    // "Nhắc dai" (Pro): việc chưa xong thì chuông kêu lại mỗi N phút
    nagEveryMinutes: task.nagEveryMinutes ?? null,
    // Người được giao việc (Pro) + số người, để trang chi tiết và danh sách hiển thị.
    // Danh sách công việc trả dữ liệu THÔ (tên cột Prisma, chỉ có `_count.shares`)
    // còn trang chi tiết trả dữ liệu đã chuyển đổi (`shareCount`) — phải đọc cả hai,
    // nếu không thì nhãn "đã giao cho N người" không bao giờ hiện trong danh sách.
    assignees,
    shareCount: task.shareCount ?? task._count?.shares ?? assignees.length,
    // Luân phiên người làm (Pro): `order` là thứ tự lượt DO MÁY CHỦ sắp (cũ nhất
    // trước). Giao diện đọc thẳng — tự sắp lại ở trình duyệt là cách nhanh nhất để
    // màn hình nói "kỳ sau đến lượt chị" trong khi chuông kêu ở máy người khác.
    rotation: {
      enabled: !!task.rotation?.enabled,
      turnAssigneeId: task.rotation?.turnAssigneeId ?? null,
      order: Array.isArray(task.rotation?.order) ? task.rotation.order : [],
    },
  }
}

// repeatDays có thể là mảng, chuỗi "1,3,5" hoặc null → luôn trả về mảng hoặc null
function normalizeRepeatDays(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
  }
  return null
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
    planStartedAt: u.planStartedAt ?? null,
    planExpiresAt: u.planExpiresAt ?? null,
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
