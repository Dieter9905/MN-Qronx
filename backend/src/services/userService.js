import bcrypt from 'bcryptjs'
import userRepo from '../repositories/userRepo.js'
import ApiError from '../utils/ApiError.js'
import { startOfDay, endOfDay } from '../utils/dateUtils.js'
import { isPlanExpired, downgradeUser } from '../utils/planLimits.js'

// ─── Get Profile ────────────────────────────────────────

export async function getProfile(userId) {
  const user = await userRepo.findProfile(userId)
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')

  // Gói trả phí đã quá hạn → hạ FREE ngay (và trả về gói hiệu lực)
  if (isPlanExpired(user)) {
    await downgradeUser(userId)
    user.plan = 'FREE'
    user.planStartedAt = null
    user.planExpiresAt = null
  }

  return {
    userId: user.userId,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    avatarUrl: user.avatarUrl,
    role: user.role.roleName,
    plan: user.plan || 'FREE',
    planStartedAt: user.planStartedAt || null,
    planExpiresAt: user.planExpiresAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

// ─── Update Profile ─────────────────────────────────────

export async function updateProfile(userId, { fullName, phoneNumber, avatarUrl }) {
  const user = await userRepo.findProfile(userId)
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')

  // Chỉ update các field được truyền
  const data = {}
  if (fullName !== undefined) data.fullName = fullName
  if (phoneNumber !== undefined) data.phoneNumber = phoneNumber
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest('Không có thông tin nào để cập nhật')
  }

  return userRepo.updateProfile(userId, data)
}

// ─── Change Password ────────────────────────────────────

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepo.findByIdWithPassword(userId)
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!isMatch) {
    throw ApiError.badRequest('Mật khẩu hiện tại không đúng')
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await userRepo.updatePassword(userId, passwordHash)

  return { message: 'Đổi mật khẩu thành công' }
}

// ─── Stats (GET /me/stats) ──────────────────────────────

export async function getStats(userId) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  const [todayCount, overdueCount, completedCount, activeCategories, activeDevices] =
    await Promise.all([
      // Task đến hạn hôm nay (chưa hoàn thành)
      userRepo.countTasks(userId, {
        dueAt: { gte: todayStart, lte: todayEnd },
        status: { in: ['TODO', 'IN_PROGRESS'] },
      }),
      // Task quá hạn (đã quá deadline, chưa xong)
      userRepo.countTasks(userId, {
        dueAt: { lt: now },
        status: { in: ['TODO', 'IN_PROGRESS'] },
      }),
      // Task đã hoàn thành
      userRepo.countTasks(userId, { status: 'COMPLETED' }),
      // Category đang active
      userRepo.countCategories(userId),
      // Device đang active
      userRepo.countDevices(userId),
    ])

  return {
    todayCount,
    overdueCount,
    completedCount,
    activeCategories,
    activeDevices,
  }
}

// ─── Recent Activity (GET /me/activity) ─────────────────

export async function getRecentActivity(userId) {
  const logs = await userRepo.findRecentLogs(userId, 5)

  return logs.map((log) => ({
    notificationLogId: log.notificationLogId,
    action: log.action,
    sentAt: log.sentAt,
    taskTitle: log.reminder.task.title,
    taskId: log.reminder.task.taskId,
    remindAt: log.reminder.remindAt,
  }))
}
