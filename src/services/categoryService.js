import { db, getSession } from '../lib/db'
import { ok, fail, request, requireAuth } from './api'

function listForUser(userId, { isActive } = {}) {
  return db.categories
    .filter((c) => c.userId === userId)
    .filter((c) => (isActive === undefined ? true : c.isActive === isActive))
    .map((c) => ({ ...c, taskCount: db.tasks.filter((t) => t.categoryId === c.id).length }))
}

// GET /api/v1/categories
export function getCategories({ isActive } = {}) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    return ok('Thao tác thành công', listForUser(user.id, { isActive }))
  })
}

// POST /api/v1/categories
export function createCategory({ categoryName, colorCode }) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    if (!categoryName?.trim()) return fail('Tên danh mục không được để trống', { categoryName: 'Vui lòng nhập tên danh mục' })
    if (db.categories.some((c) => c.userId === user.id && c.name.toLowerCase() === categoryName.trim().toLowerCase())) {
      return fail('Danh mục này đã tồn tại', { categoryName: 'Tên danh mục đã tồn tại' })
    }
    const cat = {
      id: db.nextId(db.categories),
      userId: user.id,
      name: categoryName.trim(),
      color: colorCode || '#2563EB',
      isActive: true,
      createdAt: db.nowIso(),
    }
    db.saveCategories([...db.categories, cat])
    return ok('Tạo danh mục thành công', { ...cat, taskCount: 0 })
  }, { latency: 300 })
}

// PUT /api/v1/categories/{id}
export function updateCategory(id, { categoryName, colorCode }) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const cat = db.categories.find((c) => c.id === Number(id) && c.userId === user.id)
    if (!cat) return fail('Không tìm thấy danh mục')
    const dup = db.categories.some(
      (c) => c.id !== cat.id && c.userId === user.id && c.name.toLowerCase() === (categoryName || '').trim().toLowerCase()
    )
    if (dup) return fail('Danh mục này đã tồn tại', { categoryName: 'Tên danh mục đã tồn tại' })
    const updated = { ...cat, name: (categoryName || cat.name).trim(), color: colorCode || cat.color }
    db.saveCategories(db.categories.map((c) => (c.id === cat.id ? updated : c)))
    return ok('Cập nhật danh mục thành công', updated)
  }, { latency: 300 })
}

// PATCH /api/v1/categories/{id}/active
export function setCategoryActive(id, isActive) {
  return request(() => {
    const { user } = requireAuth(currentSession())
    const cat = db.categories.find((c) => c.id === Number(id) && c.userId === user.id)
    if (!cat) return fail('Không tìm thấy danh mục')
    const updated = { ...cat, isActive: Boolean(isActive) }
    db.saveCategories(db.categories.map((c) => (c.id === cat.id ? updated : c)))
    return ok(isActive ? 'Đã hiện danh mục' : 'Đã ẩn danh mục', updated)
  }, { latency: 250 })
}

function currentSession() {
  return getSession()
}
