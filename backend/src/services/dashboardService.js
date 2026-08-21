import prisma from '../config/prisma.js'
import { startOfDay, endOfDay } from '../utils/dateUtils.js'

// ─── Get Dashboard ─────────────────────────────────────

export async function getDashboard(userId) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  // Promise.all chạy song song 4 query đếm
  const [todayCount, overdueCount, completedCount, upcomingCount] =
    await Promise.all([
      // Task hôm nay (đến hạn hôm nay, chưa xong)
      prisma.task.count({
        where: {
          userId,
          dueAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
      // Task quá hạn (đến hạn < now, chưa xong)
      prisma.task.count({
        where: {
          userId,
          dueAt: { lt: now },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
      // Task đã hoàn thành
      prisma.task.count({
        where: { userId, status: 'COMPLETED' },
      }),
      // Task sắp tới (đến hạn > now, chưa xong)
      prisma.task.count({
        where: {
          userId,
          dueAt: { gt: now },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
    ])

  return { todayCount, overdueCount, completedCount, upcomingCount }
}
