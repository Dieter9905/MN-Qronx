import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { startServer, stopServer, api, register, login, prisma } from './setup.js'
import { dispatchReminder } from '../src/services/reminderDispatchService.js'
import {
  MAX_ASSIGNEES_PER_TASK,
  reminderTargetsForTask,
  nextTurnAssignee,
} from '../src/services/taskShareService.js'

// Ghi lại mọi lời gọi gửi thông báo đẩy. Thay dịch vụ gửi thay vì thay hàm trong
// dịch vụ khác: đổi thuộc tính của module KHÔNG ảnh hưởng tới liên kết đã import,
// nên cách "gán đè" thường thấy sẽ cho test luôn xanh một cách vô nghĩa.
const { pushCalls } = vi.hoisted(() => ({ pushCalls: [] }))

vi.mock('../src/services/pushService.js', () => ({
  pushToUser: async (userId) => {
    pushCalls.push(Number(userId))
    return { total: 1, ok: 1 }
  },
  countSubscriptions: async () => 1,
}))

// ─── Giao việc cho người khác (gói Pro) ─────────────────────
//
// Đây là quyền lợi Pro DUY NHẤT mà Free/Plus không thể có bằng cách nào khác, nên
// phần quan trọng nhất của bộ test là LAN CAN AN TOÀN: người được giao phải thấy
// đúng việc của mình, và KHÔNG thấy gì khác của chủ việc.

beforeAll(async () => {
  await startServer()
})

afterAll(async () => {
  await stopServer()
})

async function newUser(prefix, plan = 'FREE') {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'Share Test')
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

async function makeTask(token, title, extra = {}) {
  const res = await api('POST', '/tasks', {
    token,
    body: {
      title,
      dueAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
      ...extra,
    },
  })
  return res.data.data.id
}

// ─── Cổng gói ───────────────────────────────────────────────

describe('Giao việc — quyền theo gói', () => {
  it('gói Free bị chặn kèm chỉ dẫn nâng cấp Pro', async () => {
    const owner = await newUser('share_free', 'FREE')
    const helper = await newUser('share_free_helper')
    const taskId = await makeTask(owner.token, 'Việc của người Free')

    const res = await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: helper.email },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('Pro')
    // Không được tạo dòng nào khi đã chặn
    expect(await prisma.taskShare.count({ where: { taskId } })).toBe(0)
  })

  it('gói Plus cũng bị chặn — giao việc là mốc phân biệt Plus với Pro', async () => {
    const owner = await newUser('share_plus', 'PLUS')
    const helper = await newUser('share_plus_helper')
    const taskId = await makeTask(owner.token, 'Việc của người Plus')

    const res = await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: helper.email },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('Pro')
  })

  it('gói Pro giao được việc và trả về kèm công việc đã cập nhật', async () => {
    const owner = await newUser('share_pro', 'PRO')
    const helper = await newUser('share_pro_helper')
    const taskId = await makeTask(owner.token, 'Nộp báo cáo quý')

    const res = await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: helper.email, note: 'Em gửi giúp anh trước 5h nhé' },
    })
    expect(res.status).toBe(201)
    expect(res.data.data.share.assignee.fullName).toBe('Share Test')
    expect(res.data.data.share.note).toContain('trước 5h')
    // Công việc trả kèm phải đã có người được giao — để giao diện khỏi gọi thêm lượt
    expect(res.data.data.task.shareCount).toBe(1)
    expect(res.data.data.task.assignees[0].assignee.email).toBe(helper.email)
  })
})

// ─── Luật giao việc ─────────────────────────────────────────

