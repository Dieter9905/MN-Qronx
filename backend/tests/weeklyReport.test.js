import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, prisma } from './setup.js'
import {
  firstName,
  buildWeeklyEmail,
  collectRecipients,
  sendWeeklyReports,
  WEEKLY_REPORT_MIN_GAP_DAYS,
} from '../src/services/weeklyReportService.js'
import { isSendWindow } from '../src/schedulers/weeklyReportScheduler.js'

// ─── Báo cáo tuần qua email (gói Pro) ───────────────────────
//
// Vì sao phải test kỹ:
//   • Thư gửi cho KHÁCH THẬT, không thu hồi được — nội dung sai (số liệu của người
//     khác, chữ "undefined") là mất mặt ngay trong hộp thư của khách.
//   • Tài khoản Mailjet của MN-Qronx đang bị giới hạn 10 thư/giờ: gặp trần phải
//     DỪNG, không được thử lại liên tục, nếu không mỗi thư bị từ chối là một điểm
//     trừ khi họ xét duyệt tài khoản.
//   • Cron và nhịp /health cùng gọi hàm gửi → phải chứng minh mỗi khách chỉ nhận
//     đúng một thư mỗi tuần.
//
// Mọi test gửi thư đều dùng mailer giả và danh sách người nhận chỉ định: tuyệt đối
// không để test động tới hộp thư của khách thật.

const DAY = 86400_000

async function newUser(prefix, plan = 'FREE') {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'Weekly Report')
  const loginRes = await login(email, 'Test@1234')
  const token = loginRes.data.data.accessToken
  const row = await prisma.user.findUnique({ where: { email }, select: { userId: true } })
  if (plan !== 'FREE') {
    await prisma.user.update({
      where: { userId: row.userId },
      data: { plan, planExpiresAt: new Date(Date.now() + 30 * DAY) },
    })
  }
  return { email, token, userId: row.userId, fullName: 'Weekly Report' }
}

/** Báo cáo + kế hoạch giả để test nội dung thư mà không cần dựng dữ liệu thật. */
function fakeReport({ completed = 12, delta = 4, nagSaved = 0, nagRepeats = 0, overdueOpen = 3 } = {}) {
  return {
    range: { days: 7, from: '2026-09-21', to: '2026-09-27' },
    totals: {
      completed,
      completedPrev: completed - delta,
      completedDelta: delta,
      onTime: Math.round(completed * 0.83),
      late: completed - Math.round(completed * 0.83),
      onTimeRate: 83,
      nagSaved,
      nagRepeats,
      streakCurrent: 5,
      overdueOpen,
    },
  }
}

function fakePlanner({ openCount = 9, seats = 35, atRiskCount = 0, overloaded = false } = {}) {
  return {
    range: { from: '2026-09-28', to: '2026-10-04', days: 7 },
    goldenHour: { hour: 11, count: 6 },
    summary: {
      capacity: 5,
      seats,
      openCount,
      planned: openCount,
      seatsLeft: seats - openCount,
      overdueCount: 3,
      dueTodayCount: 2,
      atRiskCount,
      laterCount: 1,
      overloaded,
    },
    days: [
      {
        date: '2026-09-28',
        isToday: true,
        items: [{ taskId: 1, title: 'Nộp báo cáo thuế', overdue: true, daysLate: 2 }],
      },
      { date: '2026-09-29', isToday: false, items: [{ taskId: 2, title: 'Họp nhóm', overdue: false, daysLate: 0 }] },
    ],
  }
}

// ─── Nội dung thư ───────────────────────────────────────────

