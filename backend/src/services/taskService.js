import prisma from '../config/prisma.js'
import taskRepo from '../repositories/taskRepo.js'
import { calculateNextDueDate, serializeRepeatDays } from '../utils/dateUtils.js'
import { parsePagination, paginationMeta } from '../utils/pagination.js'
import ApiError from '../utils/ApiError.js'
import workspaceService from './workspaceService.js'
import { PLANS, getUserPlan, planLimit, planLimitError } from '../utils/planLimits.js'
import { parseNagEveryMinutes, assertNagAllowed } from './nagService.js'
import { nextTurnAssignee } from './taskShareService.js'


// ─── Ngữ cảnh không gian làm việc ──────────────────────────────────────
// workspace = null → Cá nhân truyền thống: task cũ (task_workspace_id = null)
// + task thuộc personal mặc định của user → API cũ không đổi một chữ nào.
// workspace STUDENT/TEAM → lọc chặt theo không gian, mọi thành viên đều thấy.
async function personalWorkspaceIds(userId) {
  const rows = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { type: 'PERSONAL' } },
    select: { workspaceId: true },
  })
  return rows.map((r) => r.workspaceId)
}

function scopeWhere(userId, workspace, personalIds) {
  if (workspace && workspace.type !== 'PERSONAL') {
    return { taskWorkspaceId: workspace.workspaceId }
  }
  return {
    userId,
    OR: [{ taskWorkspaceId: null }, ...(personalIds.length ? [{ taskWorkspaceId: { in: personalIds } }] : [])],
  }
}

/** Gói hiệu lực theo ngữ cảnh: nhóm dùng gói Owner không gian (chốt thiết kế). */
async function ctxPlan(userId, workspace) {
  if (workspace && workspace.type !== 'PERSONAL') {
    return workspaceService.workspacePlan(workspace)
  }
  return getUserPlan(userId)
}

/** Không gian của một task có taskWorkspaceId (null → Cá nhân truyền thống). */
async function workspaceOfTask(taskWorkspaceId) {
  if (!taskWorkspaceId) return null
  const ws = await prisma.workspace.findUnique({ where: { workspaceId: taskWorkspaceId } })
  return ws && ws.type !== 'PERSONAL' ? ws : null
}

// ─── Find All (List + Filter + Sort + Paginate) ─────────

export async function findAll(userId, query, workspace = null) {
  const { skip, take, page, pageSize } = parsePagination(query)

  // Build where
  const where = scopeWhere(userId, workspace, workspace ? [] : await personalWorkspaceIds(userId))
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

export async function create(userId, taskData, workspace = null) {
  const { title, description, categoryId, priority, dueAt, repeatType, repeatDays, reminders, assigneeId } = taskData

  // ── Giao việc ngay khi tạo (chỉ trong không gian Nhóm) ────────────────
  // Cá nhân/Lớp học mà gắn người làm là dữ liệu vô nghĩa (chủ việc không có
  // đồng đội trong không gian), nên báo lỗi thay vì âm thầm bỏ qua.
  let assignee = null
  if (assigneeId) {
    if (!workspace || workspace.type !== 'TEAM') {
      throw ApiError.badRequest('Chỉ chế độ Nhóm làm việc mới giao được việc cho thành viên')
    }
    const mid = Number(assigneeId)
    if (!Number.isInteger(mid) || mid <= 0) throw ApiError.badRequest('Người được giao không hợp lệ')
    if (mid === Number(userId)) throw ApiError.badRequest('Việc này do bạn phụ trách — không cần giao lại cho chính mình')
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.workspaceId, userId: mid },
      include: { user: { select: { userId: true, fullName: true } } },
    })
    if (!member) throw ApiError.badRequest('Người này không ở trong nhóm — gửi mã mời cho họ trước')
    assignee = member.user
  }

  // Validate categoryId belongs to user
  if (categoryId) {
    const cat = await taskRepo.findCategoryById(categoryId, userId)
    if (!cat) throw ApiError.badRequest('Danh mục không tồn tại')
  }

  // BR: dueAt phải ở tương lai — không được nhỏ hơn thời điểm hiện tại
  if (!(new Date(dueAt) > new Date())) {
    throw ApiError.badRequest('Thời điểm đến hạn phải lớn hơn thời điểm hiện tại')
  }

  // Gói FREE: không được tạo công việc lặp lại — gói theo NGỮ CẢNH không gian
  const plan = await ctxPlan(userId, workspace)
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

  // Giới hạn số công việc đang mở của NGỮ CẢNH này (cá nhân tách khỏi nhóm)
  const maxActive = planLimit(plan, 'activeTasks')
  if (maxActive !== Infinity) {
    const activeCount = await taskRepo.countActive(userId, {
      workspace,
      personalIds: workspace ? [] : await personalWorkspaceIds(userId),
    })
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
        // null = Cá nhân; STUDENT/TEAM = đúng không gian trong header X-Workspace
        taskWorkspaceId: workspace && workspace.type !== 'PERSONAL' ? workspace.workspaceId : null,
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

    // Lời giao việc: dùng chung bảng task_shares với tính năng "nhờ người khác
    // làm" để trang Việc được giao chỉ phải đọc MỘT nguồn, chuông nhắc vẫn
    // nhắm đúng người nhận (reminderDispatchService đọc task_shares).
    let share = null
    if (assignee) {
      share = await tx.taskShare.create({
        data: {
          taskId: task.taskId,
          assigneeId: assignee.userId,
          sharedById: userId,
          note: `Giao trong nhóm ${workspace.name}`,
        },
        include: { assignee: { select: { userId: true, fullName: true } } },
      })
    }

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

    return { task, reminders: savedReminders, share }
  }).then(async (result) => {
    // Báo cho người nhận ngay: không có thông báo thì việc được giao nằm im
    // đến khi họ tự mở app — đúng thứ app nhắc việc sinh ra để tránh.
    if (assignee && result.share) {
      try {
        const { pushToUser } = await import('./pushService.js')
        await pushToUser(assignee.userId, {
          title: '👥 Bạn được giao một việc',
          body: `${result.task.title} — hạn ${new Date(result.task.dueAt).toLocaleString('vi-VN')}`,
          taskId: result.task.taskId,
          url: '/app/assigned',
        })
      } catch (err) {
        console.error('[Workspace] Không gửi được thông báo giao việc:', err.message)
      }
    }
    return result
  })
}

