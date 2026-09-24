import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, makeToken, cleanup } from './setup.js'

let userToken
let adminToken

beforeAll(async () => {
  await startServer()
  const email = `dash_${Date.now()}@example.com`
  await register(email, 'Test@1234', 'Dashboard User')
  const loginRes = await login(email, 'Test@1234')
  userToken = loginRes.data.data.accessToken
  adminToken = makeToken(1, 'ADMIN')
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('GET /dashboard', () => {
  it('should return dashboard stats', async () => {
    const res = await api('GET', '/dashboard', { token: userToken })
    expect(res.status).toBe(200)
    expect(res.data.data.todayCount).toBeDefined()
    expect(res.data.data.overdueCount).toBeDefined()
    expect(res.data.data.completedCount).toBeDefined()
    expect(res.data.data.upcomingCount).toBeDefined()
    expect(res.data.data.todayTasks).toBeDefined()
    expect(res.data.data.overdueTasks).toBeDefined()
    expect(res.data.data.todayTasks).toBeInstanceOf(Array)
    expect(res.data.data.overdueTasks).toBeInstanceOf(Array)
  })

  it('should require auth', async () => {
    const res = await api('GET', '/dashboard')
    expect(res.status).toBe(401)
  })
})

describe('GET /admin/dashboard', () => {
  it('should return admin stats', async () => {
    const res = await api('GET', '/admin/dashboard', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.data.data.totalUsers).toBeDefined()
    expect(res.data.data.activeUsers).toBeDefined()
    expect(res.data.data.totalTasks).toBeDefined()
    expect(res.data.data.notificationsToday).toBeDefined()
    expect(res.data.data.tasksByStatus).toBeDefined()
  })

  it('should reject non-admin', async () => {
    const res = await api('GET', '/admin/dashboard', { token: userToken })
    expect(res.status).toBe(403)
  })
})

describe('GET /admin/users', () => {
  it('should list users', async () => {
    const res = await api('GET', '/admin/users', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.data.data.items).toBeInstanceOf(Array)
    // API trả phân trang trong `pagination` (frontend đọc qua normalize.paginate)
    expect(res.data.data.pagination.total).toBeDefined()
    expect(res.data.data.pagination.page).toBeDefined()
  })
})