describe('Báo cáo tuần — nội dung thư', () => {
  const user = { fullName: 'Nguyễn Văn An', email: 'an@example.com' }

  it('gọi tên khách và nói đúng số của tuần rồi', () => {
    const email = buildWeeklyEmail({ user, report: fakeReport(), planner: fakePlanner() })
    expect(email.subject).toContain('12 việc')
    expect(email.subject).toContain('3 việc đang quá hạn')
    expect(email.text).toContain('Chào An,')
    expect(email.text).toContain('hoàn thành 12 việc')
    expect(email.text).toContain('nhiều hơn tuần trước 4 việc')
    expect(email.text).toContain('đúng hạn: 83%')
    expect(email.html).toContain('An')
  })

  it('tuần kém hơn thì nói thẳng là kém hơn', () => {
    const email = buildWeeklyEmail({ user, report: fakeReport({ completed: 5, delta: -3 }), planner: fakePlanner() })
    expect(email.text).toContain('ít hơn tuần trước 3 việc')
    expect(email.subject).toContain('5 việc')
  })

  it('kể công nhắc dai khi có việc được cứu, và im khi không có', () => {
    const withNag = buildWeeklyEmail({
      user,
      report: fakeReport({ nagSaved: 2, nagRepeats: 9 }),
      planner: fakePlanner(),
    })
    expect(withNag.text).toContain('kéo bạn quay lại 2 việc')
    expect(withNag.text).toContain('kêu lại 9 lần')

    const noNag = buildWeeklyEmail({ user, report: fakeReport(), planner: fakePlanner() })
    expect(noNag.text).not.toContain('Nhắc dai đã kéo')
  })

  it('cảnh báo khi tuần này quá tải, và khen khi vừa sức', () => {
    const heavy = buildWeeklyEmail({
      user,
      report: fakeReport(),
      planner: fakePlanner({ openCount: 33, seats: 21, atRiskCount: 26, overloaded: true }),
    })
    expect(heavy.text).toContain('nhận nhiều hơn sức mình')
    expect(heavy.text).toContain('26 việc sẽ trễ hạn')
    expect(heavy.text).toContain('dời hạn')

    const light = buildWeeklyEmail({ user, report: fakeReport(), planner: fakePlanner() })
    expect(light.text).toContain('vừa sức')
    expect(light.text).not.toContain('nhận nhiều hơn sức mình')
  })

  it('nêu việc nên làm trước để thư có ích cả khi không bấm vào link', () => {
    const email = buildWeeklyEmail({ user, report: fakeReport(), planner: fakePlanner() })
    expect(email.text).toContain('Nộp báo cáo thuế')
    expect(email.text).toContain('quá hạn 2 ngày')
    expect(email.html).toContain('Họp nhóm')
  })

  it('đủ link để quay lại app, và nói rõ cách tắt thư', () => {
    const email = buildWeeklyEmail({ user, report: fakeReport(), planner: fakePlanner() })
    for (const body of [email.text, email.html]) {
      expect(body).toContain('/app/reports')
      expect(body).toContain('/app/planner')
      expect(body).toContain('/app/settings')
    }
    expect(email.text).toContain('Muốn tắt')
    expect(email.html).toContain('gói <b>Pro</b>')
  })

  it('tuần không làm được việc nào vẫn ra thư tử tế, không có chữ undefined', () => {
    const email = buildWeeklyEmail({
      user,
      report: fakeReport({ completed: 0, delta: 0, overdueOpen: 0 }),
      planner: fakePlanner({ openCount: 0, atRiskCount: 0 }),
    })
    expect(email.subject).toContain('chưa có việc nào được đánh dấu xong')
    expect(email.text).toContain('Không có việc nào đang mở')
    expect(email.text).not.toContain('undefined')
    expect(email.html).not.toContain('undefined')
    expect(email.text).not.toContain('NaN')
  })

  it('tên khách thiếu dữ liệu vẫn không làm hỏng thư', () => {
    const email = buildWeeklyEmail({ user: { fullName: '' }, report: fakeReport(), planner: fakePlanner() })
    expect(email.text).toContain('Chào bạn,')
    expect(firstName('Trần Thị Bích Ngọc')).toBe('Ngọc')
    expect(firstName(null)).toBe('bạn')
  })
})

// ─── Ai được nhận thư ───────────────────────────────────────

