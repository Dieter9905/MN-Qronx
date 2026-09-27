import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, prisma } from './setup.js'
import {
  REPORT_DAYS,
  REPORT_EXPORT_ROW_LIMIT,
  parseReportDays,
  assertReportsAllowed,
} from '../src/services/reportService.js'
import { planCatalog } from '../src/utils/planLimits.js'

// ─── Báo cáo năng suất (gói Pro) ────────────────────────────
//
// Vì sao phải có test cho phần này: báo cáo là thứ khách TRẢ TIỀN để xem, nên
// một con số sai (tính cả việc trong thùng rác, tính sai ngày do lệch múi giờ,
// hay để gói Free xem được) là mất lòng tin ngay. Các test dưới đây khoá lại:
//   • quyền theo gói (Free/Plus bị chặn, kể cả đường xuất file)
//   • số liệu đếm đúng (đúng hạn / muộn / nhắc dai / tồn đọng / chuỗi ngày)
//   • chỉ thấy dữ liệu của chính mình
//   • file CSV mở được bằng Excel bản Việt (BOM + dấu ";")

const DAY = 86400_000

async function newUser(prefix, plan = 'FREE') {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'Report Test')
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

/** Tạo việc qua API thật (đúng đường người dùng đi). */
async function createTask(token, body) {
  const res = await api('POST', '/tasks', { token, body })
  expect(res.status).toBe(201)
  return res.data.data.id
}

/**
 * Đặt lại hạn và thời điểm hoàn thành của một việc.
 *
 * Phải sửa trực tiếp trong DB: API luôn lấy giờ hiện tại làm completedAt và
 * KHÔNG cho tạo việc với hạn trong quá khứ (đúng nghiệp vụ), nên muốn kiểm tra
 * "xong đúng hạn / xong muộn / tồn đọng lâu" thì phải dựng dữ liệu quá khứ.
 * Chỉ đụng tới đúng taskId vừa tạo trong test.
 */
async function setTask(taskId, { status, completedAt = null, dueAt = null }) {
  await prisma.task.update({
    where: { taskId },
    data: { status, completedAt, ...(dueAt ? { dueAt } : {}) },
  })
}

// ─── Luật thuần: quyền và tham số ───────────────────────────

describe('Báo cáo — quyền theo gói và tham số', () => {
  it('chỉ gói Pro mới xem được báo cáo', () => {
    expect(() => assertReportsAllowed('PRO')).not.toThrow()
    expect(() => assertReportsAllowed('FREE')).toThrow(/Pro/)
    expect(() => assertReportsAllowed('PLUS')).toThrow(/Pro/)
  })

  it('khoảng thời gian hợp lệ được nhận, giá trị lạ bị từ chối', () => {
    expect(parseReportDays(undefined)).toBe(30)
    expect(parseReportDays('')).toBe(30)
    expect(parseReportDays('7')).toBe(7)
    expect(parseReportDays(90)).toBe(90)
    expect(() => parseReportDays(5)).toThrow(/không hợp lệ/)
    expect(() => parseReportDays('abc')).toThrow(/không hợp lệ/)
    expect(REPORT_DAYS).toEqual([7, 30, 90])
  })

  it('bảng giá công khai nói đúng sự thật về báo cáo', () => {
    const plans = planCatalog()
    const pro = plans.find((p) => p.id === 'PRO')
    const free = plans.find((p) => p.id === 'FREE')
    const plus = plans.find((p) => p.id === 'PLUS')

    expect(pro.limits.reports).toBe(true)
    expect(free.limits.reports).toBe(false)
    expect(plus.limits.reports).toBe(false)

    // Báo cáo nay là tính năng ĐANG CÓ của Pro → không được nằm trong "Sắp có"
    expect(pro.features.join(' ')).toMatch(/Báo cáo/)
    expect(pro.upcoming.join(' ')).not.toMatch(/Báo cáo/)
  })
})

// ─── Qua API thật: chặn gói chưa trả tiền ───────────────────