// ─── Find By ID ─────────────────────────────────────────

export async function findById(userId, taskId, workspace = null) {
  const task = await taskRepo.findByIdAccessible(taskId, userId, { workspace })
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

  // Gói FREE: không được chuyển sang công việc lặp lại — gói theo ngữ cảnh không gian
  if (data.repeatType !== undefined && data.repeatType !== 'NONE') {
    const plan = await ctxPlan(userId, await workspaceOfTask(task.taskWorkspaceId))
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
    assertNagAllowed(await ctxPlan(userId, await workspaceOfTask(task.taskWorkspaceId)), nag)
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

export async function complete(userId, taskId, workspace = null) {
  // Trong không gian Nhóm, BẤT KỲ thành viên nào cũng bấm xong được việc chung
  // (đúng kiểu Jira: người làm xong là người đóng thẻ, không phải chờ chủ việc).
  const task = workspace
    ? await taskRepo.findByIdAccessible(taskId, userId, { workspace })
    : await taskRepo.findById(taskId, userId)
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
      const nextDueAt = calculateNextDueDate(task.dueAt, task.repeatType, task.repeatDays)
      // Danh sách người được giao của KỲ VỪA XONG — còn đủ người kể cả người vừa
      // làm, nên vòng xoay không bị ngắn dần sau mỗi kỳ.
      const oldShares = task.shares || []

      nextTask = await tx.task.create({
        data: {
          // Kỳ tiếp theo thuộc về CHỦ VIỆC (người tạo thẻ), kể cả khi thành viên
          // khác là người bấm hoàn thành trên bảng nhóm.
          userId: task.userId,
          categoryId: task.categoryId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          repeatType: task.repeatType,
          repeatDays: task.repeatDays,
          // Việc lặp lại giữ luôn chế độ nhắc dai: lần sau cũng phải nhắc tới khi xong
          nagEveryMinutes: task.nagEveryMinutes,
          // Luân phiên người làm: kỳ sau thuộc về NGƯỜI KẾ TIẾP trong danh sách đã
          // giao. Tính ở đây (chứ không ở giao diện) để kỳ sau đúng người kể cả khi
          // khách chỉ bấm Xong trên điện thoại.
          rotateEnabled: task.rotateEnabled,
          turnAssigneeId: task.rotateEnabled ? nextTurnAssignee(oldShares, task.turnAssigneeId) : null,
          dueAt: nextDueAt,
          parentTaskId: taskId,
        },
      })

      // Việc lặp lại giữ luôn người được giao: "đổ rác hằng tuần" giao cho con
      // thì tuần sau vẫn là việc của con, không phải giao lại từ đầu mỗi tuần.
      // doneAt để trống vì đây là kỳ MỚI — kỳ trước đã xong rồi.
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

// ─── Bảng công việc nhóm (Jira-lite) ────────────────────
// Ba cột duy nhất: Cần làm → Đang làm → Hoàn thành. Mọi thành viên trong nhóm
// đều kéo được thẻ (giống Jira: người làm xong là người đóng việc), nhưng chỉ
// hoạt động trong không gian TEAM — dùng ở Cá nhân sẽ làm lẫn dữ liệu.

const BOARD_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED']

/** Chuyển thẻ sang cột khác. */
export async function setStatus(userId, taskId, status, workspace = null) {
  if (!workspace || workspace.type !== 'TEAM') {
    throw ApiError.badRequest('Bảng công việc chỉ dùng trong chế độ Nhóm làm việc')
  }
  if (!BOARD_STATUSES.includes(status)) {
    throw ApiError.badRequest('Trạng thái không hợp lệ — chỉ TODO, IN_PROGRESS hoặc COMPLETED')
  }

  const task = await taskRepo.findByIdAccessible(taskId, userId, { workspace })
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')
  if (task.status === 'CANCELLED') throw ApiError.badRequest('Việc đã hủy nên không chuyển cột được')
  if (task.status === status) return { taskId, status }

  // Hoàn thành phải đi qua complete() để giữ nguyên: sinh việc lặp kế tiếp,
  // huỷ nhắc nhở còn lại, cộng thưởng — không viết lại logic đó ở đây.
  if (status === 'COMPLETED') {
    const result = await complete(userId, taskId, workspace)
    return { taskId, status, nextTask: result.nextTask }
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { taskId }, data: { status, completedAt: null } })
    // Kéo thẻ ra khỏi cột Hoàn thành = làm lại việc đó. Chuông của nó đã bị huỷ
    // khi hoàn thành, nên mở lại ĐÚNG những nhắc nhở còn ở tương lai — mở cả
    // nhắc đã qua sẽ dội chuông hàng loạt ngay khi vừa kéo thẻ.
    if (task.status === 'COMPLETED') {
      await tx.reminder.updateMany({
        where: { taskId, status: 'CANCELLED', remindAt: { gt: new Date() } },
        data: { status: 'SCHEDULED' },
      })
    }
  })
  return { taskId, status }
}

