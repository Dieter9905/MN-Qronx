import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, cleanup } from './setup.js'

let token
let categoryId

beforeAll(async () => {
  await startServer()
  const email = `task_${Date.now()}@example.com`
  await register(email, 'Test@1234', 'Task Test')
  const loginRes = await login(email, 'Test@1234')
  token = loginRes.data.data.accessToken

  const catRes = await api('POST', '/categories', {
    token,
    body: { categoryName: 'Test Category' },
  })
  categoryId = catRes.data.data.categoryId
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('POST /tasks', () => {
  it('should create a task', async () => {
    const dueAt = new Date(Date.now() + 86400000).toISOString()
    const res = await api('POST', '/tasks', {
      token,
      body: {
        title: 'Test Task',
        description: 'Test description',
        categoryId,
        priority: 'HIGH',
        dueAt,
      },
    })
    expect(res.status).toBe(201)
    expect(res.data.data.task.title).toBe('Test Task')
    expect(res.data.data.task.status).toBe('TODO')
  })

  it('should reject empty title', async () => {
    const dueAt = new Date(Date.now() + 86400000).toISOString()
    const res = await api('POST', '/tasks', {
      token,
      body: { title: '', dueAt },
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /tasks', () => {
  it('should list tasks with pagination', async () => {
    const res = await api('GET', '/tasks', { token, query: { page: '1', pageSize: '10' } })
    expect(res.status).toBe(200)
    expect(res.data.data.items).toBeInstanceOf(Array)
    expect(res.data.data.pagination).toBeDefined()
  })

  it('should filter by status', async () => {
    const res = await api('GET', '/tasks', { token, query: { status: 'TODO' } })
    expect(res.status).toBe(200)
    res.data.data.items.forEach(t => {
      expect(t.status).toBe('TODO')
    })
  })
})

describe('GET /tasks/:id', () => {
  it('should get task detail', async () => {
    const list = await api('GET', '/tasks', { token })
    const taskId = list.data.data.items[0].taskId
    const res = await api('GET', `/tasks/${taskId}`, { token })
    expect(res.status).toBe(200)
    expect(res.data.data.taskId).toBe(taskId)
  })
})

describe('POST /tasks/:id/complete', () => {
  it('should complete a task', async () => {
    const dueAt = new Date(Date.now() + 86400000).toISOString()
    const createRes = await api('POST', '/tasks', {
      token,
      body: { title: 'Task to Complete', dueAt, categoryId },
    })
    if (createRes.status !== 201) return
    const taskId = createRes.data.data.task.taskId

    const res = await api('POST', `/tasks/${taskId}/complete`, { token })
    expect(res.status).toBe(200)
    expect(res.data.data.completedTask.status).toBe('COMPLETED')
  })
})

describe('POST /tasks/:id/cancel', () => {
  it('should cancel a task', async () => {
    const dueAt = new Date(Date.now() + 86400000).toISOString()
    const createRes = await api('POST', '/tasks', {
      token,
      body: { title: 'Task to Cancel', dueAt, categoryId },
    })
    if (createRes.status !== 201) return
    const taskId = createRes.data.data.task.taskId

    const res = await api('POST', `/tasks/${taskId}/cancel`, { token })
    expect(res.status).toBe(200)
  })
})
