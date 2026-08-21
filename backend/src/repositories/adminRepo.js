import prisma from '../config/prisma.js'

// ─── Dashboard Stats ───────────────────────────────────

async function getStats() {
  const now = new Date()

  const [totalUsers, totalTasks, activeTasks, notificationsToday] =
    await Promise.all([
      prisma.user.count(),
      prisma.task.count(),
      prisma.task.count({
        where: { status: { in: ['TODO', 'IN_PROGRESS'] } },
      }),
      prisma.notificationLog.count({
        where: {
          sentAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
      }),
    ])

  return { totalUsers, totalTasks, activeTasks, notificationsToday }
}

// ─── User List (search + paginate) ─────────────────────

async function findUsers({ keyword, page, pageSize }) {
  const where = {}
  if (keyword) {
    where.OR = [
      { fullName: { contains: keyword, mode: 'insensitive' } },
      { email: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
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
    }),
    prisma.user.count({ where }),
  ])

  return { items, total, page, pageSize }
}

// ─── Find User By ID ───────────────────────────────────

async function findUserById(userId) {
  return prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      fullName: true,
      email: true,
      isActive: true,
      role: { select: { roleName: true } },
    },
  })
}

// ─── Lock / Unlock ─────────────────────────────────────

async function setActive(userId, isActive) {
  return prisma.user.update({
    where: { userId },
    data: { isActive },
    select: {
      userId: true,
      fullName: true,
      email: true,
      isActive: true,
    },
  })
}

export default {
  getStats,
  findUsers,
  findUserById,
  setActive,
}
