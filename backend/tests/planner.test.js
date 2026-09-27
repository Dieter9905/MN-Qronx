import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, prisma } from './setup.js'
import {
  PLAN_DAYS,
  CAPACITY_OPTIONS,
  DEFAULT_CAPACITY,
  parseCapacity,
  assertPlannerAllowed,
  planWeek,
} from '../src/services/plannerService.js'
import { planCatalog } from '../src/utils/planLimits.js'

// ─── Kế hoạch tuần (gói Pro) ────────────────────────────────
//
// Vì sao phải test kỹ phần này: kế hoạch là thứ khách dùng để QUYẾT ĐỊNH hôm nay
// làm gì. Xếp sai thứ tự (việc quá hạn bị đẩy ra sau), vượt quá số việc một ngày,
// hay giấu việc chắc chắn sẽ trễ — đều làm khách mất việc thật, chứ không chỉ là
// một màn hình xấu.

const DAY = 86400_000

// Mốc cố định: 27/09/2026 10:00 giờ Việt Nam (03:00 UTC) → ngày VN là 27/09
const NOW = new Date('2026-09-27T03:00:00Z')

/** Thời điểm 09:00 giờ VN của ngày (hôm nay + offset). */
function dueVn(dayOffset, vnHour = 9) {
  return new Date(Date.UTC(2026, 8, 27 + dayOffset, vnHour - 7, 0, 0))
}

function task(taskId, title, dueAt, priority = 'MEDIUM') {
  return { taskId, title, dueAt, priority, categoryName: null, nagEveryMinutes: null }
}

async function newUser(prefix, plan = 'FREE') {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'Planner Test')
  const loginRes = await login(email, 'Test@1234')
  const token = loginRes.data.data.accessToken
  const row = await prisma.user.findUnique({ where: { email }, select: { userId: true } })
  if (plan !== 'FREE') {
    await prisma.user.update({
      where: { userId: row.userId },
      data: { plan, planExpiresAt: new Date(Date.now() + 30 * DAY) },
    })
  }
  return { email, token, userId: row.userId }
}

async function createTask(token, body) {
  const res = await api('POST', '/tasks', { token, body })
  expect(res.status).toBe(201)
  return res.data.data.id
}

/** API không cho tạo việc với hạn trong quá khứ → tạo trước rồi sửa hạn trong DB. */
async function setDue(taskId, dueAt, status = 'TODO') {
  await prisma.task.update({ where: { taskId }, data: { dueAt, status } })
}

// ─── Luật thuần: xếp việc vào 7 ngày ────────────────────────

