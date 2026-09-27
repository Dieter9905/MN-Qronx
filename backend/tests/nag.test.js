import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, prisma } from './setup.js'
import {
  NAG_INTERVALS,
  NAG_MAX_REPEATS,
  nextNagPlan,
  nagNotificationText,
  parseNagEveryMinutes,
  assertNagAllowed,
} from '../src/services/nagService.js'
import { dispatchReminder } from '../src/services/reminderDispatchService.js'

// ─── Tiện ích ───────────────────────────────────────────────

async function newUser(prefix, plan = 'FREE') {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'Nag Test')
  const loginRes = await login(email, 'Test@1234')
  const token = loginRes.data.data.accessToken
  const row = await prisma.user.findUnique({ where: { email }, select: { userId: true } })
  if (plan !== 'FREE') {
    await prisma.user.update({
      where: { userId: row.userId },
      data: { plan, planExpiresAt: new Date(Date.now() + 30 * 86400_000) },
    })
  }
  return { email, token, userId: row.userId }
}

function taskPayload(extra = {}) {
  return {
    title: 'Việc quan trọng không được quên',
    dueAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
    ...extra,
  }
}

// ─── Logic thuần: khi nào thì nhắc lại ──────────────────────

describe('Nhắc dai — luật nhắc lại', () => {
  const task = { nagEveryMinutes: 5, status: 'TODO' }
  const proUser = { plan: 'PRO' }

  it('việc chưa xong + gói Pro → hẹn kêu lại đúng chu kỳ', () => {
    const nag = nextNagPlan({ task, user: proUser, reminder: { nagCount: 0 } })
    expect(nag).not.toBeNull()
    expect(nag.count).toBe(1)
    expect(nag.every).toBe(5)
    // Hẹn lại trong tương lai, đúng khoảng 5 phút
    const minutes = (nag.remindAt.getTime() - Date.now()) / 60000
    expect(minutes).toBeGreaterThan(4.9)
    expect(minutes).toBeLessThan(5.1)
  })

  it('không bật nhắc dai → không hẹn lại', () => {
    expect(nextNagPlan({ task: { ...task, nagEveryMinutes: null }, user: proUser, reminder: {} })).toBeNull()
    expect(nextNagPlan({ task: { ...task, nagEveryMinutes: 0 }, user: proUser, reminder: {} })).toBeNull()
  })

  it('việc đã xong hoặc đã huỷ → im chuông', () => {
    expect(nextNagPlan({ task: { ...task, status: 'COMPLETED' }, user: proUser, reminder: {} })).toBeNull()
    expect(nextNagPlan({ task: { ...task, status: 'CANCELLED' }, user: proUser, reminder: {} })).toBeNull()
  })

  it('gói không có quyền (Free/Plus) → không nhắc dai kể cả khi việc còn giá trị cũ', () => {
    expect(nextNagPlan({ task, user: { plan: 'FREE' }, reminder: {} })).toBeNull()
    expect(nextNagPlan({ task, user: { plan: 'PLUS' }, reminder: {} })).toBeNull()
  })

  it('hết trần thì dừng — không bao giờ thành spam', () => {
    expect(nextNagPlan({ task, user: proUser, reminder: { nagCount: NAG_MAX_REPEATS - 1 } }).count).toBe(
      NAG_MAX_REPEATS
    )
    expect(nextNagPlan({ task, user: proUser, reminder: { nagCount: NAG_MAX_REPEATS } })).toBeNull()
    expect(nextNagPlan({ task, user: proUser, reminder: { nagCount: NAG_MAX_REPEATS + 3 } })).toBeNull()
  })

  it('nội dung thông báo nói rõ là nhắc lại lần thứ mấy', () => {
    expect(nagNotificationText({ title: 'Nộp thuế' }, 0).title).toBe('⏰ Nộp thuế')
    const again = nagNotificationText({ title: 'Nộp thuế' }, 3)
    expect(again.title).toContain('Nhắc lại lần 3')
    expect(again.body).toContain('Xong')
  })
})