describe('Giao việc — các luật', () => {
  let owner
  let helper

  beforeAll(async () => {
    owner = await newUser('share_rules_owner', 'PRO')
    helper = await newUser('share_rules_helper')
  })

  it('email không có tài khoản → nói rõ cần rủ họ đăng ký, không tạo dòng nào', async () => {
    const taskId = await makeTask(owner.token, 'Việc cho người lạ')
    const res = await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: 'chua_co_tai_khoan_xyz@example.com' },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('chưa có tài khoản')
    expect(await prisma.taskShare.count({ where: { taskId } })).toBe(0)
  })

  it('email khớp không phân biệt chữ hoa chữ thường', async () => {
    const taskId = await makeTask(owner.token, 'Việc gõ email hoa')
    const res = await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: helper.email.toUpperCase() },
    })
    expect(res.status).toBe(201)
    expect(res.data.data.share.assignee.email).toBe(helper.email)
  })

  it('không giao việc cho chính mình', async () => {
    const taskId = await makeTask(owner.token, 'Việc tự giao')
    const res = await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: owner.email },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('chính mình')
  })

  it('giao trùng một người hai lần → báo đã giao rồi', async () => {
    const taskId = await makeTask(owner.token, 'Việc giao hai lần')
    await api('POST', `/tasks/${taskId}/shares`, { token: owner.token, body: { email: helper.email } })
    const res = await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: helper.email },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('đã được giao')
  })

  it('việc đã xong thì không giao được nữa', async () => {
    const taskId = await makeTask(owner.token, 'Việc đã xong rồi')
    await api('POST', `/tasks/${taskId}/complete`, { token: owner.token })
    const res = await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: helper.email },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('đã kết thúc')
  })

  it('một việc chỉ giao cho tối đa giới hạn người', async () => {
    const taskId = await makeTask(owner.token, 'Việc đông người')
    const others = []
    for (let i = 0; i < MAX_ASSIGNEES_PER_TASK; i += 1) {
      others.push(await newUser(`share_cap_${i}`))
    }
    for (const u of others) {
      const r = await api('POST', `/tasks/${taskId}/shares`, {
        token: owner.token,
        body: { email: u.email },
      })
      expect(r.status).toBe(201)
    }
    const extra = await newUser('share_cap_extra')
    const res = await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: extra.email },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('tối đa')
  })
})

// ─── Phía người được giao ───────────────────────────────────

describe('Việc được giao — phía người nhận', () => {
  let owner
  let helper
  let outsider
  let taskId

  beforeAll(async () => {
    owner = await newUser('share_recv_owner', 'PRO')
    helper = await newUser('share_recv_helper')
    outsider = await newUser('share_recv_outsider')
    taskId = await makeTask(owner.token, 'Chuẩn bị tài liệu họp', {
      description: 'Bản nháp + số liệu tuần',
      priority: 'HIGH',
    })
    await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: helper.email },
    })
    // Việc riêng của chủ, người được giao KHÔNG được thấy
    await makeTask(owner.token, 'Việc riêng tư của chủ')
  })

  it('người được giao thấy việc kèm tên người nhờ và không cần tự mở app', async () => {
    const res = await api('GET', '/me/assigned', { token: helper.token })
    expect(res.status).toBe(200)
    const items = res.data.data
    expect(items).toHaveLength(1)
    expect(items[0].taskId).toBe(taskId)
    expect(items[0].title).toBe('Chuẩn bị tài liệu họp')
    expect(items[0].description).toContain('số liệu tuần')
    expect(items[0].priority).toBe('HIGH')
    expect(items[0].assignedBy.fullName).toBe('Share Test')
    expect(items[0].doneAt).toBeNull()
  })

  it('người khác không thấy việc không giao cho mình', async () => {
    const res = await api('GET', '/me/assigned', { token: outsider.token })
    expect(res.status).toBe(200)
    expect(res.data.data).toHaveLength(0)
  })

  it('người được giao KHÔNG xem được chi tiết việc qua /tasks/:id', async () => {
    const res = await api('GET', `/tasks/${taskId}`, { token: helper.token })
    expect(res.status).toBe(404)
  })

  it('người được giao KHÔNG sửa được việc của chủ', async () => {
    const res = await api('PUT', `/tasks/${taskId}`, {
      token: helper.token,
      body: { title: 'Đổi trộm tiêu đề' },
    })
    expect(res.status).toBe(404)
    const task = await prisma.task.findUnique({ where: { taskId }, select: { title: true } })
    expect(task.title).toBe('Chuẩn bị tài liệu họp')
  })

  it('người được giao KHÔNG đọc được danh sách người được giao của chủ', async () => {
    const res = await api('GET', `/tasks/${taskId}/shares`, { token: helper.token })
    expect(res.status).toBe(404)
  })

  it('đánh dấu xong phần mình — việc của chủ KHÔNG tự hoàn thành', async () => {
    const res = await api('PUT', `/me/assigned/${taskId}`, { token: helper.token, body: { done: true } })
    expect(res.status).toBe(200)
    expect(res.data.data.doneAt).not.toBeNull()

    const share = await prisma.taskShare.findFirst({ where: { taskId, assigneeId: helper.userId } })
    expect(share.doneAt).not.toBeNull()

    // Việc vẫn đang mở: chỉ chủ việc bấm Xong mới hoàn thành
    const task = await prisma.task.findUnique({ where: { taskId }, select: { status: true } })
    expect(task.status).toBe('TODO')

    // Và bỏ đánh dấu được
    const undo = await api('PUT', `/me/assigned/${taskId}`, {
      token: helper.token,
      body: { done: false },
    })
    expect(undo.data.data.doneAt).toBeNull()
  })

  it('người không được giao không đánh dấu xong được', async () => {
    const res = await api('PUT', `/me/assigned/${taskId}`, { token: outsider.token })
    expect(res.status).toBe(404)
  })

  it('chủ việc thu hồi → việc biến khỏi danh sách của người được giao', async () => {
    const list = await api('GET', `/tasks/${taskId}/shares`, { token: owner.token })
    const shareId = list.data.data[0].shareId

    const res = await api('DELETE', `/tasks/${taskId}/shares/${shareId}`, { token: owner.token })
    expect(res.status).toBe(200)
    expect(res.data.data.task.shareCount).toBe(0)

    const after = await api('GET', '/me/assigned', { token: helper.token })
    expect(after.data.data).toHaveLength(0)
  })
})

