import prisma from '../config/prisma.js'
import { startOfDay, endOfDay } from '../utils/dateUtils.js'

// ─── Get Dashboard ─────────────────────────────────────

export async function getDashboard(userId) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  const [todayCount, overdueCount, completedCount, upcomingCount, todayTasksRaw, overdueTasksRaw] =
    await Promise.all([
      prisma.task.count({
        where: {
          userId,
          dueAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
      prisma.task.count({
        where: {
          userId,
          dueAt: { lt: now },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
      prisma.task.count({
        where: { userId, status: 'COMPLETED' },
      }),
      prisma.task.count({
        where: {
          userId,
          dueAt: { gt: now },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
      prisma.task.findMany({
        where: {
          userId,
          dueAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
        include: {
          category: true,
          subtasks: true,
          reminders: { orderBy: { remindAt: 'asc' } },
        },
        orderBy: { dueAt: 'asc' },
      }),
      prisma.task.findMany({
        where: {
          userId,
          dueAt: { lt: now },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
        include: {
          category: true,
          subtasks: true,
          reminders: { orderBy: { remindAt: 'asc' } },
        },
        orderBy: { dueAt: 'asc' },
      }),
    ])

  const todayTasks = todayTasksRaw.map((t) => ({ ...t, overdue: false }))
  const overdueTasks = overdueTasksRaw.map((t) => ({ ...t, overdue: true }))

  return {
    todayCount,
    overdueCount,
    completedCount,
    upcomingCount,
    todayTasks,
    overdueTasks,
  }
}
