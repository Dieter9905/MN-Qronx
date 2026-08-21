import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, getAccessToken, cleanup } from './setup.js'

const TEST_EMAIL = `test_${Date.now()}@example.com`
const TEST_PASS = 'Test@1234'
const TEST_NAME = 'Test User'

let refreshToken

beforeAll(async () => {
  await startServer()
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('POST /auth/register', () => {
  it('should register a new user', async () => {
    const res = await register(TEST_EMAIL, TEST_PASS, TEST_NAME)
    expect(res.status).toBe(201)
    expect(res.data.success).toBe(true)
    expect(res.data.data.email).toBe(TEST_EMAIL)
  })

  it('should reject duplicate email', async () => {
    const res = await register(TEST_EMAIL, TEST_PASS, TEST_NAME)
    expect(res.status).toBe(400)
    expect(res.data.success).toBe(false)
  })

  it('should reject invalid email format', async () => {
    const res = await register('not-an-email', TEST_PASS, TEST_NAME)
    expect(res.status).toBe(400)
  })

  it('should reject short password', async () => {
    const res = await register(`short_${Date.now()}@x.com`, '123', TEST_NAME)
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  it('should login and return tokens', async () => {
    const res = await login(TEST_EMAIL, TEST_PASS)
    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.data.accessToken).toBeDefined()
    expect(res.data.data.refreshToken).toBeDefined()
    refreshToken = res.data.data.refreshToken
  })

  it('should reject wrong password', async () => {
    const res = await login(TEST_EMAIL, 'wrongpassword')
    expect(res.status).toBe(400)
    expect(res.data.success).toBe(false)
  })

  it('should reject non-existent email', async () => {
    const res = await login('nonexistent@x.com', TEST_PASS)
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/refresh-token', () => {
  it('should return new access token', async () => {
    if (!refreshToken) return // skip if login test failed
    const res = await getAccessToken(refreshToken)
    expect(res.status).toBe(200)
    expect(res.data.data.accessToken).toBeDefined()
  })

  it('should reject invalid refresh token', async () => {
    const res = await getAccessToken('invalid-token-123')
    expect(res.status).toBe(401)
  })
})

describe('POST /auth/logout', () => {
  it('should logout and invalidate refresh token', async () => {
    const loginRes = await login(TEST_EMAIL, TEST_PASS)
    if (loginRes.status !== 200) return
    const rt = loginRes.data.data.refreshToken

    const res = await api('POST', '/auth/logout', { token: loginRes.data.data.accessToken })
    expect(res.status).toBe(200)

    const refreshRes = await getAccessToken(rt)
    expect(refreshRes.status).toBe(401)
  })
})
