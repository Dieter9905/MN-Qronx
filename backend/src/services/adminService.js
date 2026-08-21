import adminRepo from '../repositories/adminRepo.js'
import { parsePagination } from '../utils/pagination.js'
import ApiError from '../utils/ApiError.js'

// ─── Admin Dashboard ───────────────────────────────────

export async function getDashboard() {
  return adminRepo.getStats()
}

// ─── List Users ────────────────────────────────────────

export async function getUsers(query) {
  const { page, pageSize } = parsePagination(query.page, query.pageSize)

  const result = await adminRepo.findUsers({
    keyword: query.keyword,
    page,
    pageSize,
  })

  return {
    items: result.items,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    },
  }
}

// ─── Lock User ─────────────────────────────────────────

export async function lockUser(userId) {
  const user = await adminRepo.findUserById(userId)
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  if (user.role.roleName === 'ADMIN') {
    throw ApiError.badRequest('Không thể khóa tài khoản Admin')
  }
  if (!user.isActive) {
    throw ApiError.badRequest('Tài khoản đã bị khóa')
  }

  return adminRepo.setActive(userId, false)
}

// ─── Unlock User ───────────────────────────────────────

export async function unlockUser(userId) {
  const user = await adminRepo.findUserById(userId)
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  if (user.isActive) {
    throw ApiError.badRequest('Tài khoản chưa bị khóa')
  }

  return adminRepo.setActive(userId, true)
}
