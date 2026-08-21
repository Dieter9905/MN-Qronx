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
  // Admin token (user_id=1 from seed)
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
    expect(res.data.data.totalTasks).toBeDefined()
    expect(res.data.data.activeTasks).toBeDefined()
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
    expect(res.data.data.pagination).toBeDefined()
  })
})
