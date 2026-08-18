import { db, getSession } from '../lib/db'
import { ok, fail, request, requireAuth } from './api'

function currentSession() {
  return getSession()
}

function requireAdmin() {
  const { user } = requireAuth(currentSession())
  if (user.role !== 'ADMIN') {
    return fail('Bạn không có quyền truy cập khu vực quản trị')
  }
  return user
}

function publicUser(u) {
  const { password, ...rest } = u
  return rest
}

// GET /api/v1/admin/dashboard
export function getAdminDashboard() {
  return request(() => {
    const admin = requireAdmin()
    if (!admin) return fail('Bạn không có quyền truy cập khu vực quản trị')
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const users = db.users
    return ok('Thao tác thành công', {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      totalTasks: db.tasks.length,
      notificationsToday: db.notificationLogs.filter((l) => new Date(l.sentAt) >= todayStart).length,
      totalNotifications: db.notificationLogs.length,
      tasksByStatus: {
        TODO: db.tasks.filter((t) => t.status === 'TODO').length,
        IN_PROGRESS: db.tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        COMPLETED: db.tasks.filter((t) => t.status === 'COMPLETED').length,
        CANCELLED: db.tasks.filter((t) => t.status === 'CANCELLED').length,
      },
    })
  }, { latency: 350 })
}

// GET /api/v1/admin/users
export function getAdminUsers({ keyword, isActive, page = 1, pageSize = 10 } = {}) {
  return request(() => {
    const admin = requireAdmin()
    if (!admin) return fail('Bạn không có quyền truy cập khu vực quản trị')
    let list = db.users.filter((u) => u.role === 'USER')
    if (keyword) {
      const kw = keyword.toLowerCase()
      list = list.filter((u) => u.fullName.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw))
    }
    if (isActive !== undefined && isActive !== '') list = list.filter((u) => u.isActive === (isActive === 'true' || isActive === true))
    list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const total = list.length
    const start = (page - 1) * pageSize
    return ok('Thao tác thành công', {
      items: list.slice(start, start + pageSize).map((u) => ({
        ...publicUser(u),
        taskCount: db.tasks.filter((t) => t.userId === u.id).length,
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    })
  }, { latency: 300 })
}

// POST /api/v1/admin/users/{id}/lock | /unlock
export function setUserActive(userId, isActive) {
  return request(() => {
    const admin = requireAdmin()
    if (!admin) return fail('Bạn không có quyền truy cập khu vực quản trị')
    const user = db.users.find((u) => u.id === Number(userId))
    if (!user) return fail('Không tìm thấy người dùng')
    if (user.role === 'ADMIN') return fail('Không thể thay đổi trạng thái tài khoản quản trị')
    const updated = { ...user, isActive: Boolean(isActive) }
    db.saveUsers(db.users.map((u) => (u.id === user.id ? updated : u)))
    return ok(isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', publicUser(updated))
  }, { latency: 300 })
}
