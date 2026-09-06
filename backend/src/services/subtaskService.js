import taskRepo from '../repositories/taskRepo.js'
import subtaskRepo from '../repositories/subtaskRepo.js'
import ApiError from '../utils/ApiError.js'
import { getUserPlan, planLimit, planLimitError } from '../utils/planLimits.js'

async function assertOwnership(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')
}

// ─── List ───────────────────────────────────────────────

export async function findAll(userId, taskId) {
  await assertOwnership(userId, taskId)
  return subtaskRepo.findByTask(taskId)
}

// ─── Create ─────────────────────────────────────────────

export async function create(userId, taskId, content) {
  await assertOwnership(userId, taskId)

  // Giới hạn số việc con theo gói
  const plan = await getUserPlan(userId)
  const maxSubtasks = planLimit(plan, 'subtasksPerTask')
  if (maxSubtasks !== Infinity) {
    const count = await subtaskRepo.countByTask(taskId)
    if (count >= maxSubtasks) {
      throw planLimitError({ feature: 'việc con', limit: maxSubtasks, plan })
    }
  }

  const order = await subtaskRepo.findMaxDisplayOrder(taskId)
  return subtaskRepo.create(taskId, content, order)
}

// ─── Update ─────────────────────────────────────────────

export async function update(userId, taskId, subtaskId, content) {
  await assertOwnership(userId, taskId)
  const subtask = await subtaskRepo.findById(subtaskId, taskId)
  if (!subtask) throw ApiError.notFound('Không tìm thấy việc con')
  return subtaskRepo.update(subtaskId, { content })
}

// ─── Toggle Complete ────────────────────────────────────

export async function toggleComplete(userId, taskId, subtaskId) {
  await assertOwnership(userId, taskId)
  const subtask = await subtaskRepo.findById(subtaskId, taskId)
  if (!subtask) throw ApiError.notFound('Không tìm thấy việc con')
  return subtaskRepo.toggleComplete(subtaskId)
}

// ─── Delete ─────────────────────────────────────────────

export async function deleteSubtask(userId, taskId, subtaskId) {
  await assertOwnership(userId, taskId)
  const subtask = await subtaskRepo.findById(subtaskId, taskId)
  if (!subtask) throw ApiError.notFound('Không tìm thấy việc con')
  return subtaskRepo.deleteSubtask(subtaskId)
}