describe('Báo cáo qua API — chặn theo gói', () => {
  let free
  let plus
  let pro

  beforeAll(async () => {
    await startServer()
    free = await newUser('report_free')
    plus = await newUser('report_plus', 'PLUS')
    pro = await newUser('report_pro', 'PRO')
  }, 300000)

  afterAll(async () => {
    await stopServer()
  })

  it('gói Miễn phí xem báo cáo → 400 kèm chỉ dẫn nâng cấp', async () => {
    const res = await api('GET', '/reports', { token: free.token })
    expect(res.status).toBe(400)
    expect(res.data.message).toMatch(/Pro/)
  })

  it('gói Plus cũng chưa có báo cáo — đây là khác biệt của Pro', async () => {
    const res = await api('GET', '/reports?days=7', { token: plus.token })
    expect(res.status).toBe(400)
    expect(res.data.message).toMatch(/Pro/)
  })

  it('gói Miễn phí không lách được bằng đường xuất file', async () => {
    const res = await api('GET', '/reports/export?days=30', { token: free.token })
    expect(res.status).toBe(400)
    expect(res.data.message).toMatch(/Pro/)
  })

  it('chưa đăng nhập → 401', async () => {
    const res = await api('GET', '/reports')
    expect(res.status).toBe(401)
  })

  it('khoảng thời gian lạ → 400 (không âm thầm trả số của khoảng khác)', async () => {
    const res = await api('GET', '/reports?days=13', { token: pro.token })
    expect(res.status).toBe(400)
    expect(res.data.message).toMatch(/không hợp lệ/)
  })

  it('người mới chưa có việc nào vẫn nhận báo cáo rỗng, không lỗi', async () => {
    const res = await api('GET', '/reports', { token: pro.token })
    expect(res.status).toBe(200)
    expect(res.data.data.totals.completed).toBe(0)
    expect(res.data.data.daily).toHaveLength(30)
    expect(res.data.data.insight).toMatch(/Chưa có việc nào/)
  })
})

// ─── Số liệu thật: dựng quá khứ rồi đối chiếu ───────────────

