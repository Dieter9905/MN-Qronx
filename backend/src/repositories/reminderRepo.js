import prisma from '../config/prisma.js'

async function findByTask(taskId) {
  return prisma.reminder.findMany({
    where: { taskId },
    orderBy: { remindAt: 'asc' },
  })
}

async function findById(reminderId) {
  return prisma.reminder.findUnique({
    where: { reminderId },
    include: {
      task: {
        include: {
          user: { select: { userId: true, fullName: true } },
        },
      },
    },
  })
}

async function findDueReminders(now, userId) {
  const where = {
    status: 'SCHEDULED',
    remindAt: { lte: now },
  }
  if (userId) {
    where.task = { userId }
  }
  return prisma.reminder.findMany({
    where,
    include: {
      task: {
        include: {
          user: { select: { userId: true, fullName: true } },
        },
      },
    },
    orderBy: { remindAt: 'asc' },
  })
}

async function countActiveByTask(taskId) {
  return prisma.reminder.count({
    where: {
      taskId,
      status: { not: 'CANCELLED' },
    },
  })
}

async function create(taskId, remindAt) {
  return prisma.reminder.create({
    data: {
      taskId,
      remindAt: new Date(remindAt),
      status: 'SCHEDULED',
    },
  })
}

async function update(reminderId, data) {
  return prisma.reminder.update({
    where: { reminderId },
    data,
  })
}

async function deleteReminder(reminderId) {
  return prisma.reminder.delete({
    where: { reminderId },
  })
}

export default {
  findByTask,
  findById,
  findDueReminders,
  countActiveByTask,
  create,
  update,
  deleteReminder,
}