describe('Báo cáo tuần — ai được nhận thư', () => {
  let pro
  let proOff
  let proRecent
  let plus
  let free
  let expired

  beforeAll(async () => {
    await startServer()
    pro = await newUser('wr_pro', 'PRO')
    proOff = await newUser('wr_pro_off', 'PRO')
    proRecent = await newUser('wr_pro_recent', 'PRO')
    plus = await newUser('wr_plus', 'PLUS')
    free = await newUser('wr_free', 'FREE')
    expired = await newUser('wr_expired', 'PRO')

    await prisma.user.update({
      where: { userId: proOff.userId },
      data: { weeklyReportEnabled: false },
    })
    await prisma.user.update({
      where: { userId: proRecent.userId },
      data: { weeklyReportSentAt: new Date(Date.now() - DAY) },
    })
    await prisma.user.update({
      where: { userId: expired.userId },
      data: { planExpiresAt: new Date(Date.now() - DAY) },
    })
  }, 300000)

  afterAll(async () => {
    await stopServer()
  })

  it('chỉ gói Pro, chưa tắt nhận thư và chưa được gửi trong tuần này', async () => {
    // Lấy rộng ra để không phụ thuộc số khách Pro thật đang có trong hệ thống
    const rows = await collectRecipients({ limit: 500 })
    const emails = rows.map((r) => r.email)

    expect(emails).toContain(pro.email)
    expect(emails).not.toContain(proOff.email) // đã tắt nhận thư
    expect(emails).not.toContain(proRecent.email) // vừa nhận vài hôm trước
    expect(emails).not.toContain(plus.email) // gói Plus không có quyền lợi này
    expect(emails).not.toContain(free.email)
    expect(emails).not.toContain(expired.email) // Pro đã hết hạn
  })

  it('gửi xong thì mốc thời gian được ghi, lần sau không gửi lại', async () => {
    const sent = []
    const mailer = async (msg) => {
      sent.push(msg)
    }
    const now = new Date()

    const first = await sendWeeklyReports({ now, mailer, recipients: [pro] })
    expect(first.sent).toBe(1)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(pro.email)
    expect(sent[0].subject).toBeTruthy()
    expect(sent[0].html).toContain('/app/reports')

    // Mốc đã ghi trong DB → lượt sau không có ai để gửi nữa
    const row = await prisma.user.findUnique({
      where: { userId: pro.userId },
      select: { weeklyReportSentAt: true },
    })
    expect(row.weeklyReportSentAt).toBeTruthy()

    // Gửi lại (kể cả chỉ định đích danh) trong cùng tuần cũng không gửi thêm:
    // luật "mỗi tuần một thư" nằm ở một chỗ, không có đường nào lách được.
    const second = await sendWeeklyReports({ now, mailer, recipients: [pro] })
    expect(second.candidates).toBe(0)
    expect(second.sent).toBe(0)
    expect(sent).toHaveLength(1)

    const collected = await collectRecipients({ now, limit: 500 })
    expect(collected.map((r) => r.email)).not.toContain(pro.email)
    expect(WEEKLY_REPORT_MIN_GAP_DAYS).toBeGreaterThan(0)
  })

  it('chế độ xem thử không gửi thư và không ghi mốc', async () => {
    const fresh = await newUser('wr_dry', 'PRO')
    let called = 0
    const res = await sendWeeklyReports({
      mailer: async () => {
        called += 1
      },
      recipients: [fresh],
      dryRun: true,
    })
    expect(res.sent).toBe(1)
    expect(called).toBe(0)
    const row = await prisma.user.findUnique({
      where: { userId: fresh.userId },
      select: { weeklyReportSentAt: true },
    })
    expect(row.weeklyReportSentAt).toBeNull()
  })
})

// ─── Hạn mức gửi thư: gặp trần là dừng, không thử lại ───────

describe('Báo cáo tuần — ứng xử khi hạn mức gửi thư cạn', () => {
  let a
  let b
  let c

  beforeAll(async () => {
    await startServer()
    a = await newUser('wr_quota_a', 'PRO')
    b = await newUser('wr_quota_b', 'PRO')
    c = await newUser('wr_quota_c', 'PRO')
  }, 300000)

  afterAll(async () => {
    await stopServer()
  })

  it('chạm hạn mức thì dừng cả lượt và báo rõ, không thử người tiếp theo', async () => {
    let attempts = 0
    const mailer = async (msg) => {
      attempts += 1
      if (msg.to === b.email) {
        const err = new Error('Đã dùng hết hạn mức 10 thư/giờ')
        err.code = 'quota-exceeded'
        err.status = 429
        throw err
      }
    }

    const res = await sendWeeklyReports({ mailer, recipients: [a, b, c] })
    expect(res.sent).toBe(1) // gửi được cho người đầu
    expect(res.quotaReached).toBe(true)
    expect(res.skipped).toBe(2) // hai người còn lại để lượt sau
    expect(attempts).toBe(2) // ĐÚNG 2 lần thử: không thử lại, không gọi người thứ ba

    // Người gửi được thì có mốc, người bị chặn thì không (để lượt sau gửi lại)
    const rowB = await prisma.user.findUnique({
      where: { userId: b.userId },
      select: { weeklyReportSentAt: true },
    })
    const rowC = await prisma.user.findUnique({
      where: { userId: c.userId },
      select: { weeklyReportSentAt: true },
    })
    expect(rowB.weeklyReportSentAt).toBeNull()
    expect(rowC.weeklyReportSentAt).toBeNull()
  })

  it('một người lỗi (hộp thư sai…) không làm chết lượt gửi của người khác', async () => {
    const d = await newUser('wr_fail_d', 'PRO')
    const e = await newUser('wr_fail_e', 'PRO')
    const mailer = async (msg) => {
      if (msg.to === d.email) throw new Error('Hộp thư không tồn tại')
    }
    const res = await sendWeeklyReports({ mailer, recipients: [d, e] })
    expect(res.failed).toBe(1)
    expect(res.sent).toBe(1)
    expect(res.quotaReached).toBe(false)

    const rowE = await prisma.user.findUnique({
      where: { userId: e.userId },
      select: { weeklyReportSentAt: true },
    })
    expect(rowE.weeklyReportSentAt).toBeTruthy()
  })
})

