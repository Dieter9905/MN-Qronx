import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as taskService from '../services/taskService.js'

/**
 * GET /api/v1/tasks
 */
export const getTasks = catchAsync(async (req, res) => {
  const result = await taskService.findAll(req.user.id, req.query)
  success(res, 200, 'Thao tác thành công', result)
})

/**
 * POST /api/v1/tasks
 */
export const createTask = catchAsync(async (req, res) => {
  const result = await taskService.create(req.user.id, req.body)
  success(res, 201, 'Tạo công việc thành công', result)
})

/**
 * GET /api/v1/tasks/:taskId
 */
export const getTaskById = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const task = await taskService.findById(req.user.id, taskId)
  success(res, 200, 'Thao tác thành công', task)
})

/**
 * PUT /api/v1/tasks/:taskId
 */
export const updateTask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const task = await taskService.update(req.user.id, taskId, req.body)
  success(res, 200, 'Cập nhật công việc thành công', task)
})

/**
 * DELETE /api/v1/tasks/:taskId
 */
export const deleteTask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  await taskService.deleteTask(req.user.id, taskId)
  success(res, 200, 'Đã chuyển vào thùng rác — khôi phục được trong 30 ngày')
})

/**
 * GET /api/v1/tasks/trash
 */
export const getTrash = catchAsync(async (req, res) => {
  const data = await taskService.listTrash(req.user.id, req.query)
  success(res, 200, 'Thao tác thành công', data)
})

/**
 * POST /api/v1/tasks/:taskId/restore
 */
export const restoreTask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const task = await taskService.restoreTask(req.user.id, taskId)
  success(res, 200, 'Đã khôi phục công việc', task)
})

/**
 * DELETE /api/v1/tasks/trash
 */
export const emptyTrash = catchAsync(async (req, res) => {
  const data = await taskService.emptyTrash(req.user.id)
  success(res, 200, `Đã xoá vĩnh viễn ${data.removed} công việc`, data)
})

/**
 * POST /api/v1/tasks/:taskId/complete
 */
export const completeTask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const result = await taskService.complete(req.user.id, taskId)
  success(res, 200, 'Đã hoàn thành công việc', result)
})

/**
 * POST /api/v1/tasks/:taskId/reopen
 */
export const reopenTask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const task = await taskService.reopen(req.user.id, taskId)
  success(res, 200, 'Đã mở lại công việc', task)
})

/**
 * POST /api/v1/tasks/:taskId/cancel
 */
export const cancelTask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const result = await taskService.cancel(req.user.id, taskId)
  success(res, 200, 'Đã hủy công việc', result)
})
