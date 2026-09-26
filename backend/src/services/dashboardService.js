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
          // Việc đã đưa vào thùng rác không được tính/hiện ở dashboard
          deletedAt: null,
          dueAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
      prisma.task.count({
        where: {
          userId,
          // Việc đã đưa vào thùng rác không được tính/hiện ở dashboard
          deletedAt: null,
          dueAt: { lt: now },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
      prisma.task.count({
        where: { userId, status: 'COMPLETED', deletedAt: null },
      }),
      prisma.task.count({
        where: {
          userId,
          // Việc đã đưa vào thùng rác không được tính/hiện ở dashboard
          deletedAt: null,
          dueAt: { gt: now },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
      }),
      prisma.task.findMany({
        where: {
          userId,
          // Việc đã đưa vào thùng rác không được tính/hiện ở dashboard
          deletedAt: null,
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
          // Việc đã đưa vào thùng rác không được tính/hiện ở dashboard
          deletedAt: null,
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