describe('Kế hoạch tuần — luật xếp việc', () => {
  const tasks = [
    task(1, 'A quá hạn 3 ngày', dueVn(-3), 'LOW'),
    task(2, 'B quá hạn 1 ngày', dueVn(-1), 'URGENT'),
    task(3, 'C hạn sau 2 ngày', dueVn(2), 'MEDIUM'),
    task(4, 'D hạn sau 2 ngày', dueVn(2), 'URGENT'),
    task(5, 'E hạn sau 10 ngày', dueVn(10), 'HIGH'),
  ]

  it('dựng đủ 7 ngày, ngày đầu là hôm nay', () => {
    const plan = planWeek({ tasks: [], capacity: 5, now: NOW })
    expect(plan.days).toHaveLength(PLAN_DAYS)
    expect(plan.days[0].isToday).toBe(true)
    expect(plan.days[0].date).toBe('2026-09-27')
    expect(plan.days[6].date).toBe('2026-10-03')
  })

  it('việc quá hạn lên ngày đầu, quá hạn lâu nhất lên trước', () => {
    const plan = planWeek({ tasks, capacity: 5, now: NOW })
    const today = plan.days[0].items.map((i) => i.taskId)
    expect(today).toEqual([1, 2])
    expect(plan.days[0].items[0].overdue).toBe(true)
    expect(plan.days[0].items[0].daysLate).toBe(3)
  })

  it('việc không quá hạn rơi đúng ngày đến hạn, cùng ngày thì ưu tiên cao hơn trước', () => {
    const plan = planWeek({ tasks, capacity: 5, now: NOW })
    expect(plan.days[1].items).toHaveLength(0)
    expect(plan.days[2].items.map((i) => i.taskId)).toEqual([4, 3])
    expect(plan.days[2].items[0].priorityLabel).toBe('Khẩn cấp')
  })

  it('việc ngoài 7 ngày không bị nhồi vào tuần này, chỉ được đếm', () => {
    const plan = planWeek({ tasks, capacity: 5, now: NOW })
    const allPlanned = plan.days.flatMap((d) => d.items.map((i) => i.taskId))
    expect(allPlanned).not.toContain(5)
    expect(plan.laterCount).toBe(1)
    expect(plan.later[0].taskId).toBe(5)
    expect(plan.summary.openCount).toBe(4)
  })

  it('khi đủ chỗ thì không việc nào bị báo sẽ trễ', () => {
    const plan = planWeek({ tasks, capacity: 5, now: NOW })
    expect(plan.atRisk).toEqual([])
    expect(plan.summary.atRiskCount).toBe(0)
    expect(plan.summary.overloaded).toBe(false)
    expect(plan.summary.seats).toBe(35)
    expect(plan.summary.openCount).toBe(4)
    expect(plan.summary.overdueCount).toBe(2)
  })

  it('không bao giờ vượt quá số việc mỗi ngày, và cảnh báo cả việc bị đẩy sang ngày sau', () => {
    // 25 việc đều đến hạn hôm nay 23:00, mỗi ngày chỉ làm được 3
    const many = Array.from({ length: 25 }, (_, i) => task(i + 1, `Việc ${i + 1}`, dueVn(0, 23)))
    const plan = planWeek({ tasks: many, capacity: 3, now: NOW })
    plan.days.forEach((day) => {
      expect(day.items.length).toBeLessThanOrEqual(3)
      expect(day.load).toBe(day.items.length)
    })
    // 7 ngày × 3 chỗ = 21 việc xếp được, 4 việc không còn chỗ nào trong tuần
    expect(plan.summary.planned).toBe(21)
    expect(plan.atRisk.filter((r) => r.plannedFor === null)).toHaveLength(4)
    // 18 việc còn lại tuy có chỗ nhưng bị đẩy sang ngày sau hạn → phải được nói trước
    expect(plan.atRisk).toHaveLength(22)
    expect(plan.atRisk.filter((r) => r.willBeLateDays > 0)).toHaveLength(22)
    expect(plan.summary.overloaded).toBe(true)
  })

  it('việc xếp được nhưng muộn hơn hạn vẫn bị cảnh báo (không giấu)', () => {
    // 4 việc đều đến hạn trong 2 ngày nhưng mỗi ngày chỉ làm được 1 việc
    const tight = [
      task(1, 'Việc 1', dueVn(0)),
      task(2, 'Việc 2', dueVn(0)),
      task(3, 'Việc 3', dueVn(1)),
      task(4, 'Việc 4', dueVn(1)),
    ]
    const plan = planWeek({ tasks: tight, capacity: 1, now: NOW })
    expect(plan.days[0].items).toHaveLength(1)
    expect(plan.days[1].items).toHaveLength(1)
    // Ngày 0 và 1 mỗi ngày 1 chỗ → 2 việc (hạn ngày 1) bị đẩy sang ngày 2 và 3.
    // Cộng việc quá hạn từ sáng nay bị đẩy sang mai = 3 việc kết thúc muộn hơn hạn.
    const scheduledLate = plan.days.flatMap((d) => d.items).filter((i) => i.willBeLateDays > 0)
    expect(scheduledLate).toHaveLength(3)
    expect(scheduledLate.every((i) => i.willBeLateDays >= 1)).toBe(true)
    // Danh sách cảnh báo chỉ gồm rủi ro MỚI do kế hoạch gây ra (2 việc), không lặp
    // lại việc đã quá hạn từ trước.
    expect(plan.atRisk).toHaveLength(2)
    expect(plan.atRisk.every((r) => r.willBeLateDays >= 1)).toBe(true)
    expect(plan.atRisk.every((r) => r.plannedFor !== null)).toBe(true)
    expect(plan.summary.overloaded).toBe(true)
    // Việc đã quá hạn không lặp lại trong danh sách cảnh báo (đã hiện ở ngày đầu)
    const overdueIds = plan.days[0].items.filter((i) => i.overdue).map((i) => i.taskId)
    expect(overdueIds.length).toBeGreaterThan(0)
    expect(plan.atRisk.map((r) => r.taskId)).not.toContain(overdueIds[0])
  })

  it('việc đầu tiên của mỗi ngày được đánh dấu là việc trọng tâm', () => {
    const plan = planWeek({ tasks, capacity: 5, now: NOW })
    plan.days.forEach((day) => {
      day.items.forEach((item, index) => {
        expect(item.focus).toBe(index === 0)
      })
    })
  })

  it('chưa có việc nào thì kế hoạch trống nhưng vẫn đủ 7 ngày, không lỗi', () => {
    const plan = planWeek({ tasks: [], capacity: DEFAULT_CAPACITY, now: NOW })
    expect(plan.days.every((d) => d.items.length === 0)).toBe(true)
    expect(plan.atRisk).toEqual([])
    expect(plan.summary.openCount).toBe(0)
    expect(plan.summary.seatsLeft).toBe(DEFAULT_CAPACITY * PLAN_DAYS)
  })
})

