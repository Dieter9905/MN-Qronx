import bcrypt from 'bcryptjs'
import prisma from '../config/prisma.js'
import { parsePagination, paginationMeta } from '../utils/pagination.js'
import ApiError from '../utils/ApiError.js'
import { startOfDay } from '../utils/dateUtils.js'
import { applyPlanChange } from './billingService.js'

// ─── Admin Dashboard ───────────────────────────────────

export async function getDashboard() {
  const now = new Date()
  const todayStart = startOfDay(now)

  const [totalUsers, activeUsers, totalTasks, notificationsToday, totalNotifications, tasksByStatus] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      // Việc trong thùng rác không tính vào thống kê của admin
      prisma.task.count({ where: { deletedAt: null } }),
      prisma.notificationLog.count({
        where: { sentAt: { gte: todayStart } },
      }),
      prisma.notificationLog.count(),
      prisma.task.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
    ])

  const statusMap = { TODO: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 }
  for (const row of tasksByStatus) {
    statusMap[row.status] = row._count
  }

  return {
    totalUsers,
    activeUsers,
    totalTasks,
    notificationsToday,
    totalNotifications,
    tasksByStatus: statusMap,
  }
}

// ─── Create User (Admin) ──────────────────────────────

export async function createUser({ fullName, email, password, phoneNumber, role }) {
  const normalizedEmail = String(email).trim().toLowerCase()

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { userId: true },
  })
  if (existing) {
    throw ApiError.badRequest('Email đã được sử dụng', { email: 'Email này đã tồn tại trong hệ thống' })
  }

  const roleName = role === 'ADMIN' ? 'ADMIN' : 'USER'
  const roleRow = await prisma.role.findUnique({
    where: { roleName },
    select: { roleId: true },
  })
  if (!roleRow) {
    throw ApiError.internal('Không tìm thấy vai trò mặc định')
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      roleId: roleRow.roleId,
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      passwordHash,
      phoneNumber: phoneNumber || null,
      isActive: true,
      notificationSetting: {
        create: {},
      },
    },
    select: {
      userId: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      avatarUrl: true,
      isActive: true,
      plan: true,
      planStartedAt: true,
      planExpiresAt: true,
      createdAt: true,
      role: { select: { roleName: true } },
      _count: { select: { tasks: true } },
    },
  })

  return user
}

// ─── Set User Plan (Admin) ────────────────────────────

export async function setUserPlan(userId, plan) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      fullName: true,
      email: true,
      plan: true,
      planStartedAt: true,
      planExpiresAt: true,
    },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')

  const validPlans = ['FREE', 'PLUS', 'PRO']
  if (!validPlans.includes(plan)) {
    throw ApiError.badRequest('Gói chỉ có thể là FREE, PLUS hoặc PRO')
  }

  // Đổi về FREE: xoá mốc thời gian và đóng các dòng Subscription đang mở.
  if (plan === 'FREE') {
    await prisma.subscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    })
    return prisma.user.update({
      where: { userId },
      data: { plan: 'FREE', planStartedAt: null, planExpiresAt: null },
      select: {
        userId: true,
        fullName: true,
        email: true,
        plan: true,
        planStartedAt: true,
        planExpiresAt: true,
      },
    })
  }

  // Sang gói trả phí: mở kỳ 30 ngày mới (đang còn hạn thì cộng dồn), đi qua
  // applyPlanChange để có dòng Subscription ghi rõ đây là gói admin tặng.
  const result = await applyPlanChange({
    userId,
    plan,
    cycle: 'MONTHLY',
    provider: 'ADMIN',
    note: 'Admin đổi gói thủ công',
  })
  return result.user
}

// ─── List Users ────────────────────────────────────────

