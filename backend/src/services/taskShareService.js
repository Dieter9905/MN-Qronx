import prisma from '../config/prisma.js'
import taskRepo from '../repositories/taskRepo.js'
import ApiError from '../utils/ApiError.js'
import { getUserPlan, planAllows } from '../utils/planLimits.js'

// Dịch vụ này trả dữ liệu THÔ (đúng tên cột Prisma); middleware transformResponse
// chuyển sang dạng giao diện dùng — một chỗ định hình dữ liệu trả về, giống mọi
// dịch vụ khác. Chuyển ở đây rồi bị chuyển lần nữa là cách chắc chắn nhất để mất
// tên người được giao.

// ─── Giao việc cho người khác (gói Pro) ──────────────────────
//
// Vì sao là tính năng Pro: mọi thứ Pro đang bán đều là "một mình bạn làm tốt hơn".
// Giao việc là thứ đầu tiên Free/Plus KHÔNG THỂ có bằng cách nào khác — muốn nhờ
// người khác làm thì phải trả tiền. Đây là kiểu quyền lợi bán được nhất: không
// phải "nới trần", mà là "mở ra việc trước đây không làm được".
//
// Người NHẬN không cần gói trả phí. Cố ý như vậy: mỗi lần một khách Pro nhờ người
// khác, người đó phải tạo tài khoản MN-Qronx và sẽ thấy việc được giao kèm chuông —
// đường lớn nhất để có thêm khách mà không tốn tiền quảng cáo.
//
// Lan can an toàn: người được giao KHÔNG sửa/xoá được việc, và mọi truy vấn cũ vẫn
// khoá theo tasks.user_id nên không có đường nào để họ nhìn thấy việc khác của chủ.

/** Trần số người nhận một việc. Quá nhiều thì không ai thấy mình có trách nhiệm. */
export const MAX_ASSIGNEES_PER_TASK = 5

/** Trần số việc đang giao đi của một tài khoản — chặn lạm dụng, không chặn người dùng thật. */
export const MAX_OPEN_SHARES = 50

/** Trả về đúng quyền lợi của gói: chỉ Pro được giao việc. */
async function assertCanShare(userId) {
  const plan = await getUserPlan(userId)
  if (planAllows(plan, 'taskSharing')) return plan
  throw ApiError.badRequest(
    'Nhờ người khác làm là tính năng của gói Pro. Nâng cấp lên Pro để giao việc cho người khác và nhận thông báo khi họ xong.'
  )
}

/** Việc phải là việc của CHÍNH người gọi và chưa kết thúc. */
async function loadOwnTask(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    throw ApiError.badRequest('Công việc đã kết thúc nên không giao được nữa')
  }
  return task
}

/**
 * Nhờ một người khác làm việc này (theo email tài khoản MN-Qronx của họ).
 * @returns {Promise<{ share: object, task: object }>}
 */
export async function shareTask(userId, taskId, { email, note } = {}) {
  await assertCanShare(userId)

  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) throw ApiError.badRequest('Cần email của người bạn muốn nhờ')

  const task = await loadOwnTask(userId, taskId)

  const assignee = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
    select: { userId: true, fullName: true, email: true, avatarUrl: true },
  })

  // Người được nhờ chưa có tài khoản: đây là lúc tốt nhất để mời họ — nói rõ cần
  // làm gì thay vì chỉ báo "không tìm thấy".
  if (!assignee) {
    throw ApiError.badRequest(
      `${cleanEmail} chưa có tài khoản MN-Qronx. Hãy rủ họ đăng ký (họ dùng miễn phí), rồi giao lại việc này.`,
      { needInvite: true, email: cleanEmail }
    )
  }
  if (assignee.userId === userId) {
    throw ApiError.badRequest('Bạn không thể giao việc cho chính mình')
  }

  const existing = await prisma.taskShare.findUnique({
    where: { taskId_assigneeId: { taskId, assigneeId: assignee.userId } },
  })
  if (existing) throw ApiError.badRequest(`${assignee.fullName} đã được giao việc này rồi`)

  const count = await prisma.taskShare.count({ where: { taskId } })
  if (count >= MAX_ASSIGNEES_PER_TASK) {
    throw ApiError.badRequest(
      `Một việc chỉ giao được cho tối đa ${MAX_ASSIGNEES_PER_TASK} người. Việc này đã đủ người.`
    )
  }

  const open = await prisma.taskShare.count({ where: { sharedById: userId, doneAt: null } })
  if (open >= MAX_OPEN_SHARES) {
    throw ApiError.badRequest(
      `Bạn đang có ${open} việc giao đi mà chưa ai xong. Hãy thu hồi bớt trước khi giao thêm.`
    )
  }

  const share = await prisma.taskShare.create({
    data: {
      taskId,
      assigneeId: assignee.userId,
      sharedById: userId,
      note: note ? String(note).trim().slice(0, 255) : null,
    },
    include: { assignee: { select: { userId: true, fullName: true, email: true, avatarUrl: true } } },
  })

  // Thông báo đẩy cho người nhận: không có nó thì họ chỉ biết khi tự mở app — mà
  // thói quen làm hỏng việc nhờ vả chính là người nhận không biết mình có việc mới.
  try {
    const { pushToUser } = await import('./pushService.js')
    await pushToUser(assignee.userId, {
      title: '👥 Bạn được nhờ một việc',
      body: `${task.title} — hạn ${task.dueAt ? new Date(task.dueAt).toLocaleString('vi-VN') : 'không rõ'}`,
      taskId: task.taskId,
      url: '/app/assigned',
    })
  } catch (err) {
    console.error('[Share] Không gửi được thông báo cho người được giao:', err.message)
  }

  const fresh = await taskRepo.findById(taskId, userId)
  return { share, task: fresh }
}

