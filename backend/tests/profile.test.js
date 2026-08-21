import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, cleanup } from './setup.js'

let token

beforeAll(async () => {
  await startServer()
  const email = `profile_${Date.now()}@example.com`
  await register(email, 'Test@1234', 'Profile User')
  const loginRes = await login(email, 'Test@1234')
  token = loginRes.data.data.accessToken
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('GET /me', () => {
  it('should return user profile', async () => {
    const res = await api('GET', '/me', { token })
    expect(res.status).toBe(200)
    expect(res.data.data.email).toBeDefined()
    expect(res.data.data.fullName).toBe('Profile User')
  })
})

describe('PUT /me', () => {
  it('should update fullName', async () => {
    const res = await api('PUT', '/me', {
      token,
      body: { fullName: 'Updated Name' },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.fullName).toBe('Updated Name')
  })
})

describe('PUT /me/password', () => {
  it('should change password', async () => {
    const res = await api('PUT', '/me/password', {
      token,
      body: { currentPassword: 'Test@1234', newPassword: 'NewPass@123' },
    })
    expect(res.status).toBe(200)
  })

  it('should reject wrong current password', async () => {
    const res = await api('PUT', '/me/password', {
      token,
      body: { currentPassword: 'WrongPass', newPassword: 'NewPass@456' },
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /me/stats', () => {
  it('should return stats', async () => {
    const res = await api('GET', '/me/stats', { token })
    expect(res.status).toBe(200)
    expect(res.data.data.todayCount).toBeDefined()
    expect(res.data.data.overdueCount).toBeDefined()
    expect(res.data.data.completedCount).toBeDefined()
  })
})