// ─── Khung giờ gửi ──────────────────────────────────────────

describe('Báo cáo tuần — chỉ gửi đúng khung giờ', () => {
  it('gửi sáng thứ 2, không gửi giữa tuần hay ban đêm', () => {
    // 2026-09-28 là Thứ 2. 07:00 VN = 00:00 UTC
    expect(isSendWindow(new Date('2026-09-28T00:00:00Z'))).toBe(true) // 07:00 VN thứ 2
    expect(isSendWindow(new Date('2026-09-28T02:00:00Z'))).toBe(true) // 09:00 VN thứ 2
    expect(isSendWindow(new Date('2026-09-28T03:00:00Z'))).toBe(false) // 10:00 VN — hết khung
    expect(isSendWindow(new Date('2026-09-27T23:00:00Z'))).toBe(false) // 06:00 VN thứ 2 — quá sớm
    expect(isSendWindow(new Date('2026-09-30T02:00:00Z'))).toBe(false) // 09:00 VN thứ 4
    expect(isSendWindow(new Date('2026-09-28T20:00:00Z'))).toBe(false) // 03:00 VN thứ 3
  })
})

// ─── Khách tự tắt nhận thư ──────────────────────────────────

describe('Báo cáo tuần — khách tự tắt/mở', () => {
  let token
  let userId

  beforeAll(async () => {
    await startServer()
    const user = await newUser('wr_toggle', 'PRO')
    token = user.token
    userId = user.userId
  }, 300000)

  afterAll(async () => {
    await stopServer()
  })

  it('chưa đăng nhập thì không đổi được', async () => {
    const res = await api('PUT', '/me/weekly-report', { body: { enabled: false } })
    expect(res.status).toBe(401)
  })

  it('giá trị không phải true/false bị từ chối', async () => {
    const res = await api('PUT', '/me/weekly-report', { token, body: { enabled: 'yes' } })
    expect(res.status).toBe(400)
    expect(res.data.message).toMatch(/không hợp lệ/)
  })

  it('mặc định là bật, tắt được, và hồ sơ trả về đúng trạng thái', async () => {
    const before = await api('GET', '/me', { token })
    expect(before.status).toBe(200)
    expect(before.data.data.weeklyReportEnabled).toBe(true)

    const off = await api('PUT', '/me/weekly-report', { token, body: { enabled: false } })
    expect(off.status).toBe(200)
    expect(off.data.data.weeklyReportEnabled).toBe(false)

    const afterOff = await api('GET', '/me', { token })
    expect(afterOff.data.data.weeklyReportEnabled).toBe(false)

    // Tắt rồi thì không còn nằm trong danh sách nhận thư
    const rows = await collectRecipients({ limit: 500 })
    expect(rows.map((r) => r.userId)).not.toContain(userId)

    const on = await api('PUT', '/me/weekly-report', { token, body: { enabled: true } })
    expect(on.status).toBe(200)
    expect(on.data.data.weeklyReportEnabled).toBe(true)
  })
})

