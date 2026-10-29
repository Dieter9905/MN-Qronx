import prisma from '../config/prisma.js'

// ─── Find Queries ───────────────────────────────────────

// Include chi tiết dùng chung cho mọi truy vấn theo taskId (tránh lặp 4 lần)
const TASK_DETAIL_INCLUDE = {
  category: { select: { categoryId: true, categoryName: true, colorCode: true } },
  subtasks: { orderBy: { displayOrder: 'asc' } },
  reminders: { orderBy: { remindAt: 'asc' } },
  // Người được giao việc (gói Pro) — cần cả khi sinh việc lặp kế tiếp để giữ
  // nguyên danh sách người được giao, giống cách giữ chế độ nhắc dai.
  shares: {
    orderBy: { createdAt: 'asc' },
    include: { assignee: { select: { userId: true, fullName: true, email: true, avatarUrl: true } } },
  },
  _count: { select: { subtasks: true, reminders: true, shares: true } },
}

async function findById(taskId, userId, { includeDeleted = false } = {}) {
  return prisma.task.findFirst({
    where: { taskId, userId, ...(includeDeleted ? {} : { deletedAt: null }) },
    include: TASK_DETAIL_INCLUDE,
  })
}

/**
 * Đọc chi tiết có xét quyền theo không gian: trong STUDENT/TEAM mọi thành viên
 * đều xem được việc của không gian (role check do middleware/giai đoạn sau lo);
 * ngoài không gian đó thì chỉ chủ việc (đúng như API cũ).
 */
async function findByIdAccessible(taskId, userId, { workspace = null } = {}) {
  if (workspace && workspace.type !== 'PERSONAL') {
    return prisma.task.findFirst({
      where: { taskId, taskWorkspaceId: workspace.workspaceId, deletedAt: null },
      include: TASK_DETAIL_INCLUDE,
    })
  }
  return findById(taskId, userId)
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
        // Người phụ trách: bảng công việc kiểu Jira phải hiện được avatar ai làm
        // việc nào ngay trên thẻ, nên danh sách trả luôn shares (không chỉ _count).
        shares: {
          orderBy: { createdAt: 'asc' },
          include: { assignee: { select: { userId: true, fullName: true, avatarUrl: true } } },
        },
        _count: { select: { subtasks: true, reminders: true, shares: true } },
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
    // Người được giao cũng phải mất theo — nếu không, xoá vĩnh viễn sẽ vướng khoá
    // ngoại, và "việc được giao" còn lại dòng trỏ vào việc không tồn tại.
    prisma.taskShare.deleteMany({ where: { taskId: { in: ids } } }),
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
    // Người được giao cũng phải mất theo — nếu không, xoá vĩnh viễn sẽ vướng khoá
    // ngoại, và "việc được giao" còn lại dòng trỏ vào việc không tồn tại.
    prisma.taskShare.deleteMany({ where: { taskId: { in: ids } } }),
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
 * Có scope không gian: TASK nhóm chỉ đếm trong không gian đó (quota nhóm tách
 * khỏi quota cá nhân — "2 gói song song" theo ngữ cảnh request).
 */
async function countActive(userId, { workspace = null, personalIds = [] } = {}) {
  const statusWhere = { status: { in: ['TODO', 'IN_PROGRESS'] }, deletedAt: null }
  if (workspace && workspace.type !== 'PERSONAL') {
    return prisma.task.count({
      where: { taskWorkspaceId: workspace.workspaceId, ...statusWhere },
    })
  }
  // Cá nhân: task cũ (taskWorkspaceId = null) + task thuộc personal mặc định
  return prisma.task.count({
    where: {
      userId,
      OR: [{ taskWorkspaceId: null }, ...(personalIds.length ? [{ taskWorkspaceId: { in: personalIds } }] : [])],
      ...statusWhere,
    },
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
  findByIdAccessible,
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