describe('Nhắc dai — chuẩn hoá & chặn theo gói', () => {
  it('chu kỳ hợp lệ được nhận, rỗng nghĩa là tắt', () => {
    expect(parseNagEveryMinutes(5)).toBe(5)
    expect(parseNagEveryMinutes('10')).toBe(10)
    expect(parseNagEveryMinutes(null)).toBeNull()
    expect(parseNagEveryMinutes('')).toBeNull()
    expect(parseNagEveryMinutes(0)).toBeNull()
  })

  it('chu kỳ ngoài danh sách bị từ chối', () => {
    expect(() => parseNagEveryMinutes(7)).toThrow(/không hợp lệ/)
    expect(() => parseNagEveryMinutes(-5)).toThrow(/không hợp lệ/)
    expect(NAG_INTERVALS).toContain(1)
  })

  it('chỉ Pro mới được bật', () => {
    expect(() => assertNagAllowed('PRO', 5)).not.toThrow()
    expect(() => assertNagAllowed('FREE', 5)).toThrow(/Pro/)
    expect(() => assertNagAllowed('PLUS', 5)).toThrow(/Pro/)
    // Không bật (null) thì không kiểm tra gì — mọi gói đều lưu được việc thường
    expect(() => assertNagAllowed('FREE', null)).not.toThrow()
  })
})

// ─── Qua API thật ───────────────────────────────────────────

