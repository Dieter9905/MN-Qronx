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

// ─── Luân phiên người làm ────────────────────────────────────
//
// Vì sao cần: "đổ rác hằng tuần" giao cho cả nhóm là vô nghĩa — không ai thấy mình
// chịu trách nhiệm, và cả nhóm cùng nhận chuông rồi cùng đoán kỳ này đến lượt ai.
// Luân phiên trả lời đúng câu đó, và vẫn chỉ gói trả phí có được vì nó nằm trên
// tính năng giao việc (người được nhờ vẫn không cần trả phí).

/**
 * Thứ tự lượt = thứ tự giao việc (cũ nhất trước).
 *
 * Cố ý KHÔNG dựa vào thứ tự dòng mà DB trả về: cùng một danh sách đi qua hai truy
 * vấn khác nhau (nhắc nhở lọc doneAt, trang chi tiết thì không) mà lệch thứ tự thì
 * kỳ sau rơi vào tay người khác nhau ở hai màn hình — loại lỗi khách chỉ phát hiện
 * khi đã trả tiền.
 */
export function rotationOrder(shares = []) {
  return [...shares].sort((a, b) => {
    const byDate = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    if (byDate !== 0) return byDate
    return Number(a.shareId || 0) - Number(b.shareId || 0)
  })
}

/**
 * Người đến lượt ở KỲ SAU. Hàm thuần vì đây là luật dễ sai nhất và sai thì IM LẶNG:
 * việc rơi vào tay người không biết mình có việc cho tới lúc chuông kêu, hoặc một
 * người làm mãi vì lượt cũ trỏ vào người đã bị gỡ khỏi việc.
 */
export function nextTurnAssignee(shares = [], currentTurnId) {
  const order = rotationOrder(shares)
  if (!order.length) return null
  const index = order.findIndex((s) => Number(s.assigneeId) === Number(currentTurnId))
  // Lượt hiện tại không còn trong danh sách (bị gỡ, hoặc lần đầu bật luân phiên):
  // bắt đầu lại từ người đầu tiên — hơn là để lượt trống, vì lượt trống nghĩa là
  // không ai được nhắc.
  if (index === -1) return Number(order[0].assigneeId)
  return Number(order[(index + 1) % order.length].assigneeId)
}

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

  // Việc đang luân phiên mà lượt đang trống (người cũ vừa bị gỡ) thì người mới
  // nhận lượt luôn — để trống là việc nằm không và không ai được nhắc.
  if (task.rotateEnabled && !task.turnAssigneeId) {
    await prisma.task.update({ where: { taskId }, data: { turnAssigneeId: assignee.userId } })
  }

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

  // Người bị thu hồi đang đến lượt: chuyển lượt NGAY sang người kế tiếp. Để lượt
  // trỏ vào người đã bị gỡ là việc nằm không — không ai được nhắc, và cả nhóm hiểu
  // nhầm rằng kỳ này đã có người lo.
  if (task.rotateEnabled && Number(task.turnAssigneeId) === Number(share.assigneeId)) {
    const after = nextTurnAssignee(task.shares || [], share.assigneeId)
    const nextTurn = Number(after) === Number(share.assigneeId) ? null : after
    await prisma.task.update({ where: { taskId }, data: { turnAssigneeId: nextTurn } })
  }

  const fresh = await taskRepo.findById(taskId, userId)
  return { removed: shareId, task: fresh }
}

/**
 * Bật/tắt luân phiên, hoặc đổi người của KỲ NÀY (chủ việc làm).
 * @returns {Promise<{ task: object }>} công việc đã cập nhật, kèm danh sách người được giao
 */
export async function setRotation(userId, taskId, { enabled, assigneeId } = {}) {
  await assertCanShare(userId)
  const task = await loadOwnTask(userId, taskId)
  const shares = rotationOrder(task.shares || [])
  const wantsTurn = assigneeId !== undefined && assigneeId !== null && assigneeId !== ''

  // Đổi người của kỳ này ("tuần này con ốm, mẹ làm"): chỉ đổi NGƯỜI, không bật/tắt.
  if (wantsTurn) {
    if (!task.rotateEnabled) {
      throw ApiError.badRequest('Việc này chưa bật luân phiên nên chưa đổi được người của kỳ này')
    }
    const target = shares.find((s) => Number(s.assigneeId) === Number(assigneeId))
    if (!target) throw ApiError.badRequest('Chỉ đổi được sang người đã được giao việc này')
    await prisma.task.update({ where: { taskId }, data: { turnAssigneeId: target.assigneeId } })
    const fresh = await taskRepo.findById(taskId, userId)
    return { task: fresh }
  }

  // Tắt luân phiên: việc trở lại "giao cho nhiều người, ai xong cũng được". Xoá
  // luôn cột lượt — để lại một cái tên vô nghĩa là mầm lỗi cho lần bật sau.
  if (enabled === false) {
    await prisma.task.update({ where: { taskId }, data: { rotateEnabled: false, turnAssigneeId: null } })
    const fresh = await taskRepo.findById(taskId, userId)
    return { task: fresh }
  }

  if (task.repeatType === 'NONE') {
    throw ApiError.badRequest(
      'Luân phiên chỉ dùng được cho việc lặp lại. Bật lặp lại (hằng ngày/tuần/tháng) cho việc này trước.'
    )
  }
  if (shares.length < 2) {
    throw ApiError.badRequest(
      'Cần giao việc này cho ít nhất 2 người rồi mới luân phiên được — một người thì không có gì để xoay.'
    )
  }

  // Giữ nguyên lượt đang có nếu người đó vẫn trong danh sách: bấm bật hai lần
  // không được đẩy lượt sang người khác.
  const current = shares.find((s) => Number(s.assigneeId) === Number(task.turnAssigneeId))
  const turnAssignee = current ? current.assigneeId : shares[0].assigneeId
  await prisma.task.update({
    where: { taskId },
    data: { rotateEnabled: true, turnAssigneeId: turnAssignee },
  })

  const fresh = await taskRepo.findById(taskId, userId)
  return { task: fresh }
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
  const shares = task?.shares || []
  const targets = [owner]

  // Việc luân phiên chỉ nhắc ĐÚNG người đến lượt. Nhắc cả nhóm là quay lại đúng
  // vấn đề mà luân phiên sinh ra để giải (không ai thấy mình chịu trách nhiệm) và
  // làm phiền người vừa làm xong kỳ trước. Chủ việc vẫn được nhắc như mọi việc
  // của mình — việc vẫn nằm trên bảng của họ.
  if (task?.rotateEnabled) {
    const turnId = Number(task.turnAssigneeId)
    const turnShare = shares.find((s) => Number(s.assigneeId) === turnId)
    if (turnShare && !turnShare.doneAt && turnId !== owner) targets.push(turnId)
    return targets
  }

  for (const share of shares) {
    const id = Number(share.assigneeId)
    if (!share.doneAt && id !== owner && !targets.includes(id)) targets.push(id)
  }
  return targets
}

export default {
  shareTask,
  listShares,
  revokeShare,
  setRotation,
  rotationOrder,
  nextTurnAssignee,
  listAssignedToMe,
  setMyDone,
  reminderTargetsForTask,
  MAX_ASSIGNEES_PER_TASK,
  MAX_OPEN_SHARES,
}
