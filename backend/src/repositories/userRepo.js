import prisma from '../config/prisma.js'

// ─── Profile Queries ─────────────────────────────────────

/**
 * Find user profile by ID (without passwordHash).
 */
async function findProfile(userId) {
  return prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      avatarUrl: true,
      plan: true,
      planStartedAt: true,
      planExpiresAt: true,
      role: { select: { roleName: true } },
      createdAt: true,
      updatedAt: true,
    },
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
 * Update profile fields (fullName, phoneNumber, avatarUrl).
 */
async function updateProfile(userId, data) {
  return prisma.user.update({
    where: { userId },
    data,
    select: {
      userId: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      avatarUrl: true,
      updatedAt: true,
    },
  })
}

/**
 * Update password hash.
 */
async function updatePassword(userId, passwordHash) {
  return prisma.user.update({
    where: { userId },
    data: { passwordHash },
  })
}

// ─── Stats Queries ──────────────────────────────────────

/**
 * Count tasks by user and optional status filter.
 */
async function countTasks(userId, where = {}) {
  return prisma.task.count({ where: { userId, ...where } })
}

/**
 * Count active categories.
 */
async function countCategories(userId) {
  return prisma.category.count({ where: { userId, isActive: true } })
}

/**
 * Count active devices.
 */
async function countDevices(userId) {
  return prisma.device.count({ where: { userId, isActive: true } })
}

// ─── Activity Queries ───────────────────────────────────

/**
 * Get recent notification logs for a user (last N).
 */
async function findRecentLogs(userId, limit = 5) {
  return prisma.notificationLog.findMany({
    where: {
      reminder: { task: { userId } },
    },
    take: limit,
    orderBy: { sentAt: 'desc' },
    select: {
      notificationLogId: true,
      action: true,
      sentAt: true,
      reminder: {
        select: {
          remindAt: true,
          task: { select: { taskId: true, title: true } },
        },
      },
    },
  })
}

export default {
  findProfile,
  findByIdWithPassword,
  updateProfile,
  updatePassword,
  countTasks,
  countCategories,
  countDevices,
  findRecentLogs,
}