export async function getUsers(query) {
  const { page, pageSize } = parsePagination(query)

  const result = await prisma.user.findMany({
    where: query.keyword
      ? {
          OR: [
            { fullName: { contains: query.keyword, mode: 'insensitive' } },
            { email: { contains: query.keyword, mode: 'insensitive' } },
          ],
        }
      : {},
    select: {
      userId: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      avatarUrl: true,
      isActive: true,
      plan: true,
      planStartedAt: true,
      planExpiresAt: true,
      createdAt: true,
      role: { select: { roleName: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  const total = await prisma.user.count({
    where: query.keyword
      ? {
          OR: [
            { fullName: { contains: query.keyword, mode: 'insensitive' } },
            { email: { contains: query.keyword, mode: 'insensitive' } },
          ],
        }
      : {},
  })

  return {
    items: result,
    pagination: paginationMeta(total, page, pageSize),
  }
}

// ─── Lock User ─────────────────────────────────────────

export async function lockUser(userId) {
  const user = await prisma.user.findUnique({ where: { userId }, select: { userId: true, role: { select: { roleName: true } }, isActive: true } })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  if (user.role.roleName === 'ADMIN') {
    throw ApiError.badRequest('Không thể khóa tài khoản Admin')
  }
  if (!user.isActive) {
    throw ApiError.badRequest('Tài khoản đã bị khóa')
  }

  return prisma.user.update({
    where: { userId },
    data: { isActive: false },
    select: { userId: true, fullName: true, email: true, isActive: true },
  })
}

// ─── Delete User (Admin) ───────────────────────────────
// Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu thuộc về nó.
// Lưu ý: các quan hệ trỏ tới User trong schema không khai báo onDelete: Cascade
// (trừ CustomSound), nên phải xoá con trước, cha sau, trong cùng một transaction
// để không vi phạm khoá ngoại và không để lại dữ liệu mồ côi.
export async function deleteUser(userId, currentUserId) {
  if (userId === currentUserId) {
    throw ApiError.badRequest('Không thể xoá tài khoản đang đăng nhập')
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      fullName: true,
      email: true,
      role: { select: { roleName: true } },
    },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  if (user.role.roleName === 'ADMIN') {
    throw ApiError.badRequest('Không thể xoá tài khoản Admin')
  }

  const deleted = await prisma.$transaction(async (tx) => {
    // 1. Nhật ký thông báo gắn với nhắc nhở / thiết bị của người dùng này
    const taskIds = (await tx.task.findMany({ where: { userId }, select: { taskId: true } })).map(
      (t) => t.taskId
    )
    const reminderIds = taskIds.length
      ? (await tx.reminder.findMany({ where: { taskId: { in: taskIds } }, select: { reminderId: true } })).map(
          (r) => r.reminderId
        )
      : []
    const deviceIds = (await tx.device.findMany({ where: { userId }, select: { deviceId: true } })).map(
      (d) => d.deviceId
    )

    const logFilters = []
    if (reminderIds.length) logFilters.push({ reminderId: { in: reminderIds } })
    if (deviceIds.length) logFilters.push({ deviceId: { in: deviceIds } })
    const notificationLogs = logFilters.length
      ? await tx.notificationLog.deleteMany({ where: { OR: logFilters } })
      : { count: 0 }

    // 2. Lời mời (cả hai phía: người mời và người được mời)
    const invitations = await tx.invitation.deleteMany({
      where: { OR: [{ inviterId: userId }, { inviteeId: userId }] },
    })

    // 3. Dữ liệu con còn lại của tài khoản
    const pointTransactions = await tx.pointTransaction.deleteMany({ where: { userId } })
    const passwordResets = await tx.passwordResetRequest.deleteMany({ where: { userId } })
    const refreshTokens = await tx.refreshToken.deleteMany({ where: { userId } })
    const customSounds = await tx.customSound.deleteMany({ where: { userId } })
    const settings = await tx.notificationSetting.deleteMany({ where: { userId } })

    // 4. Công việc: xoá subtask + nhắc nhở trước, rồi tới task và danh mục
    const subtasks = taskIds.length
      ? await tx.subtask.deleteMany({ where: { taskId: { in: taskIds } } })
      : { count: 0 }
    const reminders = taskIds.length
      ? await tx.reminder.deleteMany({ where: { taskId: { in: taskIds } } })
      : { count: 0 }
    const tasks = await tx.task.deleteMany({ where: { userId } })
    const categories = await tx.category.deleteMany({ where: { userId } })
    const devices = await tx.device.deleteMany({ where: { userId } })

    // 5. Mã xác minh email còn sót lại của địa chỉ email này
    const verificationCodes = await tx.emailVerificationCode.deleteMany({ where: { email: user.email } })

    // 6. Cuối cùng mới xoá tài khoản
    await tx.user.delete({ where: { userId } })

    return {
      tasks: tasks.count,
      categories: categories.count,
      reminders: reminders.count,
      subtasks: subtasks.count,
      devices: devices.count,
      notificationLogs: notificationLogs.count,
      invitations: invitations.count,
      pointTransactions: pointTransactions.count,
      customSounds: customSounds.count,
      notificationSettings: settings.count,
      passwordResetRequests: passwordResets.count,
      refreshTokens: refreshTokens.count,
      verificationCodes: verificationCodes.count,
    }
  })

  return { userId: user.userId, fullName: user.fullName, email: user.email, deleted }
}

// ─── Unlock User ───────────────────────────────────────

export async function unlockUser(userId) {
  const user = await prisma.user.findUnique({ where: { userId }, select: { userId: true, isActive: true } })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  if (user.isActive) {
    throw ApiError.badRequest('Tài khoản chưa bị khóa')
  }

  return prisma.user.update({
    where: { userId },
    data: { isActive: true },
    select: { userId: true, fullName: true, email: true, isActive: true },
  })
}
