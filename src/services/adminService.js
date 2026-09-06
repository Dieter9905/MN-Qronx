import api from './apiClient'
import { toUser, paginate } from './normalize'

// GET /api/v1/admin/dashboard
export async function getAdminDashboard() {
  return api('GET', '/admin/dashboard')
}

// GET /api/v1/admin/users
export async function getAdminUsers({ keyword, page = 1, pageSize = 10 } = {}) {
  const res = await api('GET', '/admin/users', {
    query: { keyword, page, pageSize },
  })
  if (res.success) {
    const p = paginate(res.data)
    res.data = {
      ...p,
      items: p.items.map((u) => ({
        ...toUser(u),
        taskCount: u._count?.tasks ?? u.taskCount ?? 0,
      })),
    }
  }
  return res
}

// POST /api/v1/admin/users – tạo tài khoản mới (Admin)
export async function createAdminUser({ fullName, email, password, phoneNumber, role = 'USER' } = {}) {
  const res = await api('POST', '/admin/users', {
    body: { fullName, email, password, phoneNumber, role },
  })
  if (res.success) {
    res.data = {
      ...toUser(res.data),
      taskCount: res.data?._count?.tasks ?? 0,
    }
  }
  return res
}

// POST /api/v1/admin/users/{id}/lock | /unlock
export async function setUserActive(userId, isActive) {
  const path = isActive ? 'unlock' : 'lock'
  const res = await api('POST', `/admin/users/${userId}/${path}`)
  if (res.success) res.data = toUser(res.data)
  return res
}
