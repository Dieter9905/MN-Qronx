import prisma from '../config/prisma.js'

// ─── Find Queries ───────────────────────────────────────

async function findById(taskId, userId, { includeDeleted = false } = {}) {
  return prisma.task.findFirst({
    where: { taskId, userId, ...(includeDeleted ? {} : { deletedAt: null }) },
    include: {
      category: { select: { categoryId: true, categoryName: true, colorCode: true } },
      subtasks: { orderBy: { displayOrder: 'asc' } },
      reminders: { orderBy: { remindAt: 'asc' } },
      _count: { select: { subtasks: true, reminders: true } },
    },
  })
}

async function findByUser(userId, where, orderBy, skip, take) {
  // Điểm chụm: mọi bộ lọc của trang Công việc đều đi qua đây → gộp điều kiện
  // thùng rác một chỗ duy nhất, không thể sót.
  const aliveWhere = { ...where, deletedAt: null }
  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where: aliveWhere,
      orderBy,
      skip,
      take,
      include: {
        category: { select: { categoryId: true, categoryName: true, colorCode: true } },
        _count: { select: { subtasks: true, reminders: true } },
      },
    }),
    prisma.task.count({ where: aliveWhere }),
  ])
  return { items, total }
}

// ─── Create ─────────────────────────────────────────────

async function create(userId, data) {
  return prisma.task.create({
    data: { userId, ...data },
  })
}

async function createManyReminders(taskId, reminders) {
  if (!reminders.length) return []
  return prisma.reminder.createMany({
    data: reminders.map((r) => ({
      taskId,
      remindAt: r.remindAt,
      status: 'SCHEDULED',
    })),
  })
}

// ─── Update ─────────────────────────────────────────────

async function updateStatus(taskId, status, completedAt = undefined) {
  const data = { status }
  if (completedAt !== undefined) data.completedAt = completedAt
  return prisma.task.update({ where: { taskId }, data })
}

async function update(taskId, data) {
  return prisma.task.update({ where: { taskId }, data })
}

// ─── Delete ─────────────────────────────────────────────

/** Đưa việc vào thùng rác — không xoá dòng nên khôi phục được trong 30 ngày. */
async function softDelete(taskId) {
  return prisma.task.update({
    where: { taskId },
    data: { deletedAt: new Date() },
  })
}

async function deleteTask(taskId) {
  return prisma.$transaction([
    prisma.subtask.deleteMany({ where: { taskId } }),
    prisma.reminder.deleteMany({ where: { taskId } }),
    prisma.task.delete({ where: { taskId } }),
  ])
}

// ─── Thùng rác ────────────────────────────────────────────

async function listTrash(userId, { skip = 0, take = 50 } = {}) {
  const where = { userId, deletedAt: { not: null } }
  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      skip,
      take,
      include: {
        category: { select: { categoryId: true, categoryName: true, colorCode: true } },
        _count: { select: { subtasks: true, reminders: true } },
      },
    }),
    prisma.task.count({ where }),
  ])
  return { items, total }
}

/** Khôi phục một việc; nhắc nhở tương lai đã huỷ khi xoá thì bật lại. */
async function restore(taskId, userId) {
  const task = await prisma.task.findFirst({
    where: { taskId, userId, deletedAt: { not: null } },
  })
  if (!task) return null

  await prisma.task.update({ where: { taskId }, data: { deletedAt: null } })
  await prisma.reminder.updateMany({
    where: { taskId, status: 'CANCELLED', remindAt: { gt: new Date() } },
    data: { status: 'SCHEDULED' },
  })
  return prisma.task.findFirst({
    where: { taskId, userId },
    include: {
      category: { select: { categoryId: true, categoryName: true, colorCode: true } },
      subtasks: { orderBy: { displayOrder: 'asc' } },
      reminders: { orderBy: { remindAt: 'asc' } },
    },
  })
}

/** Xoá sạch thùng rác của một người (không hoàn tác được). */
async function emptyTrash(userId) {
  const ids = (
    await prisma.task.findMany({
      where: { userId, deletedAt: { not: null } },
      select: { taskId: true },
    })
  ).map((t) => t.taskId)
  if (ids.length === 0) return 0

  await prisma.$transaction([
    prisma.reminder.deleteMany({ where: { taskId: { in: ids } } }),
    prisma.subtask.deleteMany({ where: { taskId: { in: ids } } }),
    prisma.task.deleteMany({ where: { taskId: { in: ids } } }),
  ])
  return ids.length
}

/** Tự xoá thật việc đã ở thùng rác quá `days` ngày (gọi từ lập lịch). */
async function purgeExpired(days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000)
  const ids = (
    await prisma.task.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { taskId: true },
    })
  ).map((t) => t.taskId)
  if (ids.length === 0) return 0

  await prisma.$transaction([
    prisma.reminder.deleteMany({ where: { taskId: { in: ids } } }),
    prisma.subtask.deleteMany({ where: { taskId: { in: ids } } }),
    prisma.task.deleteMany({ where: { taskId: { in: ids } } }),
  ])
  return ids.length
}

// ─── Notification Log Check ─────────────────────────────

async function hasNotificationLogs(taskId) {
  const count = await prisma.notificationLog.count({
    where: { reminder: { taskId } },
  })
  return count > 0
}

// ─── Plan Limit Helper ──────────────────────────────────

/**
 * Đếm số công việc đang mở (TODO / IN_PROGRESS) của user – dùng cho giới hạn gói.
 */
async function countActive(userId) {
  return prisma.task.count({
    where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] }, deletedAt: null },
  })
}

// ─── Reminder Helpers ───────────────────────────────────

async function cancelRemindersByTask(taskId) {
  return prisma.reminder.updateMany({
    where: { taskId, status: { in: ['SCHEDULED', 'TRIGGERED'] } },
    data: { status: 'CANCELLED' },
  })
}

async function findRemindersByTask(taskId) {
  return prisma.reminder.findMany({
    where: { taskId },
    orderBy: { remindAt: 'asc' },
  })
}

// ─── Category Ownership Check ───────────────────────────

async function findCategoryById(categoryId, userId) {
  return prisma.category.findFirst({
    where: { categoryId, userId },
  })
}

export default {
  findById,
  findByUser,
  create,
  createManyReminders,
  updateStatus,
  update,
  deleteTask,
  softDelete,
  listTrash,
  restore,
  emptyTrash,
  purgeExpired,
  hasNotificationLogs,
  cancelRemindersByTask,
  findRemindersByTask,
  findCategoryById,
  countActive,
}
