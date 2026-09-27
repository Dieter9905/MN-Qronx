import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as shareService from '../services/taskShareService.js'

/**
 * Controller giao việc cho người khác (gói Pro).
 *
 * Hai nhóm đường khác nhau vì hai vai khác nhau:
 *   • /tasks/:taskId/shares — CHỦ VIỆC: giao, xem danh sách, thu hồi.
 *   • /me/assigned          — NGƯỜI ĐƯỢC GIAO: chỉ xem và đánh dấu xong phần mình.
 * Không gộp lại được: người được giao không có quyền nào trên /tasks/:taskId.
 *
 * Không tự chuyển đổi dữ liệu ở đây — middleware transformResponse lo, giống mọi
 * controller khác, nên chỉ có MỘT chỗ định hình dữ liệu trả về.
 */

export const shareTask = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const result = await shareService.shareTask(req.user.id, taskId, req.body)
  success(res, 201, 'Đã giao việc. Người được nhờ sẽ nhận được thông báo.', result)
})

export const getShares = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const shares = await shareService.listShares(req.user.id, taskId)
  success(res, 200, 'Thao tác thành công', shares)
})

export const revokeShare = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const shareId = parseInt(req.params.shareId)
  const result = await shareService.revokeShare(req.user.id, taskId, shareId)
  success(res, 200, 'Đã thu hồi việc đã giao', result)
})

// ── Phía người được giao ────────────────────────────────────

export const getAssigned = catchAsync(async (req, res) => {
  const items = await shareService.listAssignedToMe(req.user.id)
  success(res, 200, 'Thao tác thành công', items)
})

export const setAssignedDone = catchAsync(async (req, res) => {
  const taskId = parseInt(req.params.taskId)
  const done = req.body?.done !== false
  const result = await shareService.setMyDone(req.user.id, taskId, done)
  success(res, 200, done ? 'Đã báo xong. Chủ việc được thông báo.' : 'Đã bỏ đánh dấu xong', result)
})
