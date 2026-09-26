import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, cleanup, prisma } from './setup.js'

/**
 * Hồi quy cho loạt lỗi tìm được khi kiểm thử lại toàn bộ chức năng (26/09/2026):
 *  - việc con trả về bị middleware đổi hình thành công việc (id = taskId, mất content)
 *  - GET /tasks/:id/subtasks luôn 400 vì đòi cả subtaskId
 *  - 4 route nhắc nhở của công việc (GET/POST/PUT/DELETE) bị thiếu hẳn → 404
 *  - GET /tasks không kiểm tra tham số lọc → 500 khi status sai
 *  - PUT /devices/settings gửi khoá lạ làm Prisma ném lỗi → 500
 *  - hồ sơ nhận số điện thoại không phải số
 *  - AI chưa deploy trả 500 "Lỗi hệ thống" thay vì 502/503 kèm lý do
 */

let token
let email
let taskId

const iso = (minutes) => new Date(Date.now() + minutes * 60000).toISOString()

beforeAll(async () => {
  await startServer()
  email = `nested_${Date.now()}@example.com`
  await register(email, 'Test@1234', 'Nested Test')
  const loginRes = await login(email, 'Test@1234')
  token = loginRes.data.data.accessToken

  const taskRes = await api('POST', '/tasks', {
    token,
    body: { title: 'Việc cha', dueAt: iso(240), priority: 'MEDIUM' },
  })
  taskId = taskRes.data.data.id
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('Việc con (subtask)', () => {
  let subtaskId

  it('tạo việc con trả về đúng việc con, không phải công việc cha', async () => {
    const res = await api('POST', `/tasks/${taskId}/subtasks`, {
      token,
      body: { content: 'Việc con A' },
    })
    expect(res.status).toBe(201)
    expect(res.data.data.content).toBe('Việc con A')
    expect(res.data.data.id).not.toBe(taskId)
    expect(res.data.data.taskId).toBe(taskId)
    subtaskId = res.data.data.id
  })

  it('liệt kê được việc con', async () => {
    const res = await api('GET', `/tasks/${taskId}/subtasks`, { token })
    expect(res.status).toBe(200)
    expect(res.data.data).toHaveLength(1)
    expect(res.data.data[0].id).toBe(subtaskId)
    expect(res.data.data[0].content).toBe('Việc con A')
  })

  it('tích hoàn thành việc con vừa tạo', async () => {
    const res = await api('POST', `/tasks/${taskId}/subtasks/${subtaskId}/toggle`, { token })
    expect(res.status).toBe(200)
    expect(res.data.data.isCompleted).toBe(true)
  })

  it('sửa nội dung việc con', async () => {
    const res = await api('PUT', `/tasks/${taskId}/subtasks/${subtaskId}`, {
      token,
      body: { content: 'Việc con A (đã sửa)' },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.content).toBe('Việc con A (đã sửa)')
  })

  it('xoá việc con', async () => {
    const res = await api('DELETE', `/tasks/${taskId}/subtasks/${subtaskId}`, { token })
    expect(res.status).toBe(200)
    const list = await api('GET', `/tasks/${taskId}/subtasks`, { token })
    expect(list.data.data).toHaveLength(0)
  })
})

describe('Nhắc nhở của công việc', () => {
  let reminderId

  it('thêm nhắc nhở', async () => {
    const res = await api('POST', `/tasks/${taskId}/reminders`, {
      token,
      body: { remindAt: iso(180) },
    })
    expect(res.status).toBe(201)
    expect(res.data.data.id).toBeDefined()
    expect(res.data.data.status).toBe('SCHEDULED')
    reminderId = res.data.data.id
  })

  it('liệt kê nhắc nhở của công việc', async () => {
    const res = await api('GET', `/tasks/${taskId}/reminders`, { token })
    expect(res.status).toBe(200)
    expect(res.data.data.map((r) => r.id)).toContain(reminderId)
  })

  it('từ chối nhắc nhở sau thời hạn', async () => {
    const res = await api('POST', `/tasks/${taskId}/reminders`, {
      token,
      body: { remindAt: iso(600) },
    })
    expect(res.status).toBe(400)
  })

  it('từ chối nhắc nhở trong quá khứ', async () => {
    const res = await api('POST', `/tasks/${taskId}/reminders`, {
      token,
      body: { remindAt: iso(-30) },
    })
    expect(res.status).toBe(400)
  })

  it('sửa thời điểm nhắc nhở', async () => {
    const res = await api('PUT', `/tasks/${taskId}/reminders/${reminderId}`, {
      token,
      body: { remindAt: iso(150) },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.id).toBe(reminderId)
  })

  it('xoá nhắc nhở', async () => {
    const res = await api('DELETE', `/tasks/${taskId}/reminders/${reminderId}`, { token })
    expect(res.status).toBe(200)
    const list = await api('GET', `/tasks/${taskId}/reminders`, { token })
    expect(list.data.data).toHaveLength(0)
  })
})

describe('Báo thức: tới giờ → hoãn → tắt', () => {
  let alarmTaskId
  let alarmReminderId

  it('chuẩn bị nhắc nhở sắp tới giờ', async () => {
    const taskRes = await api('POST', '/tasks', {
      token,
      body: { title: 'Việc báo thức', dueAt: iso(120), priority: 'URGENT' },
    })
    alarmTaskId = taskRes.data.data.id
    const remRes = await api('POST', `/tasks/${alarmTaskId}/reminders`, {
      token,
      body: { remindAt: iso(1) },
    })
    expect(remRes.status).toBe(201)
    alarmReminderId = remRes.data.data.id
  })

  it('chưa tới giờ thì không có trong danh sách cần kêu', async () => {
    const res = await api('GET', '/reminders/due', { token })
    expect(res.data.data.some((r) => r.id === alarmReminderId)).toBe(false)
  })

  it('đã tới giờ là nhắc nhở xuất hiện trong danh sách cần kêu', async () => {
    // remindAt phải ở tương lai lúc tạo (BR), nên đẩy mốc về quá khứ trực tiếp
    // trong DB thay vì ngồi chờ một phút.
    await prisma.reminder.update({
      where: { reminderId: alarmReminderId },
      data: { remindAt: new Date(Date.now() - 1000) },
    })
    const res = await api('GET', '/reminders/due', { token })
    expect(res.data.data.some((r) => r.id === alarmReminderId)).toBe(true)
  })

  it('hoãn nhắc nhở đang kêu và ghi lịch sử thông báo', async () => {
    // Cron của server thật mới đổi SCHEDULED → TRIGGERED; test chạy app.js
    // không cron nên đặt trạng thái trực tiếp.
    await prisma.reminder.update({ where: { reminderId: alarmReminderId }, data: { status: 'TRIGGERED' } })
    const res = await api('POST', `/reminders/${alarmReminderId}/snooze`, {
      token,
      body: { snoozeMinutes: 10 },
    })
    expect(res.status).toBe(200)
    expect(res.data.data.status).toBe('SCHEDULED')
    expect(res.data.data.snoozeCount).toBe(1)
    const logs = await prisma.notificationLog.count({ where: { reminderId: alarmReminderId } })
    expect(logs).toBe(1)
  })

  it('hoãn quá 3 lần thì bị chặn', async () => {
    await prisma.reminder.update({
      where: { reminderId: alarmReminderId },
      data: { status: 'TRIGGERED', snoozeCount: 3 },
    })
    const res = await api('POST', `/reminders/${alarmReminderId}/snooze`, { token, body: { snoozeMinutes: 10 } })
    expect(res.status).toBe(400)
  })

  it('hoãn nhắc nhở của người khác → 403/404', async () => {
    const other = `other_${Date.now()}@example.com`
    await register(other, 'Test@1234', 'Other')
    const otherLogin = await login(other, 'Test@1234')
    const otherToken = otherLogin.data.data.accessToken
    const res = await api('POST', `/reminders/${alarmReminderId}/snooze`, {
      token: otherToken,
      body: { snoozeMinutes: 10 },
    })
    expect([403, 404]).toContain(res.status)
  })

  it('tắt nhắc nhở và ghi lịch sử', async () => {
    await prisma.reminder.update({ where: { reminderId: alarmReminderId }, data: { status: 'TRIGGERED' } })
    const res = await api('POST', `/reminders/${alarmReminderId}/dismiss`, { token })
    expect(res.status).toBe(200)
    expect(res.data.data.status).toBe('DISMISSED')
    const logs = await prisma.notificationLog.count({ where: { reminderId: alarmReminderId, action: 'DISMISSED' } })
    expect(logs).toBe(1)
  })
})

describe('Bộ lọc danh sách công việc', () => {
  it('trạng thái sai → 400 (trước đây 500)', async () => {
    const res = await api('GET', '/tasks', { token, query: { status: 'OVERDUE' } })
    expect(res.status).toBe(400)
  })

  it('sort sai → 400', async () => {
    const res = await api('GET', '/tasks', { token, query: { sort: 'linh-tinh' } })
    expect(res.status).toBe(400)
  })

  it('chuỗi rỗng được coi như không lọc', async () => {
    const res = await api('GET', '/tasks', { token, query: { status: '', sort: '' } })
    expect(res.status).toBe(200)
  })

  it('lọc hợp lệ vẫn chạy', async () => {
    const res = await api('GET', '/tasks', { token, query: { status: 'TODO', sort: 'dueAsc' } })
    expect(res.status).toBe(200)
  })
})

describe('Cài đặt thông báo', () => {
  it('khoá lạ bị bỏ qua thay vì làm sập máy chủ', async () => {
    const res = await api('PUT', '/devices/settings', {
      token,
      body: { isEnabled: true, enableSound: true, khongCoTruongNay: 1 },
    })
    expect(res.status).toBe(200)
  })

  it('lưu đúng trường hợp lệ', async () => {
    const res = await api('PUT', '/devices/settings', {
      token,
      body: { defaultSnoozeMinutes: 15, vibrationEnabled: false },
    })
    expect(res.status).toBe(200)
    const detail = await api('GET', '/devices/settings', { token })
    expect(detail.data.data.defaultSnoozeMinutes).toBe(15)
    expect(detail.data.data.vibrationEnabled).toBe(false)
  })

  it('hoãn mặc định ngoài 1-60 phút → 400', async () => {
    const res = await api('PUT', '/devices/settings', {
      token,
      body: { defaultSnoozeMinutes: 999 },
    })
    expect(res.status).toBe(400)
  })
})

describe('Hồ sơ', () => {
  it('số điện thoại không phải số → 400', async () => {
    const res = await api('PUT', '/me', { token, body: { phoneNumber: 'abc' } })
    expect(res.status).toBe(400)
  })

  it('số điện thoại hợp lệ → 200', async () => {
    const res = await api('PUT', '/me', { token, body: { phoneNumber: '0901 234 567' } })
    expect(res.status).toBe(200)
  })

  it('bỏ trống số điện thoại vẫn được', async () => {
    const res = await api('PUT', '/me', { token, body: { phoneNumber: '' } })
    expect(res.status).toBe(200)
  })
})

describe('AI phân tích câu', () => {
  it('không trả 500 "Lỗi hệ thống" khi dịch vụ AI chưa sẵn sàng', async () => {
    await prisma.user.update({ where: { email }, data: { plan: 'PRO' } })
    const res = await api('POST', '/ai/parse-tasks', {
      token,
      body: { text: 'Sáng 7h tập gym. Chiều 2h họp team' },
    })
    expect(res.status).not.toBe(500)
    if (res.status >= 400) {
      expect(res.data.message).not.toBe('Lỗi hệ thống')
    }
  })

  it('gói Free vẫn dùng được AI (chỉ giới hạn số lượt mỗi ngày)', async () => {
    await prisma.user.update({ where: { email }, data: { plan: 'FREE', planExpiresAt: null } })
    const res = await api('POST', '/ai/parse-tasks', { token, body: { text: 'Họp team 9h' } })
    // Không còn bị chặn 403 vì gói: chỉ hết lượt mới trả 429
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(429)
  })
})
