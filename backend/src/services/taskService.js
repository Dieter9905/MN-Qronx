import prisma from '../config/prisma.js'
import taskRepo from '../repositories/taskRepo.js'
import { calculateNextDueDate } from '../utils/dateUtils.js'
import { parsePagination, paginationMeta } from '../utils/pagination.js'
import ApiError from '../utils/ApiError.js'


// ─── Find All (List + Filter + Sort + Paginate) ─────────

export async function findAll(userId, query) {
  const { skip, take, page, pageSize } = parsePagination(query)

  // Build where
  const where = { userId }
  if (query.status) where.status = query.status
  if (query.priority) where.priority = query.priority
  if (query.categoryId) where.categoryId = parseInt(query.categoryId)
  if (query.keyword) {
    where.title = { contains: query.keyword, mode: 'insensitive' }
  }
  if (query.dueFrom || query.dueTo) {
    where.dueAt = {}
    if (query.dueFrom) where.dueAt.gte = new Date(query.dueFrom)
    if (query.dueTo) where.dueAt.lte = new Date(query.dueTo)
  }

  // Build orderBy
  let orderBy = { createdAt: 'desc' }
  if (query.sort === 'dueAsc') orderBy = { dueAt: 'asc' }
  else if (query.sort === 'dueDesc') orderBy = { dueAt: 'desc' }
  else if (query.sort === 'priorityDesc') {
    // Prisma không sort by enum directly, dùng createdAt thay thế
    orderBy = { createdAt: 'desc' }
  }

  const { items, total } = await taskRepo.findByUser(userId, where, orderBy, skip, take)

  return {
    items,
    pagination: paginationMeta(total, page, pageSize),
  }
}

// ─── Create Task + Reminders (TRANSACTION) ──────────────

export async function create(userId, taskData) {
  const { title, description, categoryId, priority, dueAt, repeatType, reminders } = taskData

  // Validate categoryId belongs to user
  if (categoryId) {
    const cat = await taskRepo.findCategoryById(categoryId, userId)
    if (!cat) throw ApiError.badRequest('Danh mục không tồn tại')
  }

  // Validate: remindAt <= dueAt cho mỗi reminder (BR-10)
  for (const r of reminders || []) {
    if (new Date(r.remindAt) > new Date(dueAt)) {
      throw ApiError.badRequest('Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc')
    }
  }

  // Validate: max 5 reminders (BR-09)
  if (reminders?.length > 5) {
    throw ApiError.badRequest('Mỗi công việc chỉ được có tối đa 5 nhắc nhở')
  }

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        userId,
        title,
        description,
        categoryId: categoryId || null,
        priority: priority || 'MEDIUM',
        dueAt: new Date(dueAt),
        repeatType: repeatType || 'NONE',
      },
    })

    let savedReminders = []
    if (reminders?.length) {
      await tx.reminder.createMany({
        data: reminders.map((r) => ({
          taskId: task.taskId,
          remindAt: new Date(r.remindAt),
          status: 'SCHEDULED',
        })),
      })
      savedReminders = await tx.reminder.findMany({
        where: { taskId: task.taskId },
        orderBy: { remindAt: 'asc' },
      })
    }

    return { task, reminders: savedReminders }
  })
}

// ─── Find By ID ─────────────────────────────────────────

export async function findById(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')
  return task
}

// ─── Update ─────────────────────────────────────────────

export async function update(userId, taskId, data) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')

  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    throw ApiError.badRequest('Không thể cập nhật công việc đã kết thúc')
  }

  // Validate categoryId if provided
  if (data.categoryId) {
    const cat = await taskRepo.findCategoryById(data.categoryId, userId)
    if (!cat) throw ApiError.badRequest('Danh mục không tồn tại')
  }

  const updateData = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.dueAt !== undefined) updateData.dueAt = new Date(data.dueAt)
  if (data.priority !== undefined) updateData.priority = data.priority
  if (data.repeatType !== undefined) updateData.repeatType = data.repeatType
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null

  return taskRepo.update(taskId, updateData)
}

// ─── Delete ─────────────────────────────────────────────

export async function deleteTask(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')

  // ERD-R-18: Không xóa khi đã có notification log
  const hasLogs = await taskRepo.hasNotificationLogs(taskId)
  if (hasLogs) {
    throw ApiError.badRequest(
      'Không thể xóa công việc đã phát sinh thông báo. Hãy hủy thay vì xóa.'
    )
  }

  return taskRepo.deleteTask(taskId)
}

// ─── Complete + Repeat Logic ────────────────────────────

export async function complete(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    throw ApiError.badRequest('Công việc đã kết thúc')
  }

  return prisma.$transaction(async (tx) => {
    // 1. Đánh dấu hoàn thành
    await tx.task.update({
      where: { taskId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    // 2. Hủy tất cả reminder chưa kích hoạt (BR-11, ERD-R-13)
    await tx.reminder.updateMany({
      where: { taskId, status: { in: ['SCHEDULED', 'TRIGGERED'] } },
      data: { status: 'CANCELLED' },
    })

    // 3. Sinh task repeat kế tiếp (BR-15, ERD-R-14)
    let nextTask = null
    if (task.repeatType !== 'NONE') {
      const nextDueAt = calculateNextDueDate(task.dueAt, task.repeatType)

      nextTask = await tx.task.create({
        data: {
          userId,
          categoryId: task.categoryId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          repeatType: task.repeatType,
          dueAt: nextDueAt,
          parentTaskId: taskId,
        },
      })

      // Copy reminders sang task mới (giữ nguyên khoảng cách với dueAt)
      const oldReminders = task.reminders
      if (oldReminders.length) {
        await tx.reminder.createMany({
          data: oldReminders.map((r) => ({
            taskId: nextTask.taskId,
            remindAt: new Date(
              new Date(nextDueAt).getTime() -
                (new Date(task.dueAt) - new Date(r.remindAt))
            ),
            status: 'SCHEDULED',
          })),
        })
      }
    }

    return { completedTask: { taskId, status: 'COMPLETED' }, nextTask }
  })
}

// ─── Reopen ─────────────────────────────────────────────

export async function reopen(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')
  if (task.status !== 'COMPLETED' && task.status !== 'CANCELLED') {
    throw ApiError.badRequest('Chỉ có thể mở lại công việc đã hoàn thành hoặc đã hủy')
  }

  return taskRepo.update(taskId, { status: 'TODO', completedAt: null })
}

// ─── Cancel ─────────────────────────────────────────────

export async function cancel(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    throw ApiError.badRequest('Công việc đã kết thúc')
  }

  return prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { taskId },
      data: { status: 'CANCELLED' },
    })

    await tx.reminder.updateMany({
      where: { taskId, status: { in: ['SCHEDULED', 'TRIGGERED'] } },
      data: { status: 'CANCELLED' },
    })

    return { taskId, status: 'CANCELLED' }
  })
}