// ─── Luật "nhắc cho ai" (hàm thuần) ─────────────────────────

describe('Việc được giao — luật chuông kêu cho ai', () => {
  const ownerId = 10

  it('không có ai được giao → chỉ chủ việc', () => {
    expect(reminderTargetsForTask({ shares: [] }, ownerId)).toEqual([ownerId])
    expect(reminderTargetsForTask({}, ownerId)).toEqual([ownerId])
  })

  it('có người được giao chưa xong → cả hai cùng nghe chuông', () => {
    const task = { shares: [{ assigneeId: 11, doneAt: null }] }
    expect(reminderTargetsForTask(task, ownerId)).toEqual([ownerId, 11])
  })

  it('người đã báo xong thì thôi nhắc — họ đã làm xong việc của họ', () => {
    const task = { shares: [{ assigneeId: 11, doneAt: new Date() }] }
    expect(reminderTargetsForTask(task, ownerId)).toEqual([ownerId])
  })

  it('giao cho chính chủ (dữ liệu cũ) không làm chuông kêu hai lần', () => {
    const task = { shares: [{ assigneeId: ownerId, doneAt: null }] }
    expect(reminderTargetsForTask(task, ownerId)).toEqual([ownerId])
  })

  it('nhiều người được giao → mỗi người một lần, không trùng', () => {
    const task = {
      shares: [
        { assigneeId: 11, doneAt: null },
        { assigneeId: 12, doneAt: new Date() },
        { assigneeId: 13, doneAt: null },
        { assigneeId: 11, doneAt: null },
      ],
    }
    expect(reminderTargetsForTask(task, ownerId)).toEqual([ownerId, 11, 13])
  })
})

// ─── Nhắc nhở thật sự gửi tới người được giao ───────────────

