import categoryRepo from '../repositories/categoryRepo.js'
import ApiError from '../utils/ApiError.js'

// ─── Get Categories ─────────────────────────────────────

export async function getCategories(userId, isActive) {
  return categoryRepo.findByUser(userId, isActive)
}

// ─── Create Category ────────────────────────────────────

export async function create(userId, { categoryName, colorCode }) {
  // Check unique name per user (ERD-R-03)
  const existing = await categoryRepo.findByName(userId, categoryName)
  if (existing) {
    throw ApiError.badRequest('Danh mục này đã tồn tại')
  }

  return categoryRepo.create(userId, { categoryName, colorCode })
}

// ─── Update Category ────────────────────────────────────

export async function update(userId, categoryId, { categoryName, colorCode }) {
  const category = await categoryRepo.findById(categoryId, userId)
  if (!category) {
    throw ApiError.notFound('Không tìm thấy danh mục')
  }

  // Check unique name if changing name
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

  // ERD-R-17: Không xóa cứng, chỉ toggle isActive
  return categoryRepo.toggleActive(categoryId, isActive)
}
