import config from '../config/index.js'
import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as authService from '../services/authService.js'
import * as googleAuthService from '../services/googleAuthService.js'

/**
 * POST /api/v1/auth/send-verification-code
 */
export const sendVerificationCode = catchAsync(async (req, res) => {
  const result = await authService.sendVerificationCode(req.body.email)
  success(res, 200, result.message, result)
})

/**
 * POST /api/v1/auth/register
 */
export const register = catchAsync(async (req, res) => {
  const result = await authService.register({
    ...req.body,
    ipAddress: req.ip,
    deviceId: req.headers['x-device-id'] || null,
  })
  success(res, 201, 'Đăng ký thành công', result)
})

/**
 * POST /api/v1/auth/login
 */
export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body
  const result = await authService.login(email, password, {
    ipAddress: req.ip,
    deviceId: req.headers['x-device-id'] || null,
  })
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

// ─── Google OAuth ───────────────────────────────────────

const GOOGLE_STATE_COOKIE = 'google_oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000

/**
 * GET /api/v1/auth/google – chuyển hướng tới Google
 */
export const googleRedirect = catchAsync(async (req, res) => {
  if (!googleAuthService.isConfigured()) {
    return res.redirect(`${config.frontendUrl}/login?error=google_not_configured`)
  }
  const state = googleAuthService.generateState()
  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: STATE_TTL_MS,
  })
  res.redirect(googleAuthService.buildAuthUrl(state))
})

/**
 * GET /api/v1/auth/google/callback – Google trả về sau khi user chọn tài khoản
 */
export const googleCallback = catchAsync(async (req, res) => {
  const fail = (error) => res.redirect(`${config.frontendUrl}/login?error=${error || 'google'}`)

  try {
    const state = req.cookies?.[GOOGLE_STATE_COOKIE]
    if (!state || state !== req.query.state) {
      return fail('google_state')
    }
    res.clearCookie(GOOGLE_STATE_COOKIE)

    if (!req.query.code) {
      return fail('google')
    }

    const result = await googleAuthService.handleGoogleCallback(String(req.query.code))
    const redirect = new URL(`${config.frontendUrl}/oauth-callback`)
    redirect.searchParams.set('accessToken', result.accessToken)
    redirect.searchParams.set('refreshToken', result.refreshToken)
    res.redirect(redirect.toString())
  } catch (err) {
    fail('google')
  }
})