describe('Việc được giao — dispatchReminder gửi cho cả người nhận', () => {
  let owner
  let helper

  beforeAll(async () => {
    owner = await newUser('share_push_owner', 'PRO')
    helper = await newUser('share_push_helper')
  })

  /** Nạp một nhắc nhở đã đến hạn kèm đúng những gì scheduler thật nạp. */
  async function loadDueReminder(taskId) {
    const reminder = await prisma.reminder.create({
      data: { taskId, remindAt: new Date(Date.now() - 60_000), status: 'SCHEDULED' },
    })
    return prisma.reminder.findUnique({
      where: { reminderId: reminder.reminderId },
      include: {
        task: {
          include: {
            user: { include: { devices: { where: { isActive: true } } } },
            shares: { where: { doneAt: null }, select: { assigneeId: true, doneAt: true } },
          },
        },
      },
    })
  }

  it('chủ việc và người được giao cùng nhận; người đã báo xong thì không', async () => {
    const taskId = await makeTask(owner.token, 'Việc cần nhắc hai người')
    await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: helper.email },
    })

    pushCalls.length = 0
    await dispatchReminder(await loadDueReminder(taskId))
    expect(pushCalls).toContain(owner.userId)
    expect(pushCalls).toContain(helper.userId)

    // Người được giao báo xong → lượt sau chỉ còn chủ việc
    await api('PUT', `/me/assigned/${taskId}`, { token: helper.token, body: { done: true } })
    pushCalls.length = 0
    await dispatchReminder(await loadDueReminder(taskId))
    expect(pushCalls).toContain(owner.userId)
    expect(pushCalls).not.toContain(helper.userId)
  })

  it('việc không giao cho ai thì không gửi thừa cho ai khác', async () => {
    const taskId = await makeTask(owner.token, 'Việc chỉ của một mình tôi')
    pushCalls.length = 0
    await dispatchReminder(await loadDueReminder(taskId))
    expect(pushCalls).toEqual([owner.userId])
  })
})

// ─── Việc lặp lại giữ người được giao ───────────────────────

describe('Việc được giao — việc lặp lại giữ nguyên người nhận', () => {
  it('sinh kỳ kế tiếp thì người được giao vẫn còn, trạng thái xong được đặt lại', async () => {
    const owner = await newUser('share_repeat_owner', 'PRO')
    const helper = await newUser('share_repeat_helper')
    const taskId = await makeTask(owner.token, 'Đổ rác hằng ngày', { repeatType: 'DAILY' })
    await api('POST', `/tasks/${taskId}/shares`, {
      token: owner.token,
      body: { email: helper.email, note: 'Việc của em' },
    })
    await api('PUT', `/me/assigned/${taskId}`, { token: helper.token, body: { done: true } })

    const res = await api('POST', `/tasks/${taskId}/complete`, { token: owner.token })
    const nextTaskId = res.data.data.nextTask.id
    expect(nextTaskId).toBeTruthy()

    const next = await prisma.taskShare.findMany({ where: { taskId: nextTaskId } })
    expect(next).toHaveLength(1)
    expect(next[0].assigneeId).toBe(helper.userId)
    expect(next[0].note).toBe('Việc của em')
    // Kỳ mới nên chưa ai báo xong
    expect(next[0].doneAt).toBeNull()

    const list = await api('GET', '/me/assigned', { token: helper.token })
    expect(list.data.data.some((i) => i.taskId === nextTaskId)).toBe(true)
  })
})

// ─── Luân phiên người làm ───────────────────────────────────
//
// Phần dễ sai nhất không phải mấy đường API mà là VÒNG XOAY: thứ tự lượt, quay lại
// người đầu khi hết vòng, và lượt cũ trỏ vào người đã bị gỡ. Sai mấy chỗ đó thì
// tính năng vẫn "chạy" — mà việc thì rơi vào tay người không biết mình có việc.

