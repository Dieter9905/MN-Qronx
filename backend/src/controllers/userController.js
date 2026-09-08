import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as userService from '../services/userService.js'

/**
 * GET /api/v1/me
 */
export const getProfile = catchAsync(async (req, res) => {
  const profile = await userService.getProfile(req.user.id, {
    ipAddress: req.ip,
    deviceId: req.headers['x-device-id'] || null,
  })
  success(res, 200, 'Lấy hồ sơ thành công', profile)
})

/**
 * PUT /api/v1/me
 */
export const updateProfile = catchAsync(async (req, res) => {
  const profile = await userService.updateProfile(req.user.id, req.body)
  success(res, 200, 'Cập nhật hồ sơ thành công', profile)
})

/**
 * PUT /api/v1/me/password
 */
export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  await userService.changePassword(req.user.id, currentPassword, newPassword)
  success(res, 200, 'Đổi mật khẩu thành công')
})

/**
 * GET /api/v1/me/stats
 */
export const getStats = catchAsync(async (req, res) => {
  const stats = await userService.getStats(req.user.id)
  success(res, 200, 'Thao tác thành công', stats)
})

/**
 * GET /api/v1/me/activity
 */
export const getRecentActivity = catchAsync(async (req, res) => {
  const activity = await userService.getRecentActivity(req.user.id)
  success(res, 200, 'Thao tác thành công', activity)
})