// ─── Nút "Gửi thử báo cáo tuần" ─────────────────────────────
//
// Thư tuần chỉ đi mỗi thứ 2, nên đường gửi thử là cách DUY NHẤT để khách (và chủ app)
// xem trước nội dung thư đang gửi cho toàn bộ khách trả tiền. Hai điều phải đúng:
// bấm thử KHÔNG được làm mất thư thật của tuần đó, và không được để một người bấm
// liên tục chiếm hết hạn mức 10 thư/ngày dành cho mọi khách.

describe('Báo cáo tuần — gửi thử cho chính mình', () => {
  beforeAll(async () => {
    await startServer()
  })

  afterAll(async () => {
    await stopServer()
  })

  it('gói Free bị chặn kèm chỉ dẫn nâng cấp Pro', async () => {
    const u = await newUser('weekly_test_free', 'FREE')
    const res = await api('POST', '/me/weekly-report/test', { token: u.token })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('Pro')
  })

  it('gói Pro: gửi đúng tới email của mình, có nội dung thư thật', async () => {
    const u = await newUser('weekly_test_pro', 'PRO')

    // Không gửi thư thật: tiêm mailer giả qua tầng dịch vụ
    const { sendTestWeeklyReport } = await import('../src/services/weeklyReportService.js')
    const sent = []
    const result = await sendTestWeeklyReport(u.userId, {
      mailer: async (opts) => {
        sent.push(opts)
        return { sent: true }
      },
    })

    expect(result.sent).toBe(true)
    expect(result.email).toBe(u.email)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(u.email)
    expect(sent[0].subject).toBeTruthy()
    // Nội dung là thư thật của chính người này, không phải mẫu rỗng
    expect(sent[0].text).toContain('Đây là báo cáo tuần MN-Qronx')
    expect(sent[0].text).toContain('TUẦN NÀY')
    expect(sent[0].text).not.toContain('undefined')
    expect(result.preview).toContain('TUẦN NÀY')
  })

  it('gửi thử KHÔNG làm mất thư thật của tuần đó', async () => {
    const u = await newUser('weekly_test_keep', 'PRO')
    const { sendTestWeeklyReport } = await import('../src/services/weeklyReportService.js')

    await sendTestWeeklyReport(u.userId, { mailer: async () => ({ sent: true }) })

    // Mốc "đã gửi tuần này" phải còn TRỐNG, nếu không thì bấm thử một lần là mất
    // luôn thư thật — đúng thứ khách trả tiền để nhận.
    const row = await prisma.user.findUnique({
      where: { userId: u.userId },
      select: { weeklyReportSentAt: true, weeklyReportTestAt: true },
    })
    expect(row.weeklyReportSentAt).toBeNull()
    expect(row.weeklyReportTestAt).not.toBeNull()

    // Và người này vẫn nằm trong danh sách nhận thư thật
    const recipients = await collectRecipients({ userIds: [u.userId] })
    expect(recipients.map((r) => r.userId)).toContain(u.userId)
  })

  it('bấm liên tục bị chặn — hạn mức gửi thư là của chung mọi khách', async () => {
    const u = await newUser('weekly_test_spam', 'PRO')
    const { sendTestWeeklyReport } = await import('../src/services/weeklyReportService.js')
    const mailer = async () => ({ sent: true })

    await sendTestWeeklyReport(u.userId, { mailer })

    const second = await api('POST', '/me/weekly-report/test', { token: u.token })
    expect(second.status).toBe(400)
    expect(second.data.message).toContain('vừa gửi thử')

    // Chờ đủ lâu thì gửi lại được
    const later = await sendTestWeeklyReport(u.userId, {
      mailer,
      now: new Date(Date.now() + 11 * 60_000),
    })
    expect(later.sent).toBe(true)
  })

  it('máy chủ không gửi được vẫn trả bản xem trước, không ném lỗi trắng màn hình', async () => {
    const u = await newUser('weekly_test_fail', 'PRO')
    const { sendTestWeeklyReport } = await import('../src/services/weeklyReportService.js')

    const result = await sendTestWeeklyReport(u.userId, {
      mailer: async () => {
        throw new Error('Mailjet API lỗi')
      },
    })
    expect(result.sent).toBe(false)
    expect(result.reason).toContain('Mailjet')
    // Vẫn có nội dung để khách đọc
    expect(result.preview).toContain('Đây là báo cáo tuần MN-Qronx')
  })
})