describe('Luân phiên — vòng xoay (hàm thuần)', () => {
  const order = (ids) =>
    ids.map((id, i) => ({
      shareId: i + 1,
      assigneeId: id,
      createdAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
    }))

  it('đi hết vòng thì quay lại người đầu', () => {
    const shares = order([11, 22, 33])
    expect(nextTurnAssignee(shares, 11)).toBe(22)
    expect(nextTurnAssignee(shares, 22)).toBe(33)
    expect(nextTurnAssignee(shares, 33)).toBe(11)
  })

  it('lượt cũ trỏ vào người đã bị gỡ → bắt đầu lại từ người đầu, không để trống', () => {
    expect(nextTurnAssignee(order([11, 22]), 999)).toBe(11)
    expect(nextTurnAssignee([], 11)).toBeNull()
  })

  it('thứ tự là thứ tự GIAO việc, không phụ thuộc DB trả về kiểu gì', () => {
    const scrambled = [
      { shareId: 3, assigneeId: 33, createdAt: new Date('2026-01-03T00:00:00Z') },
      { shareId: 1, assigneeId: 11, createdAt: new Date('2026-01-01T00:00:00Z') },
      { shareId: 2, assigneeId: 22, createdAt: new Date('2026-01-02T00:00:00Z') },
    ]
    expect(nextTurnAssignee(scrambled, 11)).toBe(22)
  })

  it('cùng lúc tạo (createdAt bằng nhau) thì xếp theo shareId', () => {
    const sameTime = new Date('2026-02-02T00:00:00Z')
    const shares = [
      { shareId: 9, assigneeId: 99, createdAt: sameTime },
      { shareId: 7, assigneeId: 77, createdAt: sameTime },
    ]
    expect(nextTurnAssignee(shares, 77)).toBe(99)
  })

  it('chỉ nhắc ĐÚNG người đến lượt, không nhắc cả nhóm', () => {
    const task = {
      rotateEnabled: true,
      turnAssigneeId: 22,
      shares: [
        { assigneeId: 11, doneAt: null },
        { assigneeId: 22, doneAt: null },
        { assigneeId: 33, doneAt: null },
      ],
    }
    // 11 là chủ việc — chủ việc luôn được nhắc vì việc nằm trên bảng của họ
    expect(reminderTargetsForTask(task, 11)).toEqual([11, 22])

    // Người đến lượt đã báo xong → thôi nhắc họ, không nhắc luôn người khác
    const turnDone = {
      ...task,
      shares: [
        { assigneeId: 11, doneAt: null },
        { assigneeId: 22, doneAt: new Date() },
        { assigneeId: 33, doneAt: null },
      ],
    }
    expect(reminderTargetsForTask(turnDone, 11)).toEqual([11])

    // Lượt trống (mọi người bị gỡ) → vẫn nhắc chủ việc, không nhắc người ngoài lượt
    expect(reminderTargetsForTask({ ...task, turnAssigneeId: null }, 11)).toEqual([11])
  })

  it('việc KHÔNG luân phiên vẫn nhắc mọi người được giao như trước', () => {
    const task = {
      rotateEnabled: false,
      turnAssigneeId: null,
      shares: [
        { assigneeId: 11, doneAt: null },
        { assigneeId: 22, doneAt: null },
        { assigneeId: 33, doneAt: new Date() },
      ],
    }
    expect(reminderTargetsForTask(task, 11)).toEqual([11, 22])
  })
})

