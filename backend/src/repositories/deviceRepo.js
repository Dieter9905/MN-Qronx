import prisma from '../config/prisma.js'

// ─── Device Queries ────────────────────────────────────

async function findByToken(deviceToken) {
  return prisma.device.findUnique({ where: { deviceToken } })
}

async function findByUser(userId) {
  return prisma.device.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
  })
}

async function findById(deviceId) {
  return prisma.device.findUnique({ where: { deviceId } })
}

async function create(userId, deviceToken, platform) {
  return prisma.device.create({
    data: { userId, deviceToken, platform, isActive: true },
  })
}

async function update(deviceId, data) {
  return prisma.device.update({ where: { deviceId }, data })
}

/**
 * Count active devices of a user – dùng cho giới hạn gói.
 */
async function countActive(userId) {
  return prisma.device.count({ where: { userId, isActive: true } })
}

// ─── NotificationSetting Queries ───────────────────────

async function findSetting(userId) {
  return prisma.notificationSetting.findUnique({
    where: { userId },
  })
}

async function createSetting(userId) {
  return prisma.notificationSetting.create({
    data: { userId },
  })
}

async function updateSetting(userId, data) {
  return prisma.notificationSetting.update({
    where: { userId },
    data,
  })
}

// ─── NotificationLog Queries ───────────────────────────

async function findLogs(userId, { from, to, action, page, pageSize }) {
  const where = {
    reminder: { task: { userId } },
  }

  if (from || to) {
    where.sentAt = {}
    if (from) where.sentAt.gte = new Date(from)
    if (to) where.sentAt.lte = new Date(to)
  }

  if (action) {
    where.action = action
  }

  const [items, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      include: {
        reminder: {
          include: {
            task: { select: { taskId: true, title: true } },
          },
        },
        device: { select: { deviceId: true, platform: true } },
      },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notificationLog.count({ where }),
  ])

  return { items, total, page, pageSize }
}

export default {
  findByToken,
  findByUser,
  findById,
  create,
  update,
  countActive,
  findSetting,
  createSetting,
  updateSetting,
  findLogs,
}
