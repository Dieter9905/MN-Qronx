import prisma from '../config/prisma.js'
import taskRepo from '../repositories/taskRepo.js'
import { calculateNextDueDate, serializeRepeatDays } from '../utils/dateUtils.js'
import { parsePagination, paginationMeta } from '../utils/pagination.js'
import ApiError from '../utils/ApiError.js'
import { PLANS, getUserPlan, planLimit, planLimitError } from '../utils/planLimits.js'
import { parseNagEveryMinutes, assertNagAllowed } from './nagService.js'


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
    // Sort by priority using a custom order via _count or manual sort
    // Prisma doesn't support enum sorting directly, use createdAt as tiebreaker
    orderBy = [{ priority: 'desc' }, { createdAt: 'desc' }]
  }

  const { items, total } = await taskRepo.findByUser(userId, where, orderBy, skip, take)

  return {
    items,
    pagination: paginationMeta(total, page, pageSize),
  }
}

// ─── Create Task + Reminders (TRANSACTION) ──────────────

export async function create(userId, taskData) {
  const { title, description, categoryId, priority, dueAt, repeatType, repeatDays, reminders } = taskData

  // Validate categoryId belongs to user
  if (categoryId) {
    const cat = await taskRepo.findCategoryById(categoryId, userId)
    if (!cat) throw ApiError.badRequest('Danh mục không tồn tại')
  }

  // BR: dueAt phải ở tương lai — không được nhỏ hơn thời điểm hiện tại
  if (!(new Date(dueAt) > new Date())) {
    throw ApiError.badRequest('Thời điểm đến hạn phải lớn hơn thời điểm hiện tại')
  }

  // Gói FREE: không được tạo công việc lặp lại
  const plan = await getUserPlan(userId)
  if (repeatType && repeatType !== 'NONE' && !PLANS[plan]?.repeatTasks) {
    throw ApiError.badRequest(
      'Công việc lặp lại chỉ dành cho gói Plus và Pro. Nâng cấp gói để sử dụng tính năng này.'
    )
  }

  // "Nhắc dai" (Pro): chuông kêu lại tới khi việc được xác nhận là xong
  const nagEveryMinutes = parseNagEveryMinutes(taskData.nagEveryMinutes)
  assertNagAllowed(plan, nagEveryMinutes)

  // Gói FREE: giới hạn số nhắc nhở mỗi công việc
  const maxReminders = planLimit(plan, 'remindersPerTask')
  if (reminders?.length > maxReminders) {
    throw ApiError.badRequest(
      `Gói ${PLANS[plan]?.name || 'Miễn phí'} chỉ được tối đa ${maxReminders} nhắc nhở mỗi công việc. Nâng cấp gói để thêm nhiều hơn.`
    )
  }

  // Gói FREE: giới hạn số công việc đang mở
  const maxActive = planLimit(plan, 'activeTasks')
  if (maxActive !== Infinity) {
    const activeCount = await taskRepo.countActive(userId)
    if (activeCount >= maxActive) {
      throw planLimitError({ feature: 'công việc đang mở', limit: maxActive, plan })
    }
  }

  // Validate: remindAt <= dueAt (BR-10) và remindAt phải ở tương lai
  for (const r of reminders || []) {
    if (new Date(r.remindAt) > new Date(dueAt)) {
      throw ApiError.badRequest('Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc')
    }
    if (!(new Date(r.remindAt) > new Date())) {
      throw ApiError.badRequest('Thời điểm nhắc nhở phải lớn hơn thời điểm hiện tại')
    }
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
        repeatDays: repeatType === 'WEEKLY' ? serializeRepeatDays(repeatDays) : null,
        nagEveryMinutes,
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

  // Gói FREE: không được chuyển sang công việc lặp lại
  if (data.repeatType !== undefined && data.repeatType !== 'NONE') {
    const plan = await getUserPlan(userId)
    if (!PLANS[plan]?.repeatTasks) {
      throw ApiError.badRequest(
        'Công việc lặp lại chỉ dành cho gói Plus và Pro. Nâng cấp gói để sử dụng tính năng này.'
      )
    }
  }

  const updateData = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.dueAt !== undefined) {
    const newDue = new Date(data.dueAt)
    // Chỉ chặn khi người dùng thực sự đổi sang thời điểm quá khứ
    // (cho phép lưu công việc quá hạn mà không đụng tới thời hạn cũ)
    if (!(newDue > new Date()) && newDue.getTime() !== new Date(task.dueAt).getTime()) {
      throw ApiError.badRequest('Thời điểm đến hạn phải lớn hơn thời điểm hiện tại')
    }
    updateData.dueAt = newDue
  }
  if (data.priority !== undefined) updateData.priority = data.priority
  if (data.nagEveryMinutes !== undefined) {
    const nag = parseNagEveryMinutes(data.nagEveryMinutes)
    assertNagAllowed(await getUserPlan(userId), nag)
    updateData.nagEveryMinutes = nag
  }
  if (data.repeatType !== undefined) {
    updateData.repeatType = data.repeatType
    // Không lặp → xoá luôn danh sách ngày cũ
    if (data.repeatType === 'NONE') updateData.repeatDays = null
  }
  if (data.repeatDays !== undefined && updateData.repeatType === 'WEEKLY') {
    updateData.repeatDays = serializeRepeatDays(data.repeatDays)
  }
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null

  return taskRepo.update(taskId, updateData)
}

