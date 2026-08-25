import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, cleanup } from './setup.js'

let token

beforeAll(async () => {
  await startServer()
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
    // Transformed: { id, name, color, isActive }
    expect(res.data.data.name).toBe('Work')
    expect(res.data.data.color).toBe('#FF0000')
    expect(res.data.data.id).toBeDefined()
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
    const list = await api('GET', '/categories', { token })
    const cat = list.data.data[0]

    const res = await api('PUT', `/categories/${cat.id}`, {
      token,
      body: { categoryName: 'Office Work' },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.name).toBe('Office Work')
  })
})

describe('PATCH /categories/:id/active', () => {
  it('should toggle isActive to false', async () => {
    const list = await api('GET', '/categories', { token })
    const cat = list.data.data[0]

    const res = await api('PATCH', `/categories/${cat.id}/active`, {
      token,
      body: { isActive: false },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.isActive).toBe(false)
  })

  it('should filter inactive categories', async () => {
    const res = await api('GET', '/categories', { token, query: { isActive: 'true' } })
    expect(res.status).toBe(200)
    const inactive = res.data.data.find(c => c.isActive === false)
    expect(inactive).toBeUndefined()
  })
})
