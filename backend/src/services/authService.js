import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import authRepo from '../repositories/authRepo.js'
import ApiError from '../utils/ApiError.js'
import { transformUser } from '../utils/transformers.js'

const REFRESH_TOKEN_EXPIRY_DAYS = 7
const RESET_TOKEN_EXPIRY_HOURS = 1

// ─── Register ──────────────────────────────────────────────

export async function register({ fullName, email, password }) {
  // Check email unique
  const existing = await authRepo.findByEmail(email)
  if (existing) {
    throw ApiError.badRequest('Email đã được sử dụng')
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // Create user + notificationSetting
  const user = await authRepo.create({ fullName, email, passwordHash })

  return transformUser(user)
}

// ─── Login ─────────────────────────────────────────────────

export async function login(email, password) {
  const user = await authRepo.findByEmail(email)

  if (!user) {
    throw ApiError.badRequest('Email hoặc mật khẩu không đúng')
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Tài khoản đã bị khóa')
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) {
    throw ApiError.badRequest('Email hoặc mật khẩu không đúng')
  }

  // Generate AccessToken (JWT, 1 giờ)
  const accessToken = jwt.sign(
    { id: user.userId, role: user.role.roleName },
    config.jwt.secret,
    { expiresIn: '1h' }
  )

  // Generate RefreshToken (random string, lưu DB)
  const refreshToken = crypto.randomBytes(40).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)

  await authRepo.saveRefreshToken(user.userId, refreshToken, expiresAt)

  return {
    accessToken,
    refreshToken,
    user: transformUser(user),
  }
}

// ─── Refresh Access Token ──────────────────────────────────

export async function refreshAccessToken(refreshToken) {
  const record = await authRepo.findRefreshToken(refreshToken)

  if (!record) {
    throw ApiError.unauthorized('RefreshToken không hợp lệ')
  }

  if (record.expiresAt < new Date()) {
    throw ApiError.unauthorized('RefreshToken đã hết hạn')
  }

  const user = await authRepo.findById(record.userId)
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Tài khoản không tồn tại hoặc đã bị khóa')
  }

  // Generate new AccessToken (1 giờ)
  const accessToken = jwt.sign(
    { id: user.userId, role: user.role.roleName },
    config.jwt.secret,
    { expiresIn: '1h' }
  )

  return { accessToken }
}

// ─── Logout ────────────────────────────────────────────────

export async function logout(userId) {
  // Xóa tất cả refresh token của user → phiên bị hủy
  await authRepo.deleteRefreshTokensByUserId(userId)
}

// ─── Change Password ───────────────────────────────────────

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await authRepo.findById(userId)
  if (!user) {
    throw ApiError.notFound()
  }

  const fullUser = await authRepo.findByIdWithPassword(userId)
  const isMatch = await bcrypt.compare(currentPassword, fullUser.passwordHash)
  if (!isMatch) {
    throw ApiError.badRequest('Mật khẩu hiện tại không đúng')
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await authRepo.updatePassword(userId, passwordHash)

  // Hủy tất cả refresh token → phiên cũ bị logout
  await authRepo.deleteRefreshTokensByUserId(userId)
}

// ─── Forgot Password ───────────────────────────────────────

export async function forgotPassword(email) {
  const user = await authRepo.findByEmail(email)

  // Không reveal user có tồn tại hay không
  if (!user) {
    return { message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi' }
  }

  // Tạo reset token
  const resetToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRY_HOURS)

  await authRepo.createPasswordResetRequest(user.userId, resetToken, expiresAt)

  // TODO: Gửi email qua nodemailer (giai đoạn sau)
  // Hiện tại chỉ log để test
  console.log(`[Auth] Reset token cho ${email}: ${resetToken}`)

  return {
    message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi',
    // Chỉ trả về ở dev,prod sẽ xóa
    ...(process.env.NODE_ENV !== 'production' && { resetToken }),
  }
}

// ─── Reset Password ────────────────────────────────────────

export async function resetPassword(resetToken, newPassword) {
  const record = await authRepo.findPasswordResetRequest(resetToken)

  if (!record) {
    throw ApiError.badRequest('Reset token không hợp lệ')
  }

  if (record.usedAt) {
    throw ApiError.badRequest('Reset token đã được sử dụng')
  }

  if (record.expiresAt < new Date()) {
    throw ApiError.badRequest('Reset token đã hết hạn')
  }

  // Hash password mới
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await authRepo.updatePassword(record.userId, passwordHash)

  // Đánh dấu đã dùng
  await authRepo.markResetRequestUsed(record.resetRequestId)

  // Hủy tất cả refresh token
  await authRepo.deleteRefreshTokensByUserId(record.userId)
}
