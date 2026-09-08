import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import prisma from '../config/prisma.js'
import authRepo from '../repositories/authRepo.js'
import ApiError from '../utils/ApiError.js'
import { transformUser } from '../utils/transformers.js'
import { isPlanExpired, downgradeUser } from '../utils/planLimits.js'
import { ensureInviteCode, creditDailyLogin, activateInvitation } from './rewardService.js'

const REFRESH_TOKEN_EXPIRY_DAYS = 7
const RESET_TOKEN_EXPIRY_HOURS = 1

// ─── Register ──────────────────────────────────────────────

export async function register({ fullName, email, password, inviteCode, ipAddress, deviceId }) {
  // Check email unique
  const existing = await authRepo.findByEmail(email)
  if (existing) {
    throw ApiError.badRequest('Email đã được sử dụng')
  }

  // Mã giới thiệu (tùy chọn) → lưu referrer để thưởng khi bạn bè kích hoạt
  let referrerId = null
  const cleanCode = inviteCode ? String(inviteCode).trim().toUpperCase() : ''
  if (cleanCode) {
    const inviter = await authRepo.findByInviteCode(cleanCode)
    if (!inviter) {
      throw ApiError.badRequest('Mã giới thiệu không hợp lệ')
    }
    referrerId = inviter.userId
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // Create user + notificationSetting (kèm mã mời riêng của user)
  const user = await authRepo.create({
    fullName,
    email,
    passwordHash,
    inviteCode: generateNewInviteCode(),
    referrerId,
  })

  // Ghi nhận lời mời (PENDING – chỉ thưởng khi bạn bè đăng nhập lần đầu)
  if (referrerId) {
    await prisma.invitation.create({
      data: {
        inviterId: referrerId,
        inviteeId: user.userId,
        inviteCode: cleanCode,
        ipAddress: ipAddress || null,
        deviceId: deviceId || null,
      },
    })
  }

  return transformUser(user)
}

// Tạo mã mời 6 ký tự duy nhất cho user mới
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateNewInviteCode() {
  const bytes = crypto.randomBytes(6)
  let code = ''
  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return code
}

// ─── Login ─────────────────────────────────────────────────

export async function login(email, password, { ipAddress, deviceId } = {}) {
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

  // Gói trả phí đã quá hạn → hạ FREE ngay (trả về gói hiệu lực)
  if (isPlanExpired(user)) {
    await downgradeUser(user.userId)
    user.plan = 'FREE'
    user.planStartedAt = null
    user.planExpiresAt = null
  }

  // Phần thưởng: điểm đăng nhập hằng ngày + kích hoạt lời mời nếu có
  const daily = await creditDailyLogin(user)
  user.points = daily.points
  user.loginStreak = daily.loginStreak
  if (daily.lastLoginDate) user.lastLoginDate = daily.lastLoginDate
  if (!user.inviteCode) user.inviteCode = await ensureInviteCode(user.userId)
  await activateInvitation(user, ipAddress, deviceId)

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

// ─── Google Login ────────────────────────────────────────
// Đăng nhập/đăng ký bằng Google (xác thực qua OAuth callback)
// - Đã có googleId → đăng nhập
// - Chưa có googleId nhưng email trùng → liên kết tài khoản
// - Chưa có gì → tạo tài khoản mới với mật khẩu ngẫu nhiên (không thể đăng nhập bằng password)

export async function loginWithGoogle({ googleId, email, fullName, avatarUrl }) {
  if (!config.google.clientId || !config.google.clientSecret) {
    throw ApiError.badRequest('Đăng nhập Google chưa được cấu hình trên máy chủ')
  }

  let user = await authRepo.findByGoogleId(googleId)

  if (!user && email) {
    user = await authRepo.findByEmail(email)
    if (user) {
      await authRepo.attachGoogleId(user.userId, googleId)
      user = await authRepo.findByGoogleId(googleId)
    }
  }

  if (!user) {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10)
    user = await authRepo.create({
      fullName: fullName || (email ? email.split('@')[0] : 'Google User'),
      email,
      passwordHash,
    })
    await authRepo.attachGoogleId(user.userId, googleId)
    user = await authRepo.findByGoogleId(googleId)
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Tài khoản đã bị khóa')
  }

  // Gói trả phí đã quá hạn → hạ FREE ngay (trả về gói hiệu lực)
  if (isPlanExpired(user)) {
    await downgradeUser(user.userId)
    user.plan = 'FREE'
    user.planStartedAt = null
    user.planExpiresAt = null
  }

  // Phần thưởng: đăng nhập Google cũng được điểm hằng ngày
  const daily = await creditDailyLogin(user)
  user.points = daily.points
  user.loginStreak = daily.loginStreak
  if (daily.lastLoginDate) user.lastLoginDate = daily.lastLoginDate
  if (!user.inviteCode) user.inviteCode = await ensureInviteCode(user.userId)

  // Cập nhật avatar từ Google nếu tài khoản chưa có
  if (avatarUrl && !user.avatarUrl) {
    await authRepo.updateProfileAvatar?.(user.userId, avatarUrl)
  }

  const accessToken = jwt.sign(
    { id: user.userId, role: user.role.roleName },
    config.jwt.secret,
    { expiresIn: '1h' }
  )

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
