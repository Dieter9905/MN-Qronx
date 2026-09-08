import prisma from '../config/prisma.js'

// ─── User Queries ──────────────────────────────────────────

/**
 * Find user by email (with role included).
 */
async function findByEmail(email) {
  return prisma.user.findFirst({
    where: { email },
    include: { role: true },
  })
}

/**
 * Find user by Google ID (with role included).
 */
async function findByGoogleId(googleId) {
  return prisma.user.findUnique({
    where: { googleId },
    include: { role: true },
  })
}

/**
 * Attach a Google ID to an existing user (link accounts).
 */
async function attachGoogleId(userId, googleId) {
  return prisma.user.update({
    where: { userId },
    data: { googleId },
  })
}

/**
 * Set avatar URL (Google avatar khi đăng nhập lần đầu).
 */
async function updateProfileAvatar(userId, avatarUrl) {
  return prisma.user.update({
    where: { userId },
    data: { avatarUrl },
  })
}

/**
 * Find user by ID (without passwordHash).
 */
async function findById(userId) {
  return prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      isActive: true,
      plan: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

/**
 * Find a user by invite code (for referral).
 */
async function findByInviteCode(inviteCode) {
  return prisma.user.findUnique({
    where: { inviteCode },
    select: { userId: true, fullName: true, email: true },
  })
}

/**
 * Create a new user with role USER.
 */
async function create({ fullName, email, passwordHash, inviteCode, referrerId }) {
  return prisma.user.create({
    data: {
      roleId: 1, // USER
      fullName,
      email,
      passwordHash,
      inviteCode,
      referrerId,
      notificationSetting: {
        create: {}, // Auto-create NotificationSetting (defaults)
      },
    },
    include: { role: true },
  })
}

/**
 * Find user by ID with passwordHash (for password verification).
 */
async function findByIdWithPassword(userId) {
  return prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      email: true,
      passwordHash: true,
    },
  })
}

/**
 * Update user password hash.
 */
async function updatePassword(userId, passwordHash) {
  return prisma.user.update({
    where: { userId },
    data: { passwordHash },
  })
}

// ─── RefreshToken Queries ──────────────────────────────────

/**
 * Save a refresh token for a user.
 */
async function saveRefreshToken(userId, token, expiresAt) {
  return prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  })
}

/**
 * Find a refresh token record.
 */
async function findRefreshToken(token) {
  return prisma.refreshToken.findUnique({
    where: { token },
  })
}

/**
 * Delete ALL refresh tokens for a user (logout / change password).
 */
async function deleteRefreshTokensByUserId(userId) {
  return prisma.refreshToken.deleteMany({
    where: { userId },
  })
}

/**
 * Delete a specific refresh token (logout single session).
 */
async function deleteRefreshToken(token) {
  return prisma.refreshToken.deleteMany({
    where: { token },
  })
}

// ─── Email Verification Queries ────────────────────────────

/**
 * Lưu (hoặc thay mới) mã xác minh email – 1 email chỉ có 1 mã hiệu lực.
 */
async function saveVerificationCode(email, code, expiresAt) {
  await prisma.emailVerificationCode.deleteMany({ where: { email } })
  return prisma.emailVerificationCode.create({
    data: { email, code, expiresAt },
  })
}

/**
 * Tìm mã xác minh mới nhất của email.
 */
async function findVerificationCode(email) {
  return prisma.emailVerificationCode.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Đánh dấu mã đã dùng (chỉ dùng 1 lần).
 */
async function markVerificationCodeUsed(emailVerificationId) {
  return prisma.emailVerificationCode.update({
    where: { emailVerificationId },
    data: { usedAt: new Date() },
  })
}

// ─── Password Reset Queries ────────────────────────────────

/**
 * Create a password reset request.
 */
async function createPasswordResetRequest(userId, resetToken, expiresAt) {
  return prisma.passwordResetRequest.create({
    data: { userId, resetToken, expiresAt },
  })
}

/**
 * Find a password reset request by token.
 */
async function findPasswordResetRequest(resetToken) {
  return prisma.passwordResetRequest.findUnique({
    where: { resetToken },
  })
}

/**
 * Mark a reset request as used.
 */
async function markResetRequestUsed(resetRequestId) {
  return prisma.passwordResetRequest.update({
    where: { resetRequestId },
    data: { usedAt: new Date() },
  })
}

export default {
  findByEmail,
  findByInviteCode,
  saveVerificationCode,
  findVerificationCode,
  markVerificationCodeUsed,
  findByGoogleId,
  attachGoogleId,
  updateProfileAvatar,
  findById,
  create,
  updatePassword,
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshTokensByUserId,
  deleteRefreshToken,
  findByIdWithPassword,
  createPasswordResetRequest,
  findPasswordResetRequest,
  markResetRequestUsed,
}