// ─── Delete ─────────────────────────────────────────────

export async function deleteTask(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')

  // Thùng rác thay cho xoá thật: dữ liệu, việc con và lịch sử thông báo đều
  // giữ nguyên nên KHÔNG CÒN cấm xoá việc đã từng nhắc — người dùng không sợ
  // mất gì. Chỉ nhắc nhở TƯƠNG LAI bị huỷ để không báo cho việc đã đưa đi.
  await taskRepo.cancelRemindersByTask(taskId)
  return taskRepo.softDelete(taskId)
}

// ─── Thùng rác ─────────────────────────────────────────────────

/** Danh sách việc đã xoá (giữ 30 ngày, sort mới nhất trước). */
export async function listTrash(userId, query = {}) {
  const { skip, take, page, pageSize } = parsePagination(query)
  const { items, total } = await taskRepo.listTrash(userId, { skip, take })
  return { items, pagination: paginationMeta(total, page, pageSize) }
}

/** Khôi phục một việc từ thùng rác (đồng thời bật lại nhắc tương lai). */
export async function restoreTask(userId, taskId) {
  const task = await taskRepo.restore(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy việc trong thùng rác')
  return task
}

/** Xoá sạch thùng rác — không hoàn tác được, trả về số việc đã xoá. */
export async function emptyTrash(userId) {
  const removed = await taskRepo.emptyTrash(userId)
  return { removed }
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
      where: { taskId, userId },
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
      const nextDueAt = calculateNextDueDate(task.dueAt, task.repeatType, task.repeatDays)

      nextTask = await tx.task.create({
        data: {
          userId,
          categoryId: task.categoryId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          repeatType: task.repeatType,
          repeatDays: task.repeatDays,
          // Việc lặp lại giữ luôn chế độ nhắc dai: lần sau cũng phải nhắc tới khi xong
          nagEveryMinutes: task.nagEveryMinutes,
          dueAt: nextDueAt,
          parentTaskId: taskId,
        },
      })

      // Việc lặp lại giữ luôn người được giao: "đổ rác hằng tuần" giao cho con
      // thì tuần sau vẫn là việc của con, không phải giao lại từ đầu mỗi tuần.
      // doneAt để trống vì đây là kỳ MỚI — kỳ trước đã xong rồi.
      const oldShares = task.shares || []
      if (oldShares.length) {
        await tx.taskShare.createMany({
          data: oldShares.map((s) => ({
            taskId: nextTask.taskId,
            assigneeId: s.assigneeId,
            sharedById: s.sharedById,
            note: s.note,
          })),
        })
      }

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
      where: { taskId, userId },
      data: { status: 'CANCELLED' },
    })

    await tx.reminder.updateMany({
      where: { taskId, status: { in: ['SCHEDULED', 'TRIGGERED'] } },
      data: { status: 'CANCELLED' },
    })

    return { taskId, status: 'CANCELLED' }
  })
}
