import prisma from '../config/prisma.js'
import { parsePagination, paginationMeta } from '../utils/pagination.js'
import ApiError from '../utils/ApiError.js'
import { startOfDay } from '../utils/dateUtils.js'

// ─── Admin Dashboard ───────────────────────────────────

export async function getDashboard() {
  const now = new Date()
  const todayStart = startOfDay(now)

  const [totalUsers, activeUsers, totalTasks, notificationsToday, totalNotifications, tasksByStatus] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.task.count(),
      prisma.notificationLog.count({
        where: { sentAt: { gte: todayStart } },
      }),
      prisma.notificationLog.count(),
      prisma.task.groupBy({
        by: ['status'],
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
      isActive: true,
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