describe('Kế hoạch tuần — quyền và tham số', () => {
  it('chỉ gói Pro mới xem được kế hoạch', () => {
    expect(() => assertPlannerAllowed('PRO')).not.toThrow()
    expect(() => assertPlannerAllowed('FREE')).toThrow(/Pro/)
    expect(() => assertPlannerAllowed('PLUS')).toThrow(/Pro/)
  })

  it('số việc mỗi ngày hợp lệ được nhận, giá trị lạ bị từ chối', () => {
    expect(parseCapacity(undefined)).toBe(DEFAULT_CAPACITY)
    expect(parseCapacity('')).toBe(DEFAULT_CAPACITY)
    expect(parseCapacity('3')).toBe(3)
    expect(parseCapacity(10)).toBe(10)
    expect(() => parseCapacity(4)).toThrow(/không hợp lệ/)
    expect(() => parseCapacity(0)).toThrow(/không hợp lệ/)
    expect(CAPACITY_OPTIONS).toContain(5)
  })

  it('bảng giá công khai ghi đúng: kế hoạch tuần là tính năng của Pro', () => {
    const plans = planCatalog()
    expect(plans.find((p) => p.id === 'PRO').limits.planner).toBe(true)
    expect(plans.find((p) => p.id === 'FREE').limits.planner).toBe(false)
    expect(plans.find((p) => p.id === 'PLUS').limits.planner).toBe(false)
    expect(plans.find((p) => p.id === 'PRO').features.join(' ')).toMatch(/Kế hoạch tuần/)
  })
})

// ─── Qua API thật ───────────────────────────────────────────

