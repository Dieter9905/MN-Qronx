import prisma from '../config/prisma.js'
import taskRepo from '../repositories/taskRepo.js'
import reminderRepo from '../repositories/reminderRepo.js'
import { addMinutes } from '../utils/dateUtils.js'
import ApiError from '../utils/ApiError.js'

const DEFAULT_SNOOZE_MINUTES = 5

// ─── Find By Task ───────────────────────────────────────

export async function findByTask(userId, taskId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')
  return reminderRepo.findByTask(taskId)
}

// ─── Find By ID ─────────────────────────────────────────

export async function findById(userId, reminderId) {
  const reminder = await reminderRepo.findById(reminderId)
  if (!reminder) throw ApiError.notFound('Không tìm thấy nhắc nhở')
  if (reminder.task.userId !== userId) throw ApiError.forbidden()
  return reminder
}

// ─── Create ─────────────────────────────────────────────

export async function create(userId, taskId, remindAt) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')

  // BR-10: remindAt <= dueAt
  if (new Date(remindAt) > new Date(task.dueAt)) {
    throw ApiError.badRequest('Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc')
  }

  // BR-09: Max 5 active reminders per task
  const activeCount = await reminderRepo.countActiveByTask(taskId)
  if (activeCount >= 5) {
    throw ApiError.badRequest('Mỗi công việc chỉ được có tối đa 5 nhắc nhở đang hoạt động')
  }

  return reminderRepo.create(taskId, remindAt)
}

// ─── Update (chỉ SCHEDULED) ────────────────────────────

export async function update(userId, taskId, reminderId, remindAt) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')

  const reminder = await reminderRepo.findById(reminderId)
  if (!reminder) throw ApiError.notFound('Không tìm thấy nhắc nhở')
  if (reminder.taskId !== taskId) throw ApiError.badRequest('Nhắc nhở không thuộc công việc này')
  if (reminder.status !== 'SCHEDULED') {
    throw ApiError.badRequest('Chỉ có thể sửa nhắc nhở đang ở trạng thái Đã lên lịch')
  }

  // BR-10: remindAt <= dueAt
  if (new Date(remindAt) > new Date(task.dueAt)) {
    throw ApiError.badRequest('Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc')
  }

  return reminderRepo.update(reminderId, { remindAt: new Date(remindAt) })
}

// ─── Delete (chỉ chưa trigger) ─────────────────────────

export async function deleteReminder(userId, taskId, reminderId) {
  const task = await taskRepo.findById(taskId, userId)
  if (!task) throw ApiError.notFound('Không tìm thấy công việc')

  const reminder = await reminderRepo.findById(reminderId)
  if (!reminder) throw ApiError.notFound('Không tìm thấy nhắc nhở')
  if (reminder.taskId !== taskId) throw ApiError.badRequest('Nhắc nhở không thuộc công việc này')
  if (['TRIGGERED', 'SNOOZED', 'DISMISSED'].includes(reminder.status)) {
    throw ApiError.badRequest('Không thể xóa nhắc nhở đã được kích hoạt')
  }

  return reminderRepo.deleteReminder(reminderId)
}

// ─── Find Due Reminders ────────────────────────────────

export async function findDue(userId) {
  const now = new Date()
  const reminders = await reminderRepo.findDueReminders(now)
  // Filter by userId
  return reminders.filter((r) => r.task.userId === userId)
}

// ─── Snooze (max 3 times) ──────────────────────────────

export async function snooze(userId, reminderId, snoozeMinutes) {
  const reminder = await reminderRepo.findById(reminderId)
  if (!reminder) throw ApiError.notFound('Không tìm thấy nhắc nhở')
  if (reminder.task.userId !== userId) throw ApiError.forbidden()

  if (!['TRIGGERED', 'SNOOZED'].includes(reminder.status)) {
    throw ApiError.badRequest('Chỉ có thể hoãn nhắc nhở đang kêu')
  }

  // BR-13: Snooze max 3 times
  if (reminder.snoozeCount >= 3) {
    throw ApiError.badRequest('Nhắc nhở này đã được hoãn tối đa 3 lần')
  }

  const minutes = snoozeMinutes || DEFAULT_SNOOZE_MINUTES
  const newRemindAt = addMinutes(new Date(), minutes)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.reminder.update({
      where: { reminderId },
      data: {
        remindAt: newRemindAt,
        status: 'SCHEDULED',
        snoozeCount: { increment: 1 },
      },
    })

    await tx.notificationLog.create({
      data: { reminderId, action: 'SNOOZED' },
    })

    return updated
  })
}

// ─── Dismiss ────────────────────────────────────────────

export async function dismiss(userId, reminderId) {
  const reminder = await reminderRepo.findById(reminderId)
  if (!reminder) throw ApiError.notFound('Không tìm thấy nhắc nhở')
  if (reminder.task.userId !== userId) throw ApiError.forbidden()

  if (!['TRIGGERED', 'SNOOZED', 'SCHEDULED'].includes(reminder.status)) {
    throw ApiError.badRequest('Nhắc nhở đã được xử lý')
  }

  return prisma.$transaction(async (tx) => {
    await tx.reminder.update({
      where: { reminderId },
      data: { status: 'DISMISSED' },
    })

    await tx.notificationLog.create({
      data: { reminderId, action: 'DISMISSED' },
    })

    return { reminderId, status: 'DISMISSED' }
  })
}
