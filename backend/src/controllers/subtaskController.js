import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as subtaskService from '../services/subtaskService.js'

export const getSubtasks = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const subtasks = await subtaskService.findAll(req.user.id, taskId)
  success(res, 200, 'Thao tác thành công', subtasks)
})

export const createSubtask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const subtask = await subtaskService.create(req.user.id, taskId, req.body.content)
  success(res, 201, 'Thêm việc con thành công', subtask)
})

export const updateSubtask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const subtaskId = parseInt(req.params.subtaskId)
  const subtask = await subtaskService.update(req.user.id, taskId, subtaskId, req.body.content)
  success(res, 200, 'Cập nhật việc con thành công', subtask)
})

export const toggleSubtask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const subtaskId = parseInt(req.params.subtaskId)
  const subtask = await subtaskService.toggleComplete(req.user.id, taskId, subtaskId)
  success(res, 200, 'Cập nhật trạng thái thành công', subtask)
})

export const deleteSubtask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const subtaskId = parseInt(req.params.subtaskId)
  await subtaskService.deleteSubtask(req.user.id, taskId, subtaskId)
  success(res, 200, 'Xóa việc con thành công')
})