describe('Nhắc dai qua API', () => {
  let free
  let pro

  beforeAll(async () => {
    await startServer()
    free = await newUser('nag_free')
    pro = await newUser('nag_pro', 'PRO')
  }, 300000)

  afterAll(async () => {
    await stopServer()
  })

  it('gói Miễn phí gửi kèm chu kỳ nhắc dai → 400 kèm chỉ dẫn nâng cấp', async () => {
    const res = await api('POST', '/tasks', {
      token: free.token,
      body: taskPayload({ nagEveryMinutes: 5 }),
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toMatch(/Pro/)
  })

  it('gói Pro lưu được chu kỳ và trả lại đúng khi đọc chi tiết', async () => {
    const res = await api('POST', '/tasks', {
      token: pro.token,
      body: taskPayload({ nagEveryMinutes: 2 }),
    })
    expect(res.status).toBe(201)
    expect(res.data.data.nagEveryMinutes).toBe(2)

    const detail = await api('GET', `/tasks/${res.data.data.id}`, { token: pro.token })
    expect(detail.status).toBe(200)
    expect(detail.data.data.nagEveryMinutes).toBe(2)
  })

  it('chu kỳ lạ → 400 (không lưu giá trị vô nghĩa)', async () => {
    const res = await api('POST', '/tasks', {
      token: pro.token,
      body: taskPayload({ nagEveryMinutes: 7 }),
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toMatch(/không hợp lệ/)
  })

  it('Pro tắt được nhắc dai của việc cũ, và Free không bật được qua đường sửa', async () => {
    const created = await api('POST', '/tasks', {
      token: pro.token,
      body: taskPayload({ nagEveryMinutes: 15 }),
    })
    const taskId = created.data.data.id

    const off = await api('PUT', `/tasks/${taskId}`, {
      token: pro.token,
      body: { nagEveryMinutes: null },
    })
    expect(off.status).toBe(200)
    expect(off.data.data.nagEveryMinutes).toBeNull()

    const freeTask = await api('POST', '/tasks', { token: free.token, body: taskPayload() })
    expect(freeTask.status).toBe(201)
    const cheat = await api('PUT', `/tasks/${freeTask.data.data.id}`, {
      token: free.token,
      body: { nagEveryMinutes: 10 },
    })
    expect(cheat.status).toBe(400)
    expect(cheat.data.message).toMatch(/Pro/)
  })

  it('việc không bật nhắc dai vẫn tạo bình thường và trả nagEveryMinutes = null', async () => {
    const res = await api('POST', '/tasks', { token: free.token, body: taskPayload({ title: 'Việc thường' }) })
    expect(res.status).toBe(201)
    expect(res.data.data.nagEveryMinutes).toBeNull()
  })
})

// ─── Gửi thật: đúng cái mà cron gọi mỗi phút ────────────────
describe('Chuông kêu rồi hẹn lại (dispatchReminder)', () => {
  let pro
  let free

  beforeAll(async () => {
    await startServer()
    pro = await newUser('nag_disp_pro', 'PRO')
    free = await newUser('nag_disp_free')
  }, 300000)

  afterAll(async () => {
    await stopServer()
  })

  /** Tạo việc + một reminder đã tới hạn (như thể cron vừa tìm thấy nó). */
  async function dueReminderFor(userId, nagEveryMinutes, repeatType = 'NONE') {
    const task = await prisma.task.create({
      data: {
        userId,
        title: 'Nộp hồ sơ trước 17h',
        dueAt: new Date(Date.now() + 3600_000),
        repeatType,
        nagEveryMinutes,
      },
    })
    const reminder = await prisma.reminder.create({
      data: { taskId: task.taskId, remindAt: new Date(Date.now() - 60_000), status: 'SCHEDULED' },
    })
    return { task, reminder }
  }

  async function loadReminder(reminderId) {
    const row = await prisma.reminder.findUnique({
      where: { reminderId },
      include: { task: { include: { user: { include: { devices: true } } } } },
    })
    return row
  }

  it('việc Pro chưa xong → reminder được hẹn kêu lại và nagCount tăng', async () => {
    const { reminder } = await dueReminderFor(pro.userId, 5)
    const res = await dispatchReminder(await loadReminder(reminder.reminderId))

    expect(res.nagged).toBe(true)
    const after = await prisma.reminder.findUnique({ where: { reminderId: reminder.reminderId } })
    expect(after.status).toBe('SCHEDULED')
    expect(after.nagCount).toBe(1)
    const minutes = (after.remindAt.getTime() - Date.now()) / 60000
    expect(minutes).toBeGreaterThan(4.8)
    expect(minutes).toBeLessThan(5.2)
  })

  it('lần kêu thứ hai ghi nhận đúng số lần và nói rõ “Nhắc lại lần 2”', async () => {
    const { reminder } = await dueReminderFor(pro.userId, 2)
    await prisma.reminder.update({ where: { reminderId: reminder.reminderId }, data: { nagCount: 1 } })
    await dispatchReminder(await loadReminder(reminder.reminderId))
    const after = await prisma.reminder.findUnique({ where: { reminderId: reminder.reminderId } })
    expect(after.nagCount).toBe(2)
    expect(after.status).toBe('SCHEDULED')
  })

  it('bấm Xong là chuông im: reminder đã bị huỷ thì không kêu lại nữa', async () => {
    const { task, reminder } = await dueReminderFor(pro.userId, 1)
    const done = await api('POST', `/tasks/${task.taskId}/complete`, { token: pro.token })
    expect(done.status).toBe(200)

    const cancelled = await prisma.reminder.findUnique({ where: { reminderId: reminder.reminderId } })
    expect(cancelled.status).toBe('CANCELLED')
    expect(cancelled.nagCount).toBe(0)
  })

  it('việc lặp lại giữ luôn nhắc dai cho lần sau', async () => {
    const { task } = await dueReminderFor(pro.userId, 10, 'DAILY')
    const done = await api('POST', `/tasks/${task.taskId}/complete`, { token: pro.token })
    expect(done.status).toBe(200)

    const child = await prisma.task.findFirst({ where: { parentTaskId: task.taskId } })
    expect(child).not.toBeNull()
    expect(child.nagEveryMinutes).toBe(10)
    expect(child.status).toBe('TODO')
  })

  it('gói Miễn phí: chuông kêu đúng một lần rồi thôi', async () => {
    const { reminder } = await dueReminderFor(free.userId, 5)
    const res = await dispatchReminder(await loadReminder(reminder.reminderId))

    expect(res.nagged).toBe(false)
    const after = await prisma.reminder.findUnique({ where: { reminderId: reminder.reminderId } })
    expect(after.status).toBe('TRIGGERED')
    expect(after.nagCount).toBe(0)
  })
})
