import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as authService from '../services/authService.js'

/**
 * POST /api/v1/auth/register
 */
export const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body)
  success(res, 201, 'Đăng ký thành công', result)
})

/**
 * POST /api/v1/auth/login
 */
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body
  const result = await authService.login(email, password)
  success(res, 200, 'Đăng nhập thành công', result)
})

/**
 * POST /api/v1/auth/refresh-token
 */
export const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body
  const result = await authService.refreshAccessToken(refreshToken)
  success(res, 200, 'Làm mới token thành công', result)
})

/**
 * POST /api/v1/auth/logout
 * Requires auth middleware — req.user.id available
 */
export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.user.id)
  success(res, 200, 'Đăng xuất thành công')
})

/**
 * PUT /api/v1/me/password
 * Requires auth middleware
 */
export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  await authService.changePassword(req.user.id, currentPassword, newPassword)
  success(res, 200, 'Đổi mật khẩu thành công')
})

/**
 * POST /api/v1/auth/forgot-password
 */
export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body
  const result = await authService.forgotPassword(email)
  success(res, 200, result.message, result)
})

/**
 * POST /api/v1/auth/reset-password
 */
export const resetPassword = catchAsync(async (req, res) => {
  const { resetToken, newPassword } = req.body
  await authService.resetPassword(resetToken, newPassword)
  success(res, 200, 'Đặt lại mật khẩu thành công')
})
