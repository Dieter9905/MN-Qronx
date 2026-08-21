import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as reminderService from '../services/reminderService.js'

export const getByTask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const reminders = await reminderService.findByTask(req.user.id, taskId)
  success(res, 200, 'Thao tác thành công', reminders)
})

export const getById = catchAsync(async (req, res) => {
  const reminderId = parseInt(req.params.reminderId)
  const reminder = await reminderService.findById(req.user.id, reminderId)
  success(res, 200, 'Thao tác thành công', reminder)
})

export const createReminder = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const reminder = await reminderService.create(req.user.id, taskId, req.body.remindAt)
  success(res, 201, 'Thêm nhắc nhở thành công', reminder)
})

export const updateReminder = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const reminderId = parseInt(req.params.reminderId)
  const reminder = await reminderService.update(req.user.id, taskId, reminderId, req.body.remindAt)
  success(res, 200, 'Cập nhật nhắc nhở thành công', reminder)
})

export const deleteReminder = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const reminderId = parseInt(req.params.reminderId)
  await reminderService.deleteReminder(req.user.id, taskId, reminderId)
  success(res, 200, 'Xóa nhắc nhở thành công')
})

export const getDue = catchAsync(async (req, res) => {
  const reminders = await reminderService.findDue(req.user.id)
  success(res, 200, 'Thao tác thành công', reminders)
})

export const snoozeReminder = catchAsync(async (req, res) => {
  const reminderId = parseInt(req.params.reminderId)
  const { snoozeMinutes } = req.body
  const result = await reminderService.snooze(req.user.id, reminderId, snoozeMinutes)
  success(res, 200, 'Đã hoãn nhắc nhở', result)
})

export const dismissReminder = catchAsync(async (req, res) => {
  const reminderId = parseInt(req.params.reminderId)
  const result = await reminderService.dismiss(req.user.id, reminderId)
  success(res, 200, 'Đã tắt nhắc nhở', result)
})
