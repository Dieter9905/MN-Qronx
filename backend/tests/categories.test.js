import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, cleanup } from './setup.js'

let token

beforeAll(async () => {
  await startServer()
  // Create test user
  const email = `cat_${Date.now()}@example.com`
  await register(email, 'Test@1234', 'Category Test')
  const loginRes = await login(email, 'Test@1234')
  token = loginRes.data.data.accessToken
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('GET /categories', () => {
  it('should return empty list initially', async () => {
    const res = await api('GET', '/categories', { token })
    expect(res.status).toBe(200)
    expect(res.data.data).toBeInstanceOf(Array)
  })

  it('should require auth', async () => {
    const res = await api('GET', '/categories')
    expect(res.status).toBe(401)
  })
})

describe('POST /categories', () => {
  it('should create a category', async () => {
    const res = await api('POST', '/categories', {
      token,
      body: { categoryName: 'Work', colorCode: '#FF0000' },
    })
    expect(res.status).toBe(201)
    expect(res.data.data.categoryName).toBe('Work')
  })

  it('should reject duplicate name', async () => {
    const res = await api('POST', '/categories', {
      token,
      body: { categoryName: 'Work', colorCode: '#00FF00' },
    })
    expect(res.status).toBe(400)
  })

  it('should reject empty name', async () => {
    const res = await api('POST', '/categories', {
      token,
      body: { categoryName: '', colorCode: '#0000FF' },
    })
    expect(res.status).toBe(400)
  })
})

describe('PUT /categories/:id', () => {
  it('should update category name', async () => {
    // Get categories first
    const list = await api('GET', '/categories', { token })
    const cat = list.data.data[0]

    const res = await api('PUT', `/categories/${cat.categoryId}`, {
      token,
      body: { categoryName: 'Office Work' },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.categoryName).toBe('Office Work')
  })
})

describe('PATCH /categories/:id/active', () => {
  it('should toggle isActive to false', async () => {
    const list = await api('GET', '/categories', { token })
    const cat = list.data.data[0]

    const res = await api('PATCH', `/categories/${cat.categoryId}/active`, {
      token,
      body: { isActive: false },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.isActive).toBe(false)
  })

  it('should filter inactive categories', async () => {
    const res = await api('GET', '/categories', { token, query: { isActive: 'true' } })
    expect(res.status).toBe(200)
    // Should not include inactive
    const inactive = res.data.data.find(c => c.isActive === false)
    expect(inactive).toBeUndefined()
  })
})