describe('Kế hoạch tuần qua API', () => {
  let free
  let plus
  let pro
  let other

  beforeAll(async () => {
    await startServer()
    free = await newUser('plan_free')
    plus = await newUser('plan_plus', 'PLUS')
    pro = await newUser('plan_pro', 'PRO')
    other = await newUser('plan_other', 'PRO')
  }, 300000)

  afterAll(async () => {
    await stopServer()
  })

  it('chưa đăng nhập → 401', async () => {
    const res = await api('GET', '/planner/week')
    expect(res.status).toBe(401)
  })

  it('gói Miễn phí và gói Plus đều bị chặn kèm chỉ dẫn nâng cấp', async () => {
    const a = await api('GET', '/planner/week', { token: free.token })
    expect(a.status).toBe(400)
    expect(a.data.message).toMatch(/Pro/)

    const b = await api('GET', '/planner/week', { token: plus.token })
    expect(b.status).toBe(400)
    expect(b.data.message).toMatch(/Pro/)
  })

  it('số việc mỗi ngày không hợp lệ → 400', async () => {
    const res = await api('GET', '/planner/week?capacity=4', { token: pro.token })
    expect(res.status).toBe(400)
    expect(res.data.message).toMatch(/không hợp lệ/)
  })

  it('Pro xem được kế hoạch: việc quá hạn nằm ngay ngày đầu, việc đã xong biến mất', async () => {
    const overdue = await createTask(pro.token, {
      title: 'Việc quá hạn cần làm ngay',
      dueAt: new Date(Date.now() + DAY).toISOString(),
      priority: 'URGENT',
    })
    await setDue(overdue, new Date(Date.now() - 2 * DAY))

    const done = await createTask(pro.token, {
      title: 'Việc đã xong rồi',
      dueAt: new Date(Date.now() + DAY).toISOString(),
    })
    await prisma.task.update({
      where: { taskId: done },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    // Việc của người khác — không bao giờ được lẫn vào kế hoạch của mình
    const foreign = await createTask(other.token, {
      title: 'Việc của người khác',
      dueAt: new Date(Date.now() + DAY).toISOString(),
      priority: 'URGENT',
    })
    await setDue(foreign, new Date(Date.now() - 5 * DAY))

    const res = await api('GET', '/planner/week?capacity=5', { token: pro.token })
    expect(res.status).toBe(200)
    const data = res.data.data
    expect(data.days).toHaveLength(PLAN_DAYS)
    expect(data.summary.capacity).toBe(5)

    const titles = data.days.flatMap((d) => d.items.map((i) => i.title))
    expect(titles).toContain('Việc quá hạn cần làm ngay')
    expect(titles).not.toContain('Việc đã xong rồi')
    expect(titles).not.toContain('Việc của người khác')

    const first = data.days[0].items.find((i) => i.title === 'Việc quá hạn cần làm ngay')
    expect(first).toBeTruthy()
    expect(first.overdue).toBe(true)
    expect(first.daysLate).toBe(2)
  })

  it('đổi số việc mỗi ngày là đổi chỗ ngay, không cần lưu cấu hình', async () => {
    for (let i = 0; i < 6; i += 1) {
      await createTask(pro.token, {
        title: `Việc thêm ${i}`,
        dueAt: new Date(Date.now() + 2 * DAY).toISOString(),
        priority: 'MEDIUM',
      })
    }
    const small = await api('GET', '/planner/week?capacity=3', { token: pro.token })
    const big = await api('GET', '/planner/week?capacity=10', { token: pro.token })
    expect(small.data.data.summary.capacity).toBe(3)
    expect(small.data.data.days[0].items.length).toBeLessThanOrEqual(3)
    expect(big.data.data.summary.seats).toBe(10 * PLAN_DAYS)
    expect(big.data.data.summary.seats).toBeGreaterThan(small.data.data.summary.seats)
  })

  it('kế hoạch nói trước khi tuần quá tải (thay vì để khách vỡ kế hoạch)', async () => {
    // Dồn thêm việc để vượt sức chứa của tuần (7 ngày × 3 việc = 21 chỗ)
    await prisma.task.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        userId: pro.userId,
        title: `Việc dồn ${i}`,
        priority: 'MEDIUM',
        dueAt: new Date(Date.now() + DAY),
      })),
    })

    const res = await api('GET', '/planner/week?capacity=3', { token: pro.token })
    expect(res.status).toBe(200)
    const data = res.data.data
    expect(data.summary.openCount).toBeGreaterThan(data.summary.seats)
    expect(data.summary.overloaded).toBe(true)
    expect(data.summary.atRiskCount).toBeGreaterThan(0)
    expect(data.atRisk[0].willBeLateDays).toBeGreaterThan(0)
    expect(data.atRisk[0].title).toBeTruthy()
    // Việc không còn chỗ nào trong tuần được nói rõ là chưa có ngày dự kiến
    expect(data.atRisk.some((r) => r.plannedFor === null)).toBe(true)
  })
})
