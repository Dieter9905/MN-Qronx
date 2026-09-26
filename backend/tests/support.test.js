import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  startServer,
  stopServer,
  api,
  register,
  login,
  cleanup,
  makeToken,
  rawGet,
} from './setup.js'

/**
 * CSKH trong app: người dùng mở hội thoại, admin trả lời, hai bên thấy số chưa
 * đọc của mình. Test chạy qua HTTP thật (giống tasks.test.js) nên đường
 * route → validation → service → DB đều được kiểm tra, không mock.
 */

let token
let userId
let adminToken
let otherToken
let conversationId
let firstMessageId
let attachmentId

// 1x1 pixel JPEG hợp lệ ở mức header (đủ để kiểm tra luồng lưu/nhận ảnh)
const JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x03,
  0x03, 0x03, 0x03, 0x03, 0xff, 0xd9,
]).toString('base64')

beforeAll(async () => {
  await startServer()

  const email = `support_${Date.now()}@example.com`
  await register(email, 'Test@1234', 'Support Test')
  const loginRes = await login(email, 'Test@1234')
  token = loginRes.data.data.accessToken
  userId = loginRes.data.data.user.id
  adminToken = makeToken(userId, 'ADMIN')

  // Tài khoản thứ hai để kiểm tra chặn xem ảnh của người khác
  const otherEmail = `support_other_${Date.now()}@example.com`
  await register(otherEmail, 'Test@1234', 'Support Other')
  const otherLogin = await login(otherEmail, 'Test@1234')
  otherToken = otherLogin.data.data.accessToken
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('Hội thoại hỗ trợ phía người dùng', () => {
  it('tạo hội thoại trống khi chưa từng liên hệ', async () => {
    const res = await api('GET', '/support/conversation', { token })
    expect(res.status).toBe(200)
    expect(res.data.data.messages).toEqual([])
    expect(res.data.data.unread).toBe(0)
    conversationId = res.data.data.id
    expect(typeof conversationId).toBe('number')
  })

  it('gửi tin nhắn và nhận lại đúng nội dung', async () => {
    const res = await api('POST', '/support/messages', {
      token,
      body: { body: 'Mình không nhận được email xác nhận đăng ký' },
    })
    expect(res.status).toBe(201)
    expect(res.data.data.senderRole).toBe('USER')
    expect(res.data.data.mine).toBe(true)
    expect(res.data.data.body).toContain('email xác nhận')
    firstMessageId = res.data.data.id
  })

  it('gửi kèm ảnh và tải lại ảnh bằng quyền chủ hội thoại', async () => {
    const sent = await api('POST', '/support/messages', {
      token,
      body: {
        body: 'Ảnh lỗi đây ạ',
        attachments: [{ mimeType: 'image/jpeg', dataBase64: JPEG_BASE64 }],
      },
    })
    expect(sent.status).toBe(201)
    expect(sent.data.data.attachments).toHaveLength(1)
    attachmentId = sent.data.data.attachments[0].id

    const img = await rawGet(`/support/attachments/${attachmentId}`, token)
    expect(img.status).toBe(200)
    expect(img.contentType).toContain('image/jpeg')
    expect(img.buffer.length).toBeGreaterThan(0)
  })

  it('không cho người khác xem ảnh trong hội thoại', async () => {
    const img = await rawGet(`/support/attachments/${attachmentId}`, otherToken)
    expect(img.status).toBe(403)
  })

  it('chặn nội dung rỗng, nội dung quá dài và ảnh không phải hình', async () => {
    const empty = await api('POST', '/support/messages', { token, body: { body: '   ' } })
    expect(empty.status).toBe(400)

    const tooLong = await api('POST', '/support/messages', {
      token,
      body: { body: 'x'.repeat(4001) },
    })
    expect(tooLong.status).toBe(400)

    const tooMany = await api('POST', '/support/messages', {
      token,
      body: {
        body: 'nhiều ảnh',
        attachments: Array.from({ length: 4 }, () => ({
          mimeType: 'image/jpeg',
          dataBase64: JPEG_BASE64,
        })),
      },
    })
    expect(tooMany.status).toBe(400)

    const wrongType = await api('POST', '/support/messages', {
      token,
      body: {
        body: 'tệp lạ',
        attachments: [{ mimeType: 'application/pdf', dataBase64: JPEG_BASE64 }],
      },
    })
    expect(wrongType.status).toBe(400)
  })

  it('chỉ lấy tin mới hơn mốc `since`', async () => {
    const res = await api('GET', '/support/messages', { token, query: { since: firstMessageId } })
    expect(res.status).toBe(200)
    // 1 tin kèm ảnh là tin duy nhất mới hơn tin đầu
    expect(res.data.data.messages).toHaveLength(1)
    expect(res.data.data.messages[0].attachments).toHaveLength(1)
  })
})

describe('Phía admin trả lời', () => {
  it('người dùng thường không vào được khu vực hỗ trợ của admin', async () => {
    const res = await api('GET', '/admin/support/conversations', { token })
    expect(res.status).toBe(403)
  })

  it('admin thấy hội thoại kèm số tin chưa trả lời', async () => {
    const res = await api('GET', '/admin/support/conversations', { token: adminToken })
    expect(res.status).toBe(200)

    const mine = res.data.data.items.find((c) => c.id === conversationId)
    expect(mine).toBeTruthy()
    expect(mine.unread).toBeGreaterThan(0)
    expect(mine.customer.email).toContain('support_')

    const unread = await api('GET', '/admin/support/unread', { token: adminToken })
    expect(unread.data.data.unread).toBeGreaterThan(0)
  })

  it('admin trả lời và người dùng nhận được tin', async () => {
    const reply = await api('POST', `/admin/support/conversations/${conversationId}/messages`, {
      token: adminToken,
      body: { body: 'Mình đã gửi lại email, bạn kiểm tra hộp thư nhé' },
    })
    expect(reply.status).toBe(201)
    expect(reply.data.data.senderRole).toBe('ADMIN')
    expect(reply.data.data.mine).toBe(true)

    const asUser = await api('GET', '/support/conversation', { token })
    const incoming = asUser.data.data.messages.filter((m) => m.senderRole === 'ADMIN')
    expect(incoming).toHaveLength(1)
    expect(incoming[0].mine).toBe(false)
    expect(asUser.data.data.unread).toBeGreaterThan(0)
  })

  it('người dùng đọc thì số chưa đọc của mình về 0, của admin vẫn còn', async () => {
    await api('POST', '/support/read', { token })
    const mine = await api('GET', '/support/unread', { token })
    expect(mine.data.data.unread).toBe(0)

    const adminUnread = await api('GET', '/admin/support/unread', { token: adminToken })
    expect(adminUnread.data.data.unread).toBeGreaterThan(0)
  })

  it('admin đánh dấu đã đọc và đổi trạng thái sang Đã xong', async () => {
    const read = await api('POST', `/admin/support/conversations/${conversationId}/read`, {
      token: adminToken,
    })
    expect(read.status).toBe(200)

    const unread = await api('GET', '/admin/support/unread', { token: adminToken })
    expect(unread.data.data.unread).toBe(0)

    const resolved = await api('PUT', `/admin/support/conversations/${conversationId}/status`, {
      token: adminToken,
      body: { status: 'RESOLVED' },
    })
    expect(resolved.status).toBe(200)
    expect(resolved.data.data.status).toBe('RESOLVED')

    const bad = await api('PUT', `/admin/support/conversations/${conversationId}/status`, {
      token: adminToken,
      body: { status: 'KHONG_TON_TAI' },
    })
    expect(bad.status).toBe(400)
  })

  it('người dùng nhắn tiếp thì hội thoại tự mở lại', async () => {
    await api('POST', '/support/messages', { token, body: { body: 'Cảm ơn bạn, đã nhận được' } })
    const res = await api('GET', '/support/conversation', { token })
    expect(res.data.data.status).toBe('OPEN')
  })
})
