import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, cleanup, prisma } from './setup.js'
import taskRepo from '../src/repositories/taskRepo.js'

async function newUser(prefix) {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'Trash Test')
  const loginRes = await login(email, 'Test@1234')
  const token = loginRes.data.data.accessToken
  const row = await prisma.user.findUnique({ where: { email }, select: { userId: true } })
  return { email, token, userId: row.userId }
}

/**
 * Hạn của việc test: **hôm nay**, tính theo ngày của MÁY CHỦ (giờ VN = UTC+7, xem
 * `utils/dateUtils.js`). Cố ý không dùng thẳng `now + 1h` như trước: chạy suite
 * trong giờ cuối của ngày (22h–24h VN) thì "+1 giờ" hoá thành NGÀY MAI và
 * `todayCount` về 0 — test đỏ oan, chỉ vì chạy muộn, và người sửa sau sẽ đi tìm
 * lỗi ở dashboard. Ở đây vẫn ưu tiên "sắp tới trong hôm nay" (now + 1h) nhưng
 * chặn lại ở 23:59 hôm nay, nên không bao giờ vượt sang ngày mai.
 */
function dueToday() {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000
  const now = Date.now()
  const vnNow = new Date(now + VN_OFFSET_MS)
  const endOfVnDay =
    Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate(), 23, 59, 0) -
    VN_OFFSET_MS
  return new Date(Math.min(now + 3600_000, endOfVnDay)).toISOString()
}

async function createTask(token, title) {
  const res = await api('POST', '/tasks', { token, body: { title, dueAt: dueToday() } })
  expect(res.status).toBe(201)
  return res.data.data
}