/** Danh sách người được giao của một việc — chỉ chủ việc xem được. */
export async function listShares(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')
  return task.shares || []
}

/** Thu hồi việc đã giao (chủ việc làm). */
export async function revokeShare(userId, taskId, shareId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')

  const share = await prisma.taskShare.findFirst({ where: { shareId, taskId } })
  if (!share) throw ApiError.notFound('Không tìm thấy người được giao này')

  await prisma.taskShare.delete({ where: { shareId } })
  const fresh = await taskRepo.findById(taskId, userId)
  return { removed: shareId, task: fresh }
}

/**
 * Việc người khác nhờ TÔI làm, còn đang mở.
 * Việc bị chủ xoá (thùng rác) không hiện — họ đã bỏ thì không nên còn nhắc tôi.
 */
export async function listAssignedToMe(userId) {
  const shares = await prisma.taskShare.findMany({
    where: {
      assigneeId: userId,
      task: { deletedAt: null },
    },
    orderBy: [{ doneAt: 'asc' }, { createdAt: 'desc' }],
    include: {
      sharedBy: { select: { userId: true, fullName: true, email: true, avatarUrl: true } },
      task: {
        include: {
          category: { select: { categoryId: true, categoryName: true, colorCode: true } },
          reminders: { where: { status: 'SCHEDULED' }, orderBy: { remindAt: 'asc' }, take: 1 },
        },
      },
    },
  })
  return shares
}

/**
 * Người được giao tự đánh dấu xong phần của mình (hoặc bỏ đánh dấu).
 * KHÔNG đụng tới trạng thái của việc — việc chỉ hoàn thành khi chủ việc bấm xong.
 */
export async function setMyDone(userId, taskId, done) {
  const share = await prisma.taskShare.findUnique({
    where: { taskId_assigneeId: { taskId, assigneeId: userId } },
  })
  if (!share) throw ApiError.notFound('Việc này không được giao cho bạn')

  const updated = await prisma.taskShare.update({
    where: { shareId: share.shareId },
    data: { doneAt: done ? new Date() : null },
  })

  // Báo cho chủ việc biết — họ nhờ người khác làm nên cần biết đã xong.
  if (done) {
    try {
      const task = await prisma.task.findUnique({
        where: { taskId },
        select: { title: true, userId: true },
      })
      const me = await prisma.user.findUnique({
        where: { userId },
        select: { fullName: true },
      })
      if (task) {
        const { pushToUser } = await import('./pushService.js')
        await pushToUser(task.userId, {
          title: '✅ Người được giao đã xong',
          body: `${me?.fullName || 'Người được giao'} báo xong: ${task.title}`,
          taskId,
          url: `/app/tasks/${taskId}`,
        })
      }
    } catch (err) {
      console.error('[Share] Không báo được cho chủ việc:', err.message)
    }
  }

  return { taskId, doneAt: updated.doneAt }
}

/**
 * Ai phải nhận chuông khi một nhắc nhở của việc này kêu: chủ việc, cộng những
 * người được giao CHƯA báo xong.
 *
 * Tách thành hàm thuần (không truy vấn, không mạng) vì đây là luật dễ sai nhất và
 * dễ gây khó chịu nhất: nhắc nhầm người đã làm xong là làm phiền khách, còn quên
 * nhắc người chưa làm là tính năng vô dụng.
 *
 * `task.shares` có thể không có (những chỗ gọi dispatchReminder cũ) → coi như không
 * có ai được giao.
 */
export function reminderTargetsForTask(task, ownerUserId) {
  const owner = Number(ownerUserId)
  const targets = [owner]
  for (const share of task?.shares || []) {
    const id = Number(share.assigneeId)
    if (!share.doneAt && id !== owner && !targets.includes(id)) targets.push(id)
  }
  return targets
}

export default {
  shareTask,
  listShares,
  revokeShare,
  listAssignedToMe,
  setMyDone,
  reminderTargetsForTask,
  MAX_ASSIGNEES_PER_TASK,
  MAX_OPEN_SHARES,
}
