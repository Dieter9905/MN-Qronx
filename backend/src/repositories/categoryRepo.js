import prisma from '../config/prisma.js'

// ─── Find Queries ───────────────────────────────────────

/**
 * Find category by ID + userId (ownership check).
 */
async function findById(categoryId, userId) {
  return prisma.category.findFirst({
    where: { categoryId, userId },
  })
}

/**
 * Find all categories for a user, optional filter by isActive.
 */
async function findByUser(userId, isActive) {
  const where = { userId }
  if (isActive !== undefined) where.isActive = isActive

  return prisma.category.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { tasks: true } } },
  })
}

/**
 * Check if category name already exists for this user.
 */
async function findByName(userId, categoryName) {
  return prisma.category.findFirst({
    where: { userId, categoryName },
  })
}

// ─── Create / Update ────────────────────────────────────

/**
 * Create a new category.
 */
async function create(userId, { categoryName, colorCode }) {
  return prisma.category.create({
    data: { userId, categoryName, colorCode },
  })
}

/**
 * Update category name/color.
 */
async function update(categoryId, data) {
  return prisma.category.update({
    where: { categoryId },
    data,
  })
}

/**
 * Toggle isActive status.
 */
async function toggleActive(categoryId, isActive) {
  return prisma.category.update({
    where: { categoryId },
    data: { isActive },
  })
}

/**
 * Count tasks in a category.
 */
async function countTasks(categoryId) {
  return prisma.task.count({ where: { categoryId } })
}

/**
 * Count active categories of a user – dùng cho giới hạn gói.
 */
async function countActive(userId) {
  return prisma.category.count({ where: { userId, isActive: true } })
}

export default {
  findById,
  findByUser,
  findByName,
  create,
  update,
  toggleActive,
  countTasks,
  countActive,
}