describe('Luân phiên — đường API', () => {
  let owner
  let a
  let b
  let outsider

  beforeAll(async () => {
    owner = await newUser('rotate_owner', 'PRO')
    a = await newUser('rotate_a')
    b = await newUser('rotate_b')
    outsider = await newUser('rotate_outsider')
  })

  /** Việc lặp lại đã giao cho 2 người — trạng thái để bật luân phiên. */
  async function rotatingTask(token = owner.token, repeatType = 'DAILY') {
    const taskId = await makeTask(token, 'Đổ rác', { repeatType })
    await api('POST', `/tasks/${taskId}/shares`, { token, body: { email: a.email } })
    await api('POST', `/tasks/${taskId}/shares`, { token, body: { email: b.email } })
    return taskId
  }

  it('việc không lặp lại thì không bật được kèm lý do', async () => {
    const taskId = await rotatingTask(owner.token, 'NONE')
    const res = await api('PUT', `/tasks/${taskId}/rotation`, {
      token: owner.token,
      body: { enabled: true },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('lặp lại')
    // Đã chặn thì không được ghi gì
    const row = await prisma.task.findUnique({ where: { taskId }, select: { rotateEnabled: true } })
    expect(row.rotateEnabled).toBe(false)
  })

  it('một người thì chưa xoay được', async () => {
    const taskId = await makeTask(owner.token, 'Việc một người', { repeatType: 'DAILY' })
    await api('POST', `/tasks/${taskId}/shares`, { token: owner.token, body: { email: a.email } })
    const res = await api('PUT', `/tasks/${taskId}/rotation`, {
      token: owner.token,
      body: { enabled: true },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('2 người')
  })

  it('gói Free bị chặn như mọi phần khác của giao việc', async () => {
    const free = await newUser('rotate_free', 'FREE')
    const taskId = await makeTask(free.token, 'Việc của người Free', { repeatType: 'DAILY' })
    const res = await api('PUT', `/tasks/${taskId}/rotation`, {
      token: free.token,
      body: { enabled: true },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('Pro')
  })

  it('bật luân phiên → lượt đầu thuộc người giao trước, trả kèm thứ tự lượt', async () => {
    const taskId = await rotatingTask()
    const res = await api('PUT', `/tasks/${taskId}/rotation`, {
      token: owner.token,
      body: { enabled: true },
    })
    expect(res.status).toBe(200)
    expect(res.data.message).toContain('luân phiên')
    const task = res.data.data.task
    expect(task.rotation.enabled).toBe(true)
    expect(task.rotation.turnAssigneeId).toBe(a.userId)
    expect(task.rotation.order).toEqual([a.userId, b.userId])
    // Trả kèm công việc đã chuyển đổi để giao diện vẽ lại khối người được giao
    expect(task.assignees).toHaveLength(2)
  })

  it('bấm bật hai lần không đẩy lượt sang người khác', async () => {
    const taskId = await rotatingTask()
    await api('PUT', `/tasks/${taskId}/rotation`, { token: owner.token, body: { enabled: true } })
    await api('PUT', `/tasks/${taskId}/rotation`, { token: owner.token, body: { enabled: true } })
    const row = await prisma.task.findUnique({ where: { taskId }, select: { turnAssigneeId: true } })
    expect(row.turnAssigneeId).toBe(a.userId)
  })

  it('hoàn thành kỳ này → kỳ sau thuộc người kế tiếp, đủ người và hết vòng thì quay lại', async () => {
    const taskId = await rotatingTask()
    await api('PUT', `/tasks/${taskId}/rotation`, { token: owner.token, body: { enabled: true } })

    const first = await api('POST', `/tasks/${taskId}/complete`, { token: owner.token })
    const next1 = first.data.data.nextTask.id
    const row1 = await prisma.task.findUnique({
      where: { taskId: next1 },
      select: { rotateEnabled: true, turnAssigneeId: true },
    })
    expect(row1.rotateEnabled).toBe(true)
    expect(row1.turnAssigneeId).toBe(b.userId)
    // Kỳ mới phải giữ ĐỦ người được giao, nếu không thì vòng xoay đứt sau một kỳ
    expect(await prisma.taskShare.count({ where: { taskId: next1 } })).toBe(2)
    const sharesNext = await prisma.taskShare.findMany({
      where: { taskId: next1 },
      select: { doneAt: true },
    })
    expect(sharesNext.every((s) => s.doneAt === null)).toBe(true)

    const second = await api('POST', `/tasks/${next1}/complete`, { token: owner.token })
    const next2 = second.data.data.nextTask.id
    const row2 = await prisma.task.findUnique({
      where: { taskId: next2 },
      select: { turnAssigneeId: true },
    })
    expect(row2.turnAssigneeId).toBe(a.userId)
  })

  it('người đến lượt thấy “đến lượt bạn”, người khác thì không', async () => {
    const taskId = await rotatingTask()
    await api('PUT', `/tasks/${taskId}/rotation`, { token: owner.token, body: { enabled: true } })

    const mine = await api('GET', '/me/assigned', { token: a.token })
    const item = mine.data.data.find((i) => i.taskId === taskId)
    expect(item.isMyTurn).toBe(true)
    expect(item.rotateEnabled).toBe(true)

    const other = await api('GET', '/me/assigned', { token: b.token })
    expect(other.data.data.find((i) => i.taskId === taskId).isMyTurn).toBe(false)
  })

  it('đổi người của kỳ này — chỉ sang người đã được giao việc', async () => {
    const taskId = await rotatingTask()
    await api('PUT', `/tasks/${taskId}/rotation`, { token: owner.token, body: { enabled: true } })

    const res = await api('PUT', `/tasks/${taskId}/rotation`, {
      token: owner.token,
      body: { assigneeId: b.userId },
    })
    expect(res.status).toBe(200)
    const row = await prisma.task.findUnique({ where: { taskId }, select: { turnAssigneeId: true } })
    expect(row.turnAssigneeId).toBe(b.userId)

    const bad = await api('PUT', `/tasks/${taskId}/rotation`, {
      token: owner.token,
      body: { assigneeId: outsider.userId },
    })
    expect(bad.status).toBe(400)
    expect(bad.data.message).toContain('đã được giao')
  })

  it('việc chưa bật luân phiên thì chưa đổi được người của kỳ', async () => {
    const taskId = await rotatingTask()
    const res = await api('PUT', `/tasks/${taskId}/rotation`, {
      token: owner.token,
      body: { assigneeId: b.userId },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('chưa bật luân phiên')
  })

  it('thu hồi người đang đến lượt → lượt sang người khác NGAY', async () => {
    const taskId = await rotatingTask()
    await api('PUT', `/tasks/${taskId}/rotation`, { token: owner.token, body: { enabled: true } })

    const list = await api('GET', `/tasks/${taskId}/shares`, { token: owner.token })
    const shareA = list.data.data.find((s) => s.assignee.id === a.userId)
    await api('DELETE', `/tasks/${taskId}/shares/${shareA.shareId}`, { token: owner.token })

    const row = await prisma.task.findUnique({ where: { taskId }, select: { turnAssigneeId: true } })
    expect(row.turnAssigneeId).toBe(b.userId)
  })

  it('thu hồi người duy nhất còn lại → lượt để trống chứ không trỏ vào người đã gỡ', async () => {
    const taskId = await rotatingTask()
    await api('PUT', `/tasks/${taskId}/rotation`, { token: owner.token, body: { enabled: true } })

    const list = await api('GET', `/tasks/${taskId}/shares`, { token: owner.token })
    for (const share of list.data.data) {
      await api('DELETE', `/tasks/${taskId}/shares/${share.shareId}`, { token: owner.token })
    }
    const row = await prisma.task.findUnique({ where: { taskId }, select: { turnAssigneeId: true } })
    expect(row.turnAssigneeId).toBeNull()
  })

  it('tắt luân phiên → xoá lượt, và kỳ sau không còn xoay', async () => {
    const taskId = await rotatingTask()
    await api('PUT', `/tasks/${taskId}/rotation`, { token: owner.token, body: { enabled: true } })
    const off = await api('PUT', `/tasks/${taskId}/rotation`, {
      token: owner.token,
      body: { enabled: false },
    })
    expect(off.status).toBe(200)
    expect(off.data.data.task.rotation.enabled).toBe(false)

    const row = await prisma.task.findUnique({
      where: { taskId },
      select: { rotateEnabled: true, turnAssigneeId: true },
    })
    expect(row.rotateEnabled).toBe(false)
    expect(row.turnAssigneeId).toBeNull()

    const done = await api('POST', `/tasks/${taskId}/complete`, { token: owner.token })
    const nextId = done.data.data.nextTask.id
    const child = await prisma.task.findUnique({
      where: { taskId: nextId },
      select: { rotateEnabled: true, turnAssigneeId: true },
    })
    expect(child.rotateEnabled).toBe(false)
    expect(child.turnAssigneeId).toBeNull()
  })

  it('người ngoài không bật được luân phiên cho việc của chủ', async () => {
    const taskId = await rotatingTask()
    // Cố ý dùng người CÓ gói Pro nhưng không phải chủ việc: nếu chỉ chặn theo gói
    // thì đây vẫn là lỗ cho người ngoài — cổng "chỉ chủ việc" phải đứng riêng.
    const proOutsider = await newUser('rotate_pro_outsider', 'PRO')
    const res = await api('PUT', `/tasks/${taskId}/rotation`, {
      token: proOutsider.token,
      body: { enabled: true },
    })
    expect(res.status).toBe(404)
  })
})
