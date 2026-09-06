import prisma from '../config/prisma.js'

// ─── Find Queries ───────────────────────────────────────

async function findById(taskId, userId) {
  return prisma.task.findFirst({
    where: { taskId, userId },
    include: {
      category: { select: { categoryId: true, categoryName: true, colorCode: true } },
      subtasks: { orderBy: { displayOrder: 'asc' } },
      reminders: { orderBy: { remindAt: 'asc' } },
      _count: { select: { subtasks: true, reminders: true } },
    },
  })
}

async function findByUser(userId, where, orderBy, skip, take) {
  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy,
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

async function deleteTask(taskId) {
  return prisma.$transaction([
    prisma.subtask.deleteMany({ where: { taskId } }),
    prisma.reminder.deleteMany({ where: { taskId } }),
    prisma.task.delete({ where: { taskId } }),
  ])
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
    where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
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
  hasNotificationLogs,
  cancelRemindersByTask,
  findRemindersByTask,
  findCategoryById,
  countActive,
}
