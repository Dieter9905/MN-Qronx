import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { startServer, stopServer, api, register, login, cleanup, prisma } from './setup.js'
import * as pushService from '../src/services/pushService.js'
import config from '../src/config/index.js'

// Giả lập máy chủ push: luôn trả lời 410 (subscription không còn) để kiểm tra
// hệ thống tự dọn endpoint chết thay vì gửi mãi vào địa chỉ đã hết hạn.
vi.mock('web-push', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    default: {
      ...actual.default,
      setVapidDetails: () => {},
      sendNotification: vi.fn(async () => {
        const err = new Error('Subscription no longer valid')
        err.statusCode = 410
        throw err
      }),
    },
  }
})

async function newUser(prefix) {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'Push Test')
  const loginRes = await login(email, 'Test@1234')
  const token = loginRes.data.data.accessToken
  const row = await prisma.user.findUnique({ where: { email }, select: { userId: true } })
  return { email, token, userId: row.userId }
}

beforeAll(async () => {
  await startServer()
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('Web Push (PWA)', () => {
  it('trả khoá công khai VAPID cho người đã đăng nhập', async () => {
    const u = await newUser('pushkey')
    const res = await api('GET', '/devices/push/key', { token: u.token })

    expect(res.status).toBe(200)
    expect(typeof res.data.data.publicKey).toBe('string')
    expect(res.data.data.publicKey.length).toBeGreaterThan(20)
  })

  it('từ chối khi chưa đăng nhập', async () => {
    const res = await api('POST', '/devices/push', {
      body: { endpoint: 'https://push.example.com/x', keys: { p256dh: 'a', auth: 'b' } },
    })
    expect(res.status).toBe(401)
  })

  it('đăng ký, cập nhật khoá khi đăng ký lại, và huỷ được', async () => {
    const u = await newUser('pushsub')
    const endpoint = `https://push.example.com/${Date.now()}`

    const created = await api('POST', '/devices/push', {
      token: u.token,
      body: { endpoint, keys: { p256dh: 'PK', auth: 'AU' } },
    })
    expect(created.status).toBe(201)

    let row = await prisma.webPushSubscription.findUnique({ where: { endpoint } })
    expect(row).not.toBeNull()
    expect(row.userId).toBe(u.userId)

    // Đăng ký lại cùng endpoint với khoá mới → cập nhật, không tạo bản trùng
    const again = await api('POST', '/devices/push', {
      token: u.token,
      body: { endpoint, keys: { p256dh: 'PK2', auth: 'AU2' } },
    })
    expect(again.status).toBe(201)
    expect(await prisma.webPushSubscription.count({ where: { endpoint } })).toBe(1)
    row = await prisma.webPushSubscription.findUnique({ where: { endpoint } })
    expect(row.p256dh).toBe('PK2')

    // Không huỷ được subscription của người khác
    const other = await newUser('pushother')
    const steal = await api('POST', '/devices/push/unsubscribe', {
      token: other.token,
      body: { endpoint },
    })
    expect(steal.status).toBe(200)
    expect(steal.data.data.removed).toBe(false)
    expect(await prisma.webPushSubscription.findUnique({ where: { endpoint } })).not.toBeNull()

    // Huỷ đúng chủ thì mất
    const off = await api('POST', '/devices/push/unsubscribe', {
      token: u.token,
      body: { endpoint },
    })
    expect(off.data.data.removed).toBe(true)
    expect(await prisma.webPushSubscription.findUnique({ where: { endpoint } })).toBeNull()
  })

  it('chặn endpoint không phải https và thiếu khoá mã hoá', async () => {
    const u = await newUser('pushbad')

    const insecure = await api('POST', '/devices/push', {
      token: u.token,
      body: { endpoint: 'http://khong-https.example.com/x', keys: { p256dh: 'a', auth: 'b' } },
    })
    expect(insecure.status).toBe(400)

    const noKeys = await api('POST', '/devices/push', {
      token: u.token,
      body: { endpoint: 'https://push.example.com/y', keys: {} },
    })
    expect(noKeys.status).toBe(400)
  })

  it('giữ tối đa 6 subscription cho mỗi người (chống đăng ký rác)', async () => {
    const u = await newUser('pushlimit')
    for (let i = 0; i < 9; i += 1) {
      await pushService.subscribe(u.userId, {
        endpoint: `https://push.example.com/limit-${i}-${Date.now()}`,
        keys: { p256dh: 'p', auth: 'a' },
      })
    }
    const count = await prisma.webPushSubscription.count({ where: { userId: u.userId } })
    expect(count).toBe(6)
  })

  it('gửi cho người chưa đăng ký thì trả 0/0, không lỗi', async () => {
    const u = await newUser('pushempty')
    const result = await pushService.pushToUser(u.userId, { title: 'T', body: 'B' })
    expect(result).toEqual({ total: 0, ok: 0 })
  })

  it('endpoint chết (410) bị tự xoá để không gửi mãi vào địa chỉ hết hạn', async () => {
    const u = await newUser('pushdead')
    const endpoint = 'https://push.example.com/410-gone'
    await pushService.subscribe(u.userId, {
      endpoint,
      keys: { p256dh: 'p', auth: 'a' },
    })

    const result = await pushService.pushToUser(u.userId, { title: 'Nhắc việc', body: 'Đến giờ' })
    expect(result).toEqual({ total: 1, ok: 0 })
    expect(await prisma.webPushSubscription.findUnique({ where: { endpoint } })).toBeNull()
  })

  it('VAPID lấy từ env, thiếu thì tự sinh và lưu vào DB', async () => {
    if (config.vapid.publicKey && config.vapid.privateKey) {
      // Đã cấu hình biến môi trường → dùng đúng khoá đó
      expect(await pushService.getPublicKey()).toBe(config.vapid.publicKey)
      return
    }
    const row = await prisma.appSetting.findUnique({ where: { key: 'vapid' } })
    expect(row).not.toBeNull()
    const keys = JSON.parse(row.value)
    expect(keys.publicKey).toBeTruthy()
    expect(keys.privateKey).toBeTruthy()
  })
})