beforeAll(async () => {
  await startServer()
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('Thùng rác (xoá mềm)', () => {
  it('xoá là đưa vào thùng rác: còn trong DB nhưng biến mất khỏi list và dashboard', async () => {
    const u = await newUser('trash_list')
    const task = await createTask(u.token, 'Việc sẽ xoá')

    const before = await api('GET', '/dashboard', { token: u.token })
    expect(before.data.data.todayCount).toBe(1)

    const del = await api('DELETE', `/tasks/${task.id}`, { token: u.token })
    expect(del.status).toBe(200)

    // Vẫn còn dòng trong DB (xoá mềm) nhưng đã đánh dấu
    const row = await prisma.task.findUnique({ where: { taskId: task.id } })
    expect(row).not.toBeNull()
    expect(row.deletedAt).not.toBeNull()

    // Không còn trong list công việc
    const list = await api('GET', '/tasks', { token: u.token })
    const ids = list.data.data.items.map((t) => t.taskId ?? t.id)
    expect(ids).not.toContain(task.id)

    // Dashboard không còn đếm
    const after = await api('GET', '/dashboard', { token: u.token })
    expect(after.data.data.todayCount).toBe(0)

    // Và hiện trong thùng rác
    const trash = await api('GET', '/tasks/trash', { token: u.token })
    expect(trash.data.data.items.map((t) => t.taskId ?? t.id)).toContain(task.id)
  })

  it('khôi phục đưa việc về list và bật lại nhắc nhở tương lai', async () => {
    const u = await newUser('trash_restore')
    const task = await createTask(u.token, 'Việc khôi phục')
    const remindAt = new Date(Date.now() + 7200_000)
    const reminder = await prisma.reminder.create({
      data: { taskId: task.id, remindAt, status: 'SCHEDULED' },
    })

    await api('DELETE', `/tasks/${task.id}`, { token: u.token })
    // Khi đưa vào thùng rác thì nhắc bị huỷ để không báo cho việc đã "xoá"
    let row = await prisma.reminder.findUnique({ where: { reminderId: reminder.reminderId } })
    expect(row.status).toBe('CANCELLED')

    const restored = await api('POST', `/tasks/${task.id}/restore`, { token: u.token })
    expect(restored.status).toBe(200)

    // Việc quay lại list
    const list = await api('GET', '/tasks', { token: u.token })
    expect(list.data.data.items.map((t) => t.taskId ?? t.id)).toContain(task.id)

    // Nhắc trong tương lai được bật lại
    row = await prisma.reminder.findUnique({ where: { reminderId: reminder.reminderId } })
    expect(row.status).toBe('SCHEDULED')

    // Rút khỏi thùng rác
    const trash = await api('GET', '/tasks/trash', { token: u.token })
    expect(trash.data.data.items.map((t) => t.taskId ?? t.id)).not.toContain(task.id)
  })

  it('giờ xoá được cả việc đã phát thông báo (hết lệnh cấm cũ)', async () => {
    const u = await newUser('trash_logged')
    const task = await createTask(u.token, 'Việc đã nhắc')
    const reminder = await prisma.reminder.create({
      data: { taskId: task.id, remindAt: new Date(Date.now() + 3600_000), status: 'SCHEDULED' },
    })
    await prisma.notificationLog.create({
      data: { reminderId: reminder.reminderId, action: 'SENT' },
    })

    // Trước đây trả 400 "Không thể xóa công việc đã phát sinh thông báo"
    const del = await api('DELETE', `/tasks/${task.id}`, { token: u.token })
    expect(del.status).toBe(200)
    expect(del.data.message).toMatch(/thùng rác/i)
  })

  it('xoá sạch thùng rác xoá vĩnh viễn, chỉ của chính mình', async () => {
    const u = await newUser('trash_empty')
    const other = await newUser('trash_other')

    const t1 = await createTask(u.token, 'Rác 1')
    const t2 = await createTask(u.token, 'Rác 2')
    const keep = await createTask(u.token, 'Việc đang dùng')
    const otherTask = await createTask(other.token, 'Việc của người khác')

    await api('DELETE', `/tasks/${t1.id}`, { token: u.token })
    await api('DELETE', `/tasks/${t2.id}`, { token: u.token })
    await api('DELETE', `/tasks/${otherTask.id}`, { token: other.token })

    const empty = await api('DELETE', '/tasks/trash', { token: u.token })
    expect(empty.status).toBe(200)
    expect(empty.data.data.removed).toBe(2)

    // Hai việc đã xoá thật, việc đang dùng còn nguyên
    expect(await prisma.task.findUnique({ where: { taskId: t1.id } })).toBeNull()
    expect(await prisma.task.findUnique({ where: { taskId: t2.id } })).toBeNull()
    expect(await prisma.task.findUnique({ where: { taskId: keep.id } })).not.toBeNull()
    // Không đụng tới thùng rác của người khác
    expect(await prisma.task.findUnique({ where: { taskId: otherTask.id } })).not.toBeNull()
  })

  it('purgeExpired chỉ xoá việc đã ở thùng rác quá 30 ngày', async () => {
    const u = await newUser('trash_purge')
    const old = await createTask(u.token, 'Việc xoá hồi tháng trước')
    const fresh = await createTask(u.token, 'Việc mới xoá')

    await api('DELETE', `/tasks/${old.id}`, { token: u.token })
    await api('DELETE', `/tasks/${fresh.id}`, { token: u.token })
    await prisma.task.update({
      where: { taskId: old.id },
      data: { deletedAt: new Date(Date.now() - 31 * 86400000) },
    })

    const removed = await taskRepo.purgeExpired(30)
    expect(removed).toBeGreaterThanOrEqual(1)

    expect(await prisma.task.findUnique({ where: { taskId: old.id } })).toBeNull()
    expect(await prisma.task.findUnique({ where: { taskId: fresh.id } })).not.toBeNull()

    // Dọn nốt để không rơi vào test khác
    await api('DELETE', '/tasks/trash', { token: u.token })
  })

  it('không khôi phục được việc của người khác', async () => {
    const u = await newUser('trash_owner')
    const other = await newUser('trash_victim')
    const victimTask = await createTask(other.token, 'Việc của nạn nhân')
    await api('DELETE', `/tasks/${victimTask.id}`, { token: other.token })

    const steal = await api('POST', `/tasks/${victimTask.id}/restore`, { token: u.token })
    expect(steal.status).toBe(404)
    // Vẫn nằm trong thùng rác của người kia
    const row = await prisma.task.findUnique({ where: { taskId: victimTask.id } })
    expect(row.deletedAt).not.toBeNull()
  })
})
