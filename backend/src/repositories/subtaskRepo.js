import prisma from '../config/prisma.js'

async function findByTask(taskId) {
  return prisma.subtask.findMany({
    where: { taskId },
    orderBy: { displayOrder: 'asc' },
  })
}

async function findById(subtaskId, taskId) {
  return prisma.subtask.findFirst({
    where: { subtaskId, taskId },
  })
}

async function findMaxDisplayOrder(taskId) {
  const result = await prisma.subtask.aggregate({
    where: { taskId },
    _max: { displayOrder: true },
  })
  return (result._max.displayOrder ?? -1) + 1
}

async function create(taskId, content, displayOrder) {
  return prisma.subtask.create({
    data: { taskId, content, displayOrder },
  })
}

async function update(subtaskId, data) {
  return prisma.subtask.update({
    where: { subtaskId },
    data,
  })
}

async function toggleComplete(subtaskId) {
  const subtask = await prisma.subtask.findUnique({ where: { subtaskId } })
  return prisma.subtask.update({
    where: { subtaskId },
    data: { isCompleted: !subtask.isCompleted },
  })
}

async function deleteSubtask(subtaskId) {
  return prisma.subtask.delete({ where: { subtaskId } })
}

async function countByTask(taskId) {
  return prisma.subtask.count({ where: { taskId } })
}

export default {
  findByTask,
  findById,
  findMaxDisplayOrder,
  create,
  update,
  toggleComplete,
  deleteSubtask,
  countByTask,
}