describe('Báo cáo — số liệu đếm đúng', () => {
  let pro
  let other
  let report
  let categoryId
  const now = new Date()
  const titles = {
    onTime: 'Việc xong trước hạn',
    late: 'Việc xong muộn',
    overdue: 'Việc bị bỏ quên lâu nhất',
    nagged: 'Việc nhờ nhắc dai mới xong',
    today: 'Việc xong trong hôm nay',
    old: 'Việc xong từ lâu',
  }

  beforeAll(async () => {
    await startServer()
    pro = await newUser('report_data', 'PRO')
    other = await newUser('report_other', 'PRO')

    const cat = await api('POST', '/categories', {
      token: pro.token,
      body: { categoryName: 'Công việc', colorCode: '#3b82f6' },
    })
    expect(cat.status).toBe(201)
    categoryId = cat.data.data.id

    // 1. Xong TRƯỚC hạn 1 ngày (hôm qua) → tính là đúng hạn
    const t1 = await createTask(pro.token, {
      title: titles.onTime,
      dueAt: new Date(now.getTime() + DAY).toISOString(),
      priority: 'URGENT',
      categoryId,
    })
    await setTask(t1, { status: 'COMPLETED', dueAt: new Date(now.getTime() + 2 * DAY), completedAt: new Date(now.getTime() - DAY) })

    // 2. Xong MUỘN 2 ngày → vẫn là xong, nhưng không tính đúng hạn
    const t2 = await createTask(pro.token, {
      title: titles.late,
      dueAt: new Date(now.getTime() + DAY).toISOString(),
      priority: 'HIGH',
      categoryId,
    })
    await setTask(t2, { status: 'COMPLETED', dueAt: new Date(now.getTime() - 4 * DAY), completedAt: new Date(now.getTime() - 2 * DAY) })

    // 3. Việc vẫn đang mở và quá hạn 10 ngày → phải hiện trong "tồn đọng lâu nhất"
    const t3 = await createTask(pro.token, {
      title: titles.overdue,
      dueAt: new Date(now.getTime() + DAY).toISOString(),
      priority: 'HIGH',
    })
    await setTask(t3, { status: 'TODO', dueAt: new Date(now.getTime() - 10 * DAY) })

    // 4. Xong cách đây 3 ngày, MUỘN 2 giờ, nhưng trước đó đã bị nhắc dai 4 lần
    //    → tính vào "nhắc dai cứu được", vẫn bị tính là xong muộn
    const t4 = await createTask(pro.token, {
      title: titles.nagged,
      dueAt: new Date(now.getTime() + DAY).toISOString(),
      nagEveryMinutes: 5,
    })
    await setTask(t4, {
      status: 'COMPLETED',
      dueAt: new Date(now.getTime() - 3 * DAY - 2 * 3600_000),
      completedAt: new Date(now.getTime() - 3 * DAY),
    })
    await prisma.reminder.create({
      data: { taskId: t4, remindAt: new Date(now.getTime() - 3 * DAY), status: 'CANCELLED', nagCount: 4 },
    })

    // 5. Xong cách đây 20 ngày: ngoài khoảng 7 ngày, trong khoảng 30 ngày
    const t5 = await createTask(pro.token, {
      title: titles.old,
      dueAt: new Date(now.getTime() + DAY).toISOString(),
    })
    await setTask(t5, { status: 'COMPLETED', dueAt: new Date(now.getTime() - 22 * DAY), completedAt: new Date(now.getTime() - 20 * DAY) })

    // 6. Xong HÔM NAY, trước hạn 1 ngày → giữ chuỗi ngày không bị đứt
    const t6 = await createTask(pro.token, {
      title: titles.today,
      dueAt: new Date(now.getTime() + DAY).toISOString(),
    })
    await setTask(t6, { status: 'COMPLETED', dueAt: new Date(now.getTime() + DAY), completedAt: now })

    // Việc của NGƯỜI KHÁC — không được lẫn vào báo cáo của pro
    const foreign = await createTask(other.token, {
      title: 'Việc của người khác',
      dueAt: new Date(now.getTime() + DAY).toISOString(),
    })
    await setTask(foreign, { status: 'COMPLETED', dueAt: new Date(now.getTime() + DAY), completedAt: new Date(now.getTime() - DAY) })

    const res = await api('GET', '/reports?days=7', { token: pro.token })
    expect(res.status).toBe(200)
    report = res.data.data
  }, 300000)

  afterAll(async () => {
    await stopServer()
  })

  it('đếm đúng việc đã xong và bỏ qua việc ngoài khoảng thời gian', () => {
    // Trong 7 ngày: xong trước hạn, xong muộn, nhờ nhắc dai, và việc xong hôm nay
    expect(report.totals.completed).toBe(4)
    expect(report.range.days).toBe(7)
    // Việc xong cách đây 20 ngày không được tính vào kỳ 7 ngày
    expect(report.daily.reduce((sum, d) => sum + d.completed, 0)).toBe(4)
    expect(report.daily).toHaveLength(7)
  })

  it('tách được xong đúng hạn và xong muộn', () => {
    // t1 và t6 xong trước hạn; t2 xong muộn 2 ngày; t4 (nhắc dai) muộn 2 giờ
    expect(report.totals.onTime).toBe(2)
    expect(report.totals.late).toBe(2)
    expect(report.totals.onTimeRate).toBe(50)
    // Trung bình xong trước hạn: (72 + 24 − 48 − 2) / 4 = 11,5 giờ
    expect(report.totals.avgHoursBeforeDue).toBeCloseTo(11.5, 1)
  })

  it('đếm việc đang mở, quá hạn và chỉ ra việc bị bỏ quên lâu nhất', () => {
    expect(report.totals.openNow).toBe(1)
    expect(report.totals.overdueOpen).toBe(1)
    expect(report.worstOverdue).toHaveLength(1)
    expect(report.worstOverdue[0].title).toBe(titles.overdue)
    expect(report.worstOverdue[0].daysLate).toBe(10)
    expect(report.worstOverdue[0].priority).toBe('HIGH')
  })

  it('nhắc dai được kể công: bao nhiêu việc được cứu, kêu lại bao nhiêu lần', () => {
    expect(report.totals.nagSaved).toBe(1)
    expect(report.totals.nagRepeats).toBe(4)
  })

  it('đếm theo danh mục và theo mức ưu tiên', () => {
    const cat = report.categories.find((c) => c.categoryId === categoryId)
    expect(cat).toBeTruthy()
    expect(cat.name).toBe('Công việc')
    expect(cat.completed).toBe(2)
    expect(report.priorities.find((p) => p.priority === 'URGENT').completed).toBe(1)
    expect(report.priorities.find((p) => p.priority === 'HIGH').completed).toBe(1)
  })

  it('chuỗi ngày có việc xong tính theo ngày Việt Nam', () => {
    // Xong hôm nay, hôm qua, 2 ngày trước và 3 ngày trước → chuỗi 4 ngày
    expect(report.totals.streakCurrent).toBe(4)
    expect(report.totals.streakBest).toBe(4)
    // Hôm nay (ô cuối cùng của biểu đồ) có đúng 1 việc được đánh dấu xong
    expect(report.daily[report.daily.length - 1].completed).toBe(1)
  })

  it('giờ vàng khớp với biểu đồ theo giờ', () => {
    expect(report.hours).toHaveLength(24)
    expect(report.totals.goldenHour).not.toBeNull()
    expect(report.hours[report.totals.goldenHour].completed).toBe(report.totals.goldenCount)
    // Cả 4 việc được đánh dấu xong cùng một giờ trong ngày (cách nhau đúng 24 giờ)
    expect(report.totals.goldenCount).toBe(4)
  })

  it('câu nhận xét nói được điều cụ thể, không phải câu chung chung', () => {
    expect(report.insight).toMatch(/hoàn thành 4 việc/)
    expect(report.insight).toMatch(/Nhắc dai/)
    expect(report.insight).toMatch(titles.overdue)
  })

  it('kỳ 30 ngày bao gồm cả việc xong cách đây 20 ngày', async () => {
    const res = await api('GET', '/reports?days=30', { token: pro.token })
    expect(res.status).toBe(200)
    expect(res.data.data.totals.completed).toBe(5)
    expect(res.data.data.daily).toHaveLength(30)
  })

  it('chỉ thấy dữ liệu của chính mình', async () => {
    const res = await api('GET', '/reports?days=30', { token: other.token })
    expect(res.status).toBe(200)
    expect(res.data.data.totals.completed).toBe(1)
    expect(res.data.data.worstOverdue).toHaveLength(0)
    const allTitles = [
      ...res.data.data.worstOverdue.map((w) => w.title),
      ...res.data.data.categories.map((c) => c.name),
    ]
    expect(allTitles).not.toContain(titles.overdue)
  })

  it('xuất Excel: đúng định dạng cho Excel bản Việt và đủ dữ liệu', async () => {
    const res = await api('GET', '/reports/export?days=7', { token: pro.token })
    expect(res.status).toBe(200)

    const { filename, content, rows, truncated } = res.data.data
    expect(filename).toMatch(/^bao-cao-mn-qronx-\d{8}-\d{8}\.csv$/)
    // BOM giữ dấu tiếng Việt, "sep=;" để Excel bản Việt không dồn vào một cột
    expect(content.startsWith('\uFEFFsep=;')).toBe(true)
    expect(content).toContain('Tổng quan')
    expect(content).toContain('Công việc')
    expect(content).toContain(titles.onTime)
    expect(content).toContain(titles.nagged)
    // Việc ngoài khoảng 7 ngày không được xuất ra
    expect(content).not.toContain(titles.old)
    expect(rows).toBe(4)
    expect(truncated).toBe(false)
    expect(truncated === true || rows < REPORT_EXPORT_ROW_LIMIT).toBe(true)
  })

  it('xuất Excel cũng bị chặn với người chưa trả tiền', async () => {
    const freeUser = await newUser('report_export_free')
    const res = await api('GET', '/reports/export', { token: freeUser.token })
    expect(res.status).toBe(400)
    expect(res.data.message).toMatch(/Pro/)
  })
})
