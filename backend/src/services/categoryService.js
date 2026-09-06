import categoryRepo from '../repositories/categoryRepo.js'
import ApiError from '../utils/ApiError.js'
import { getUserPlan, planLimit, planLimitError } from '../utils/planLimits.js'

// ─── Get Categories ─────────────────────────────────────

export async function getCategories(userId, isActive) {
  return categoryRepo.findByUser(userId, isActive)
}

// ─── Create Category ────────────────────────────────────

export async function create(userId, { categoryName, colorCode }) {
  const existing = await categoryRepo.findByName(userId, categoryName)
  if (existing) {
    throw ApiError.badRequest('Danh mục này đã tồn tại')
  }

  // Giới hạn số danh mục theo gói
  const plan = await getUserPlan(userId)
  const maxCategories = planLimit(plan, 'categories')
  if (maxCategories !== Infinity) {
    const count = await categoryRepo.countActive(userId)
    if (count >= maxCategories) {
      throw planLimitError({ feature: 'danh mục', limit: maxCategories, plan })
    }
  }

  return categoryRepo.create(userId, { categoryName, colorCode })
}

// ─── Update Category ────────────────────────────────────

export async function update(userId, categoryId, { categoryName, colorCode }) {
  const category = await categoryRepo.findById(categoryId, userId)
  if (!category) {
    throw ApiError.notFound('Không tìm thấy danh mục')
  }

  if (categoryName && categoryName !== category.categoryName) {
    const duplicate = await categoryRepo.findByName(userId, categoryName)
    if (duplicate) {
      throw ApiError.badRequest('Danh mục này đã tồn tại')
    }
  }

  const data = {}
  if (categoryName !== undefined) data.categoryName = categoryName
  if (colorCode !== undefined) data.colorCode = colorCode

  return categoryRepo.update(categoryId, data)
}

// ─── Toggle Active ──────────────────────────────────────

export async function toggleActive(userId, categoryId, isActive) {
  const category = await categoryRepo.findById(categoryId, userId)
  if (!category) {
    throw ApiError.notFound('Không tìm thấy danh mục')
  }

  return categoryRepo.toggleActive(categoryId, isActive)
}