/** Gán người phụ trách (null = bỏ giao). Một người phụ trách như Jira. */
export async function setAssignee(userId, taskId, assigneeId, workspace = null) {
  if (!workspace || workspace.type !== 'TEAM') {
    throw ApiError.badRequest('Giao việc trên bảng chỉ dùng trong chế độ Nhóm làm việc')
  }
  const task = await taskRepo.findByIdAccessible(taskId, userId, { workspace })
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')

  if (assigneeId === null || assigneeId === undefined || assigneeId === '') {
    await prisma.taskShare.deleteMany({ where: { taskId } })
    return { taskId, assigneeId: null }
  }

  const mid = Number(assigneeId)
  if (!Number.isInteger(mid) || mid <= 0) throw ApiError.badRequest('Người được giao không hợp lệ')
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: workspace.workspaceId, userId: mid },
    include: { user: { select: { userId: true, fullName: true } } },
  })
  if (!member) throw ApiError.badRequest('Người này không ở trong nhóm — gửi mã mời cho họ trước')

  await prisma.$transaction(async (tx) => {
    // Một người phụ trách duy nhất: bỏ hết lời giao cũ rồi gán người mới.
    await tx.taskShare.deleteMany({ where: { taskId } })
    await tx.taskShare.create({
      data: { taskId, assigneeId: mid, sharedById: userId, note: `Giao trong nhóm ${workspace.name}` },
    })
    // Việc đang luân phiên mà đổi người phụ trách thì lượt phải về người mới,
    // không để lượt trỏ vào người vừa được thay.
    if (task.rotateEnabled) {
      await tx.task.update({ where: { taskId }, data: { turnAssigneeId: mid } })
    }
  })

  // Ai tự nhận việc thì không cần tự báo cho chính mình
  if (mid !== Number(userId)) {
    try {
      const { pushToUser } = await import('./pushService.js')
      await pushToUser(mid, {
        title: '👥 Bạn được giao một việc',
        body: `${task.title} — hạn ${new Date(task.dueAt).toLocaleString('vi-VN')}`,
        taskId,
        url: '/app/assigned',
      })
    } catch (err) {
      console.error('[Workspace] Không gửi được thông báo giao việc:', err.message)
    }
  }

  return { taskId, assigneeId: mid, assignee: member.user }
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
