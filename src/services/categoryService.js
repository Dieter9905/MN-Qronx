import api from './apiClient'
import { toCategory } from './normalize'

// GET /api/v1/categories
export async function getCategories({ isActive } = {}) {
  const res = await api('GET', '/categories', {
    query: isActive !== undefined ? { isActive: String(isActive) } : {},
  })
  if (res.success) res.data = (res.data || []).map(toCategory)
  return res
}

// POST /api/v1/categories
export async function createCategory({ categoryName, colorCode } = {}) {
  const res = await api('POST', '/categories', { body: { categoryName, colorCode } })
  if (res.success) res.data = toCategory(res.data)
  return res
}

// PUT /api/v1/categories/{id}
export async function updateCategory(id, { categoryName, colorCode } = {}) {
  const res = await api('PUT', `/categories/${id}`, { body: { categoryName, colorCode } })
  if (res.success) res.data = toCategory(res.data)
  return res
}

// PATCH /api/v1/categories/{id}/active
export async function setCategoryActive(id, isActive) {
  const res = await api('PATCH', `/categories/${id}/active`, { body: { isActive: Boolean(isActive) } })
  if (res.success) res.data = toCategory(res.data)
  return res
}
