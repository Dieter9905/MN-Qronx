import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import {
  startServer,
  stopServer,
  api,
  register,
  login,
  cleanup,
  prisma,
} from './setup.js'
import * as billingService from '../src/services/billingService.js'
import * as bankApiService from '../src/services/bankApiService.js'
import * as vietQrService from '../src/services/vietQrService.js'
import * as aiQuotaService from '../src/services/aiQuotaService.js'
import { PLANS } from '../src/utils/planLimits.js'

// ─── Tiện ích ───────────────────────────────────────────────

async function newUser(prefix) {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'Billing Test')
  const loginRes = await login(email, 'Test@1234')
  const token = loginRes.data.data.accessToken
  const row = await prisma.user.findUnique({ where: { email }, select: { userId: true } })
  return { email, token, userId: row.userId }
}

let buyer
let other
let triallist
let aiUser
let adminToken
// Cấu hình nhận tiền của môi trường thật (nếu đã có) — test sẽ xoá/đổi tạm và
// phải trả lại đúng như cũ khi xong, để không làm mất cấu hình đang chạy.
let savedBillingSettings = null

beforeAll(async () => {
  await startServer()
  savedBillingSettings = await prisma.billingSetting.findUnique({ where: { settingId: 1 } })

  buyer = await newUser('bill_buyer')
  other = await newUser('bill_other')
  triallist = await newUser('bill_trial')
  aiUser = await newUser('bill_ai')

  // Tài khoản admin để thử đường xác nhận đơn
  const adminRow = await newUser('bill_admin')
  const adminRole = await prisma.role.findUnique({ where: { roleName: 'ADMIN' } })
  await prisma.user.update({
    where: { userId: adminRow.userId },
    data: { roleId: adminRole.roleId },
  })
  const adminLogin = await login(adminRow.email, 'Test@1234')
  adminToken = adminLogin.data.data.accessToken
  // Tạo 5 tài khoản qua API (mỗi lần đăng ký còn thử gửi email thật) nên hook
  // này cần nhiều thời gian hơn mức 10 giây mặc định.
}, 300000)

afterAll(async () => {
  await prisma.billingEvent.deleteMany({
    where: {
      OR: [
        { externalId: { startsWith: 'test-' } },
        // Sự kiện do bộ đồng bộ API tạo ra (id giả lập theo từng lần chạy)
        { externalId: { startsWith: 'sepay:' } },
        { externalId: { startsWith: 'acb:' } },
      ],
    },
  })
  await prisma.billingSetting.deleteMany({ where: { settingId: 1 } })
  if (savedBillingSettings) {
    const { settingId, ...rest } = savedBillingSettings
    await prisma.billingSetting.create({ data: { settingId: 1, ...rest } })
  }
  billingService.clearBillingSettingsCache()
  await cleanup()
  await stopServer()
})

// ─── Bảng giá ───────────────────────────────────────────────

describe('GET /billing/products', () => {
  it('trả bảng giá và giới hạn của cả ba gói mà không cần đăng nhập', async () => {
    const res = await api('GET', '/billing/products')
    expect(res.status).toBe(200)

    const { plans, cycles, productIds } = res.data.data
    expect(plans.map((p) => p.id)).toEqual(['FREE', 'PLUS', 'PRO'])
    expect(plans[0].priceMonthly).toBe(0)
    expect(plans[1].priceMonthly).toBe(39000)
    expect(plans[2].priceMonthly).toBe(79000)
    // Trả theo năm = 10 tháng (tặng 2 tháng)
    expect(plans[1].priceYearly).toBe(390000)
    expect(cycles.find((c) => c.id === 'YEARLY').days).toBe(365)
    expect(productIds['PRO:MONTHLY']).toBe('mnq_pro_monthly')
  })

  it('gói Free phải cho công việc lặp lại, nếu không người dùng bỏ app', async () => {
    const res = await api('GET', '/billing/products')
    const free = res.data.data.plans.find((p) => p.id === 'FREE')
    expect(free.limits.repeatTasks).toBe(true)
    expect(free.limits.aiDailyLimit).toBe(5)
  })
})

// ─── Tạo đơn ────────────────────────────────────────────────

describe('POST /billing/orders', () => {
  it('tạo đơn Plus tháng kèm nội dung chuyển khoản là mã đơn', async () => {
    const res = await api('POST', '/billing/orders', {
      token: buyer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    expect(res.status).toBe(201)

    const { order, payment } = res.data.data
    expect(order.orderCode).toMatch(/^MNQ[A-Z0-9]{8}$/)
    expect(order.amount).toBe(39000)
    expect(order.status).toBe('PENDING')
    expect(order.plan).toBe('PLUS')
    // Webhook khớp lệnh bằng nội dung chuyển khoản → phải trùng mã đơn
    expect(payment.transferContent).toBe(order.orderCode)
    expect(billingService.findOrderCode(`CK ${order.orderCode} MNQ`)).toBe(order.orderCode)
  })

  it('dùng lại đơn đang chờ thay vì tạo đơn trùng', async () => {
    const first = await api('POST', '/billing/orders', {
      token: buyer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    const second = await api('POST', '/billing/orders', {
      token: buyer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    expect(second.status).toBe(201)
    expect(second.data.data.reused).toBe(true)
    expect(second.data.data.order.orderCode).toBe(first.data.data.order.orderCode)
  })

  it('từ chối gói FREE và kỳ thanh toán lạ', async () => {
    const freePlan = await api('POST', '/billing/orders', {
      token: buyer.token,
      body: { plan: 'FREE' },
    })
    expect(freePlan.status).toBe(400)

    const badCycle = await api('POST', '/billing/orders', {
      token: buyer.token,
      body: { plan: 'PRO', cycle: 'WEEKLY' },
    })
    expect(badCycle.status).toBe(400)
  })

  it('chặn xem đơn của người khác', async () => {
    const created = await api('POST', '/billing/orders', {
      token: buyer.token,
      body: { plan: 'PRO', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode

    const stolen = await api('GET', `/billing/orders/${code}`, { token: other.token })
    expect(stolen.status).toBe(403)

    const mineNow = await api('GET', `/billing/orders/${code}`, { token: buyer.token })
    expect(mineNow.status).toBe(200)
    expect(mineNow.data.data.order.status).toBe('PENDING')
  })

  it('từ chối mã đơn sai định dạng', async () => {
    const res = await api('GET', '/billing/orders/ABC123', { token: buyer.token })
    expect(res.status).toBe(400)
  })
})

// ─── Dùng thử ───────────────────────────────────────────────

describe('POST /billing/trial', () => {
  it('bật Pro 7 ngày đúng một lần cho mỗi tài khoản', async () => {
    const before = await api('GET', '/billing/me', { token: triallist.token })
    expect(before.data.data.plan).toBe('FREE')
    expect(before.data.data.trial.eligible).toBe(true)

    const res = await api('POST', '/billing/trial', { token: triallist.token })
    expect(res.status).toBe(200)
    expect(res.data.data.trialDays).toBe(7)
    expect(res.data.data.user.plan).toBe('PRO')

    const after = await api('GET', '/billing/me', { token: triallist.token })
    expect(after.data.data.plan).toBe('PRO')
    expect(after.data.data.daysLeft).toBeGreaterThanOrEqual(6)
    expect(after.data.data.daysLeft).toBeLessThanOrEqual(7)
    expect(after.data.data.trial.eligible).toBe(false)
    expect(after.data.data.subscription.provider).toBe('TRIAL')

    const again = await api('POST', '/billing/trial', { token: triallist.token })
    expect(again.status).toBe(400)
    expect(again.data.message).toMatch(/dùng thử/i)
  })
})

// ─── Admin xác nhận đơn ─────────────────────────────────────

describe('Admin xác nhận thanh toán', () => {
  it('xác nhận đơn → kích hoạt gói; bấm lại không cộng thêm ngày', async () => {
    const created = await api('POST', '/billing/orders', {
      token: buyer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode

    const forbidden = await api('POST', `/admin/orders/${code}/confirm`, {
      token: buyer.token,
      body: {},
    })
    expect(forbidden.status).toBe(403)

    const confirmed = await api('POST', `/admin/orders/${code}/confirm`, {
      token: adminToken,
      body: { provider: 'VIETQR', providerRef: 'FT20260926001' },
    })
    expect(confirmed.status).toBe(200)
    expect(confirmed.data.data.applied).toBe(true)
    expect(confirmed.data.data.user.plan).toBe('PLUS')

    const me = await api('GET', '/billing/me', { token: buyer.token })
    expect(me.data.data.plan).toBe('PLUS')
    expect(me.data.data.daysLeft).toBeGreaterThanOrEqual(29)
    // Đơn vừa xác nhận nằm trong lịch sử và đã chuyển PAID (danh sách xếp mới
    // nhất trước, nên tìm theo mã đơn chứ không lấy phần tử đầu)
    const paidOrder = me.data.data.orders.find((o) => o.orderCode === code)
    expect(paidOrder.status).toBe('PAID')
    expect(paidOrder.paidAt).toBeTruthy()

    // Bấm lại (hoặc webhook gửi lại) không được cộng thêm 30 ngày
    const again = await api('POST', `/admin/orders/${code}/confirm`, {
      token: adminToken,
      body: {},
    })
    expect(again.status).toBe(200)
    expect(again.data.data.applied).toBe(false)

    const after = await api('GET', '/billing/me', { token: buyer.token })
    expect(after.data.data.daysLeft).toBeLessThanOrEqual(30)

    // Có dòng lịch sử quyền lợi để tra cứu về sau
    const subs = await prisma.subscription.findMany({ where: { userId: buyer.userId } })
    expect(subs.length).toBe(1)
    expect(subs[0].provider).toBe('VIETQR')
    expect(subs[0].status).toBe('ACTIVE')
  })

  it('danh sách đơn của admin lọc được theo mã đơn', async () => {
    const created = await api('POST', '/billing/orders', {
      token: other.token,
      body: { plan: 'PRO', cycle: 'YEARLY' },
    })
    const code = created.data.data.order.orderCode
    expect(created.data.data.order.amount).toBe(790000)

    const list = await api('GET', `/admin/orders?keyword=${code}`, { token: adminToken })
    expect(list.status).toBe(200)
    expect(list.data.data.total).toBe(1)
    expect(list.data.data.items[0].user.email).toBe(other.email)

    const pending = await api('GET', '/admin/orders?status=PENDING', { token: adminToken })
    expect(pending.status).toBe(200)
    expect(pending.data.data.items.every((o) => o.status === 'PENDING')).toBe(true)
  })

  it('huỷ đơn chưa thanh toán rồi thì không xác nhận được nữa', async () => {
    const created = await api('POST', '/billing/orders', {
      token: other.token,
      body: { plan: 'PLUS', cycle: 'YEARLY' },
    })
    const code = created.data.data.order.orderCode

    const cancelled = await api('POST', `/admin/orders/${code}/cancel`, { token: adminToken })
    expect(cancelled.status).toBe(200)
    expect(cancelled.data.data.status).toBe('CANCELLED')

    const confirm = await api('POST', `/admin/orders/${code}/confirm`, {
      token: adminToken,
      body: {},
    })
    expect(confirm.status).toBe(400)
  })
})

// ─── Webhook ngân hàng ──────────────────────────────────────

describe('Webhook ngân hàng', () => {
  it('từ chối khi chưa có mã xác thực webhook (không để ai tự kích hoạt gói)', async () => {
    // Đúng cảnh production: đã khai tài khoản nhận tiền nhưng chưa sinh mã xác thực.
    // Phải là 401 chứ không phải 500 — 500 khiến SePay tưởng lỗi tạm thời và gửi lại mãi.
    await prisma.billingSetting.deleteMany({ where: { settingId: 1 } })
    await prisma.billingSetting.create({
      data: {
        settingId: 1,
        bankId: '970416',
        bankAccount: '38037797',
        bankAccountName: 'TO VAN MINH NHAT',
      },
    })
    billingService.clearBillingSettingsCache()

    const res = await api('POST', '/billing/webhook/bank', {
      body: { data: [{ id: 1, description: 'MNQAAAA2222', amount: 39000 }] },
    })
    // Chưa có mã xác thực → đóng cửa, không xử lý gì
    expect(res.status).toBe(401)
    expect(res.data.message).toMatch(/mã xác thực webhook/i)
  })

  it('đọc được giao dịch từ payload Casso và Sepay', () => {
    const casso = billingService.extractTransactions({
      data: [{ id: 99, description: 'MNQABCD2345 chuyen tien', amount: 39000 }],
    })
    expect(casso).toHaveLength(1)
    expect(casso[0].externalId).toBe(99)
    expect(casso[0].amount).toBe(39000)
    expect(billingService.findOrderCode(casso[0].content)).toBe('MNQABCD2345')

    const sepay = billingService.extractTransactions({
      id: 12345,
      transferAmount: 79000,
      content: 'MNQXYZW6789',
    })
    expect(sepay[0].amount).toBe(79000)
    expect(billingService.findOrderCode(sepay[0].content)).toBe('MNQXYZW6789')

    // Nội dung không có mã đơn → không khớp đơn nào
    expect(billingService.findOrderCode('chuyen tien an trua')).toBe(null)
  })

  it('không nhầm tên chủ tài khoản thành mã đơn', () => {
    // Đây là nội dung chuyển khoản thật: tên chủ tài khoản "MN QRONX" đứng ngay
    // trước mã đơn, nếu chỉ lấy lần khớp đầu tiên sẽ ra "MNQRONXMNQ3" (sai).
    const content = 'CT DEN: MN QRONX MNQ3FEN6MKN chuyen tien'
    expect(billingService.findOrderCodes(content)).toEqual(['MNQ3FEN6MKN'])
    expect(billingService.findOrderCode(content)).toBe('MNQ3FEN6MKN')
  })

  it('khớp đúng đơn và kích hoạt gói khi nội dung có tên chủ tài khoản', async () => {
    const payer = await newUser('bill_prefix')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode

    const result = await billingService.handleBankWebhook({
      data: [
        {
          id: `test-prefix-${code}`,
          description: `CT DEN: MN QRONX ${code} chuyen tien`,
          amount: 39000,
        },
      ],
    })
    expect(result.results[0].matched).toBe(true)
    expect(result.results[0].orderCode).toBe(code)

    const me = await api('GET', '/billing/me', { token: payer.token })
    expect(me.data.data.plan).toBe('PLUS')
    expect(me.data.data.daysLeft).toBeGreaterThanOrEqual(29)
  }, 120000)

  it('chuyển thiếu tiền thì không kích hoạt', async () => {
    const payer = await newUser('bill_short')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PRO', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode

    const result = await billingService.handleBankWebhook({
      data: [{ id: `test-short-${code}`, description: code, amount: 50000 }],
    })
    expect(result.results[0].matched).toBe(false)
    expect(result.results[0].reason).toMatch(/chuyển thiếu/i)

    const me = await api('GET', '/billing/me', { token: payer.token })
    expect(me.data.data.plan).toBe('FREE')
  }, 120000)

  it('giao dịch không khớp đơn được ghi lại để gán tay (không mất dấu tiền)', async () => {
    const txId = `test-unmatched-${Date.now()}`
    const result = await billingService.handleBankWebhook({
      data: [{ id: txId, description: 'chuyen tien an trua', amount: 50000 }],
    })
    expect(result.results[0].matched).toBe(false)

    const list = await billingService.listUnmatchedTransfers({ limit: 10 })
    const ev = list.find((e) => e.externalId === txId)
    expect(ev).toBeTruthy()
    expect(ev.amount).toBe(50000)
    expect(ev.content).toContain('an trua')
    expect(ev.reason).toMatch(/không có mã đơn/i)
  })

  it('chuyển thiếu tiền cũng được ghi lại kèm lý do cụ thể', async () => {
    const payer = await newUser('bill_short2')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PRO', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode
    const txId = `test-short2-${Date.now()}`

    await billingService.handleBankWebhook({ data: [{ id: txId, description: code, amount: 10000 }] })

    const list = await billingService.listUnmatchedTransfers({ limit: 20 })
    const ev = list.find((e) => e.externalId === txId)
    expect(ev.reason).toMatch(/chuyển thiếu/i)

    const me = await api('GET', '/billing/me', { token: payer.token })
    expect(me.data.data.plan).toBe('FREE')
  }, 120000)

  it('admin gán tay giao dịch lạc vào đơn → gói được kích hoạt', async () => {
    const payer = await newUser('bill_attach')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode

    // Khách chuyển đúng tiền nhưng ghi sai nội dung → hệ thống không tự khớp
    const txId = `test-attach-${Date.now()}`
    await billingService.handleBankWebhook({
      data: [{ id: txId, description: 'chuyen tien mua goi nhe', amount: 39000 }],
    })
    const list = await billingService.listUnmatchedTransfers({ limit: 20 })
    const ev = list.find((e) => e.externalId === txId)
    expect(ev).toBeTruthy()

    const forbidden = await api('POST', `/admin/billing/transfers/${ev.id}/attach`, {
      token: payer.token,
      body: { orderCode: code },
    })
    expect(forbidden.status).toBe(403)

    const ok = await api('POST', `/admin/billing/transfers/${ev.id}/attach`, {
      token: adminToken,
      body: { orderCode: code },
    })
    expect(ok.status).toBe(200)

    const me = await api('GET', '/billing/me', { token: payer.token })
    expect(me.data.data.plan).toBe('PLUS')
    expect(me.data.data.daysLeft).toBeGreaterThanOrEqual(29)

    // Gán lần hai bị chặn (giao dịch đã dùng cho một đơn rồi)
    const again = await api('POST', `/admin/billing/transfers/${ev.id}/attach`, {
      token: adminToken,
      body: { orderCode: code },
    })
    expect(again.status).toBe(400)

    // Giao dịch đã gán thì không còn nằm trong danh sách "chưa khớp"
    const after = await billingService.listUnmatchedTransfers({ limit: 50 })
    expect(after.find((e) => e.externalId === txId)).toBeFalsy()
  }, 120000)

  it('chống xử lý trùng một giao dịch hai lần', async () => {
    const first = await billingService.registerBillingEvent({
      provider: 'WEBHOOK',
      eventType: 'BANK_TRANSFER',
      externalId: 'test-dup-001',
      amount: 39000,
    })
    const second = await billingService.registerBillingEvent({
      provider: 'WEBHOOK',
      eventType: 'BANK_TRANSFER',
      externalId: 'test-dup-001',
      amount: 39000,
    })
    expect(first).toBe(true)
    expect(second).toBe(false)
  })
})

// ─── Cài đặt nhận tiền (ACB) + tự kích hoạt khi tiền vào ────

describe('Cài đặt nhận tiền (ACB)', () => {
  beforeAll(async () => {
    await prisma.billingSetting.deleteMany({ where: { settingId: 1 } })
    billingService.clearBillingSettingsCache()
  })

  afterAll(async () => {
    await prisma.billingSetting.deleteMany({ where: { settingId: 1 } })
    billingService.clearBillingSettingsCache()
  })

  it('quản trị xem được cài đặt: cảnh báo còn thiếu gì và URL webhook để dán vào SePay', async () => {
    const res = await api('GET', '/admin/billing/settings', { token: adminToken })
    expect(res.status).toBe(200)

    const data = res.data.data
    expect(data.bank.configured).toBe(false)
    expect(data.webhookSecret).toBe('')
    expect(data.webhookUrl).toMatch(/\/api\/v1\/billing\/webhook\/bank$/)
    expect(data.warnings.join(' ')).toMatch(/tài khoản nhận tiền/i)
    expect(data.warnings.join(' ')).toMatch(/mã xác thực webhook/i)
    // ACB phải nằm trong danh sách chọn ngân hàng
    expect(data.bankOptions[0]).toMatchObject({ bin: '970416', code: 'ACB' })

    const forbidden = await api('GET', '/admin/billing/settings', { token: buyer.token })
    expect(forbidden.status).toBe(403)
  })

  it('lưu tài khoản ACB rồi thì đơn mới hiện đúng mã QR ACB', async () => {
    const saved = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: {
        bankId: '970416',
        bankAccount: '123456789',
        bankAccountName: 'MN QRONX',
        qrTemplate: 'compact2',
      },
    })
    expect(saved.status).toBe(200)
    expect(saved.data.data).toMatchObject({
      configured: true,
      bankId: '970416',
      bankName: 'Ngân hàng TMCP Á Châu (ACB)',
      accountNumber: '123456789',
      source: 'APP',
    })

    // Bảng giá công khai cũng phải báo đã nhận chuyển khoản, kèm tên ngân hàng
    const products = await api('GET', '/billing/products')
    expect(products.data.data.payments.bankTransfer).toBe(true)
    expect(products.data.data.payments.bankName).toMatch(/ACB/)

    const payer = await newUser('bill_acb')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    expect(created.data.data.payment.configured).toBe(true)
    const qr = created.data.data.payment.vietQrUrl
    expect(qr).toContain('img.vietqr.io/image/970416-123456789-compact2.png')
    expect(qr).toContain(encodeURIComponent(created.data.data.order.orderCode))

    // Đổi số tài khoản là ăn liền, không cần khởi động lại máy chủ
    const changed = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: { bankAccount: '987654321' },
    })
    expect(changed.data.data.accountNumber).toBe('987654321')
    expect(changed.data.data.bankId).toBe('970416')

    await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: { bankAccount: '123456789' },
    })
  }, 120000)

  it('chặn số tài khoản và tên chủ tài khoản sai định dạng', async () => {
    const badAccount = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: { bankAccount: 'abc' },
    })
    expect(badAccount.status).toBe(400)

    const badName = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: { bankAccountName: 'Nguyễn Văn A' },
    })
    expect(badName.status).toBe(400)

    const badBank = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: { bankId: 'ACB@@' },
    })
    expect(badBank.status).toBe(400)
  })

  it('tiền vào là gói tự bật — không cần admin bấm xác nhận', async () => {
    const rotated = await api('POST', '/admin/billing/settings/rotate-secret', { token: adminToken })
    expect(rotated.status).toBe(200)
    const secret = rotated.data.data.webhookSecret
    expect(secret).toHaveLength(64)

    const payer = await newUser('bill_auto')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PRO', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode

    // Sai mã → 401, không ai tự kích hoạt gói được
    const wrong = await api('POST', '/billing/webhook/bank?token=sai-ma', {
      body: { id: `test-auto-bad-${code}`, content: code, transferAmount: 79000, transferType: 'in' },
    })
    expect(wrong.status).toBe(401)

    // Đúng payload SePay (tiền vào) → khớp đơn và kích hoạt ngay
    const ok = await api('POST', `/billing/webhook/bank?token=${secret}`, {
      body: {
        id: `test-auto-${code}`,
        gateway: 'ACB',
        transactionDate: '2026-09-26 10:00:00',
        accountNumber: '123456789',
        content: `CT DEN: MN QRONX ${code} chuyen tien`,
        transferType: 'in',
        transferAmount: 79000,
        referenceCode: 'FT2609',
      },
    })
    expect(ok.status).toBe(200)
    expect(ok.data.data.results[0]).toMatchObject({ matched: true, orderCode: code, applied: true })

    const me = await api('GET', '/billing/me', { token: payer.token })
    expect(me.data.data.plan).toBe('PRO')
    expect(me.data.data.daysLeft).toBeGreaterThanOrEqual(29)

    // Mã cũ không còn hiệu lực sau khi sinh mã mới
    await api('POST', '/admin/billing/settings/rotate-secret', { token: adminToken })
    const stale = await api('POST', `/billing/webhook/bank?token=${secret}`, {
      body: { id: `test-auto-stale-${code}`, content: code, transferAmount: 79000 },
    })
    expect(stale.status).toBe(401)
  }, 180000)

  it('tiền RA không bao giờ kích hoạt gói, dù nội dung có mã đơn', async () => {
    const payer = await newUser('bill_out')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode

    const out = await billingService.handleBankWebhook({
      id: `test-out-${code}`,
      content: code,
      transferType: 'out',
      transferAmount: 39000,
    })
    expect(out.results[0].matched).toBe(false)
    expect(out.results[0].reason).toMatch(/tiền ra/i)

    const me = await api('GET', '/billing/me', { token: payer.token })
    expect(me.data.data.plan).toBe('FREE')

    // Giao dịch tiền ra không nằm trong danh sách "chưa khớp" (không phải tiền nạp)
    const list = await billingService.listUnmatchedTransfers({ limit: 50 })
    expect(list.find((e) => e.externalId === `test-out-${code}`)).toBeFalsy()
  }, 120000)
})

// ─── Mã QR: hệ thống tự sinh (chuẩn VietQR/EMVCo) ───────────

describe('Mã QR thanh toán do hệ thống tự sinh', () => {
  afterEach(() => vi.restoreAllMocks())

  afterAll(async () => {
    await prisma.billingSetting.deleteMany({ where: { settingId: 1 } })
    billingService.clearBillingSettingsCache()
  })

  it('CRC đúng chuẩn EMVCo (CRC-16/CCITT-FALSE)', () => {
    // Vector kiểm chứng của thuật toán: CRC("123456789") = 0x29B1
    expect(vietQrService.crc16Ccitt('123456789').toString(16).toUpperCase()).toBe('29B1')
  })

  it('sinh ra ĐÚNG mã VietQR thật đã công bố (từng ký tự, kể cả CRC)', () => {
    // Mã VietQR mẫu công bố cho TPBank (970423), STK 0099999999, không số tiền,
    // dùng lại được (01 = 11)
    const published = '00020101021138540010A00000072701240006970423011000999999990208QRIBFTTA53037045802VN6304CBB4'
    const built = vietQrService.buildVietQrPayload({
      bankBin: '970423',
      accountNumber: '0099999999',
      oneTime: false,
    })
    expect(built).toBe(published)
    expect(vietQrService.verifyChecksum(built)).toBe(true)
  })

  it('nhúng đúng BIN ngân hàng, số tài khoản, số tiền và NỘI DUNG chuyển khoản', () => {
    const payload = vietQrService.buildVietQrPayload({
      bankBin: '970416', // ACB
      accountNumber: '246813579',
      amount: 39000,
      content: 'MNQABCD2345',
      merchantName: 'MN QRONX',
      oneTime: true,
    })

    expect(vietQrService.verifyChecksum(payload)).toBe(true)
    expect(payload.startsWith('000201')).toBe(true)
    expect(payload).toContain('010212') // quét một lần
    expect(payload).toContain('A000000727') // định danh NAPAS
    expect(payload).toContain('970416') // BIN ACB
    expect(payload).toContain('246813579') // số tài khoản
    expect(payload).toContain('5303704') // tiền tệ VND
    expect(payload).toContain('540539000') // số tiền 39000
    expect(payload).toContain('5802VN')
    // Nội dung chuyển khoản nằm ở 62 → 08, chính là mã đơn để đối soát
    expect(payload).toContain('0811MNQABCD2345')
    expect(payload).toContain('5908MN QRONX')
  })

  it('từ chối khi thiếu BIN hoặc số tài khoản sai định dạng, và cắt nội dung quá dài', () => {
    expect(() => vietQrService.buildVietQrPayload({ bankBin: 'ACB', accountNumber: '246813579' })).toThrow()
    expect(() => vietQrService.buildVietQrPayload({ bankBin: '970416', accountNumber: 'abc' })).toThrow()

    // Nội dung dài hơn 25 ký tự bị cắt theo giới hạn VietQR (không làm hỏng mã)
    expect(vietQrService.normalizeContent('MNQABCD2345 chuyen tien mua goi nhe ban oi').length).toBe(25)
    expect(vietQrService.normalizeContent('chuyển khoản gói Pro')).toBe('chuyen khoan goi Pro')
  })

  it('sinh được ảnh PNG thật (data URL) và SVG từ payload', async () => {
    const qr = await vietQrService.buildVietQr({
      bankBin: '970416',
      accountNumber: '246813579',
      amount: 79000,
      content: 'MNQABCD2345',
    })

    expect(qr.imageDataUrl.startsWith('data:image/png;base64,')).toBe(true)
    // 8 byte đầu của tệp PNG: 89 50 4E 47 0D 0A 1A 0A
    const bytes = Buffer.from(qr.imageDataUrl.split(',')[1], 'base64')
    expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    const svg = await vietQrService.qrSvg(qr.payload)
    expect(svg).toContain('<svg')
  })

  it('đơn hàng mới có sẵn mã QR của hệ thống, không phụ thuộc dịch vụ ngoài', async () => {
    const saved = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: { bankId: '970416', bankAccount: '246813579', bankAccountName: 'MN QRONX', bankApiQrPath: '' },
    })
    expect(saved.status).toBe(200)

    const payer = await newUser('qr_system')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })

    const { payment } = created.data.data
    expect(payment.qrSource).toBe('SYSTEM')
    expect(payment.qrError).toBeFalsy()
    expect(payment.qrImageDataUrl.startsWith('data:image/png;base64,')).toBe(true)

    // Mã QR nhúng đúng số tiền + nội dung = mã đơn, và CRC hợp lệ
    expect(vietQrService.verifyChecksum(payment.qrPayload)).toBe(true)
    expect(payment.qrPayload).toContain(payment.transferContent)
    expect(payment.qrPayload).toContain(String(created.data.data.order.amount))

    // Sinh lại mã từ payload cũ phải ra cùng một ảnh (không phụ thuộc máy chủ ngoài)
    expect(await vietQrService.qrPngDataUrl(payment.qrPayload)).toBe(payment.qrImageDataUrl)
  }, 120000)

  it('ngân hàng tạo QR động thì đơn dùng mã của ngân hàng', async () => {
    await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: {
        bankId: '970416',
        bankAccount: '246813579',
        bankAccountName: 'MN QRONX',
        bankApiProvider: 'ACB',
        bankApiBaseUrl: 'https://api.acb.com.vn/openbanking',
        bankApiTokenUrl: 'https://api.acb.com.vn/openbanking/oauth2/token',
        bankApiClientId: 'acb-client-id-test',
        bankApiClientSecret: 'acb-client-secret-test',
        bankApiHistoryPath: '/accounts/{account}/transactions',
        bankApiQrPath: '/qr/dynamic',
      },
    })

    const bankPayload = vietQrService.buildVietQrPayload({
      bankBin: '970416',
      accountNumber: '246813579',
      amount: 39000,
      content: 'MNQFROMBANK',
    })

    const calls = []
    mockBankApi(async (url, options) => {
      calls.push({ url, method: options?.method || 'GET' })
      if (url.includes('/oauth2/token')) return jsonResponse({ access_token: 'acb-access-token' })
      return jsonResponse({ data: { qrCode: bankPayload, qrImageUrl: 'https://api.acb.com.vn/qr/abc.png' } })
    })

    const payer = await newUser('qr_bank')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })

    const { payment, order } = created.data.data
    expect(payment.qrSource).toBe('BANK')
    expect(payment.qrPayload).toBe(bankPayload)
    expect(payment.qrImageDataUrl).toBe('https://api.acb.com.vn/qr/abc.png')

    // Gọi đúng đường dẫn tạo QR của ngân hàng, bằng POST
    const qrCall = calls.find((c) => c.url.includes('/qr/dynamic'))
    expect(qrCall.method).toBe('POST')

    // Mã của ngân hàng được lưu trên đơn, không phải xin lại mỗi lần xem
    const again = await api('GET', `/billing/orders/${order.orderCode}`, { token: payer.token })
    expect(again.data.data.payment.qrPayload).toBe(bankPayload)
    expect(calls.filter((c) => c.url.includes('/qr/dynamic'))).toHaveLength(1)
  }, 120000)

  it('ngân hàng lỗi thì đơn vẫn dùng mã do hệ thống sinh (không chặn mua gói)', async () => {
    mockBankApi(async (url) => {
      if (url.includes('/oauth2/token')) return jsonResponse({ access_token: 'acb-access-token' })
      return jsonResponse({ error: 'QR service unavailable' }, 500)
    })

    const payer = await newUser('qr_bank_fail')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    expect(created.status).toBe(201)
    expect(created.data.data.payment.qrSource).toBe('SYSTEM')
    expect(created.data.data.payment.qrImageDataUrl.startsWith('data:image/png;base64,')).toBe(true)
  }, 120000)
})

// ─── API ngân hàng: hệ thống tự kéo giao dịch về ────────────

/**
 * Chặn mạng ra ngoài nhưng vẫn để các lời gọi tới server test đi qua bình thường.
 * `realFetch` được giữ từ lúc nạp module — nếu lấy `globalThis.fetch` khi đã có
 * mock khác đang cài thì sẽ tự gọi vòng vào chính nó.
 */
const realFetch = globalThis.fetch
function mockBankApi(handler) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    const target = String(url)
    if (target.startsWith('http://127.0.0.1:')) return realFetch(url, options)
    return handler(target, options)
  })
}

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('API ngân hàng (kéo giao dịch về)', () => {
  afterEach(() => vi.restoreAllMocks())

  afterAll(async () => {
    await prisma.billingSetting.deleteMany({ where: { settingId: 1 } })
    billingService.clearBillingSettingsCache()
  })

  it('đọc đúng giao dịch SePay (amount_in / amount_out, nội dung có mã đơn)', () => {
    const rows = bankApiService.normalizeSepayTransactions([
      {
        id: 49682,
        transaction_date: '2026-09-26 19:59:48',
        amount_in: '39000.00',
        amount_out: '0.00',
        transaction_content: 'CT DEN: MN QRONX MNQABCD2345 chuyen tien',
        reference_number: '677760.050523.080001',
      },
      {
        id: 49683,
        transaction_date: '2026-09-26 20:01:00',
        amount_in: '0.00',
        amount_out: '100000.00',
        transaction_content: 'phi dich vu',
      },
    ])

    expect(rows[0]).toMatchObject({ externalId: 'sepay:49682', amount: 39000, transferType: 'in' })
    expect(billingService.findOrderCode(rows[0].content)).toBe('MNQABCD2345')
    expect(rows[1]).toMatchObject({ amount: 100000, transferType: 'out' })
  })

  it('đọc được giao dịch ACB ONE CONNECT dù tên trường khác nhau', () => {
    const rows = bankApiService.normalizeAcbTransactions([
      {
        transactionId: 'ACB001',
        transactionDate: '2026-09-26T20:10:00',
        creditDebitIndicator: 'CRDT',
        amount: 39000,
        narrative: 'MNQABCD2345 chuyen tien',
      },
      {
        transactionId: 'ACB002',
        transactionDate: '2026-09-26T20:11:00',
        creditDebitIndicator: 'DBIT',
        amount: 50000,
        description: 'MNQABCD2345 hoan tien',
      },
      {
        transaction_id: 'ACB003',
        bookingDate: '2026-09-26',
        creditAmount: '79000.00',
        debitAmount: '0.00',
        content: 'MNQXYZW6789',
      },
    ])

    expect(rows[0]).toMatchObject({ externalId: 'acb:ACB001', transferType: 'in', amount: 39000 })
    expect(billingService.findOrderCode(rows[0].content)).toBe('MNQABCD2345')
    // Ghi nợ = tiền ra → không bao giờ kích hoạt gói
    expect(rows[1].transferType).toBe('out')
    expect(rows[2]).toMatchObject({ externalId: 'acb:ACB003', transferType: 'in', amount: 79000 })
  })

  it('đổi nhà cung cấp thì tự dùng địa chỉ mặc định của nhà cung cấp mới', async () => {
    await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: {
        bankApiProvider: 'ACB',
        bankApiBaseUrl: 'https://api.acb.com.vn/openbanking',
        bankApiTokenUrl: 'https://api.acb.com.vn/openbanking/oauth2/token',
        bankApiClientId: 'acb-id',
        bankApiClientSecret: 'acb-secret',
        bankApiHistoryPath: '/accounts/{account}/transactions',
      },
    })

    // Đổi sang SePay mà không nhập Base URL → không được giữ địa chỉ của ACB
    const switched = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: { bankApiProvider: 'SEPAY', bankApiToken: 'sepay-token-test' },
    })
    expect(switched.status).toBe(200)
    const status = await api('GET', '/admin/billing/settings', { token: adminToken })
    expect(status.data.data.sync.provider).toBe('SEPAY')
    expect(status.data.data.sync.baseUrl).toBe('https://my.sepay.vn/userapi')

    await prisma.billingSetting.deleteMany({ where: { settingId: 1 } })
    billingService.clearBillingSettingsCache()
  }, 120000)

  it('con trỏ since_id chỉ tiến, không lùi về giao dịch cũ', () => {
    const txs = [{ providerId: '10' }, { providerId: '25' }, { providerId: '12' }]
    expect(bankApiService.nextCursor(txs, '5')).toBe('25')
    expect(bankApiService.nextCursor(txs, '30')).toBe('30')
    expect(bankApiService.nextCursor([{ providerId: null }], '30')).toBe('30')
    expect(bankApiService.nextCursor([], null)).toBe(null)
  })

  it('chưa cấu hình thì báo rõ, và chỉ quản trị mới gọi được', async () => {
    const forbidden = await api('POST', '/admin/billing/sync', { token: buyer.token })
    expect(forbidden.status).toBe(403)

    // Bảo đảm đúng cảnh chưa cấu hình, không phụ thuộc thứ tự test chạy trước
    await prisma.billingSetting.deleteMany({ where: { settingId: 1 } })
    billingService.clearBillingSettingsCache()

    const test = await bankApiService.testBankConnection()
    expect(test.ok).toBe(false)
    expect(test.message).toMatch(/nhà cung cấp|thông tin kết nối/i)

    // Bật đồng bộ tự động khi chưa có thông tin → chặn ngay từ lúc lưu
    const bad = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: { bankApiProvider: 'SEPAY', syncEnabled: true },
    })
    expect(bad.status).toBe(400)
    expect(bad.data.message).toMatch(/chưa đủ thông tin/i)
  })

  it('SePay: tự kéo giao dịch → kích hoạt gói, đồng bộ lại không cộng thêm ngày', async () => {
    const payer = await newUser('bank_api_sepay')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PLUS', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode

    const saved = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: {
        bankApiProvider: 'SEPAY',
        bankApiToken: 'sepay-token-test',
        bankApiBaseUrl: 'https://my.sepay.vn/userapi',
        bankApiAccount: '246813579',
        syncEnabled: true,
        syncIntervalMinutes: 5,
      },
    })
    expect(saved.status).toBe(200)

    // ID giao dịch phải là số (để so con trỏ since_id) nhưng khác nhau mỗi lần
    // chạy test, nếu không lần chạy sau sẽ bị coi là giao dịch cũ đã xử lý.
    const txId = Number(String(Date.now()).slice(-7))

    let askedWith = null
    mockBankApi(async (url, options) => {
      askedWith = { url, auth: options?.headers?.Authorization }
      return jsonResponse({
        status: 200,
        transactions: [
          {
            id: txId,
            account_number: '246813579',
            bank_brand_name: 'ACB',
            transaction_date: '2026-09-26 20:00:00',
            amount_in: '39000.00',
            amount_out: '0.00',
            transaction_content: `CT DEN: MN QRONX ${code} chuyen tien`,
            reference_number: '677760.050523.080001',
          },
        ],
      })
    })

    const synced = await api('POST', '/admin/billing/sync', { token: adminToken })
    expect(synced.status).toBe(200)
    expect(synced.data.data).toMatchObject({ ok: true, fetched: 1, activated: 1 })
    expect(synced.data.data.activatedOrders).toEqual([code])
    // Gọi đúng API của SePay, đúng tài khoản, có xác thực bằng token
    expect(askedWith.url).toContain('my.sepay.vn/userapi/transactions/list')
    expect(askedWith.url).toContain('account_number=246813579')
    expect(askedWith.auth).toBe('Bearer sepay-token-test')

    const me = await api('GET', '/billing/me', { token: payer.token })
    expect(me.data.data.plan).toBe('PLUS')
    const firstExpiry = me.data.data.planExpiresAt
    expect(me.data.data.daysLeft).toBeGreaterThanOrEqual(29)

    // Đồng bộ lần nữa (giao dịch y hệt) → bỏ qua, không cộng thêm 30 ngày
    const again = await api('POST', '/admin/billing/sync', { token: adminToken })
    expect(again.data.data.activated).toBe(0)
    expect(again.data.data.duplicated).toBe(1)

    const after = await api('GET', '/billing/me', { token: payer.token })
    expect(after.data.data.planExpiresAt).toBe(firstExpiry)
  }, 120000)

  it('SePay: từ chối token sai thì báo lỗi rõ, không kích hoạt gì', async () => {
    await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: { bankApiProvider: 'SEPAY', bankApiToken: 'token-sai', syncEnabled: true },
    })
    mockBankApi(async () => jsonResponse({ status: 401, error: 'Unauthorized' }, 401))

    const res = await api('POST', '/admin/billing/sync', { token: adminToken })
    expect(res.status).toBe(200)
    expect(res.data.data.ok).toBe(false)
    expect(res.data.data.message).toMatch(/401|Unauthorized/i)

    const status = await api('GET', '/admin/billing/settings', { token: adminToken })
    expect(status.data.data.sync.lastSyncStatus).toBe('ERROR')
  }, 120000)

  it('ACB ONE CONNECT: lấy token OAuth2 rồi đọc lịch sử giao dịch để kích hoạt gói', async () => {
    const payer = await newUser('bank_api_acb')
    const created = await api('POST', '/billing/orders', {
      token: payer.token,
      body: { plan: 'PRO', cycle: 'MONTHLY' },
    })
    const code = created.data.data.order.orderCode

    const saved = await api('PUT', '/admin/billing/settings', {
      token: adminToken,
      body: {
        bankApiProvider: 'ACB',
        bankApiBaseUrl: 'https://api.acb.com.vn/openbanking',
        bankApiTokenUrl: 'https://api.acb.com.vn/openbanking/oauth2/token',
        bankApiClientId: 'acb-client-id-test',
        bankApiClientSecret: 'acb-client-secret-test',
        bankApiHistoryPath: '/accounts/{account}/transactions?fromDate={from}&toDate={to}&limit={limit}',
        bankApiAccount: '246813579',
        syncEnabled: true,
        syncIntervalMinutes: 3,
      },
    })
    expect(saved.status).toBe(200)

    const txRef = `FT${String(Date.now()).slice(-8)}`
    const calls = []
    mockBankApi(async (url, options) => {
      calls.push({ url, method: options?.method || 'GET', body: options?.body, auth: options?.headers?.Authorization })
      if (url.includes('/oauth2/token')) {
        return jsonResponse({ access_token: 'acb-access-token', token_type: 'Bearer', expires_in: 3600 })
      }
      return jsonResponse({
        data: {
          transactions: [
            {
              transactionId: txRef,
              transactionDate: '2026-09-26T20:30:00',
              creditDebitIndicator: 'CRDT',
              amount: 79000,
              narrative: `CT DEN: MN QRONX ${code} chuyen tien`,
            },
          ],
        },
      })
    })

    const synced = await api('POST', '/admin/billing/sync', { token: adminToken })
    expect(synced.data.data).toMatchObject({ ok: true, fetched: 1, activated: 1 })

    const tokenCall = calls.find((c) => c.url.includes('/oauth2/token'))
    expect(tokenCall.method).toBe('POST')
    expect(String(tokenCall.body)).toContain('grant_type=client_credentials')
    expect(String(tokenCall.body)).toContain('client_id=acb-client-id-test')

    const historyCall = calls.find((c) => c.url.includes('/transactions'))
    expect(historyCall.url).toContain('/accounts/246813579/transactions')
    expect(historyCall.url).toContain('limit=100')
    expect(historyCall.auth).toBe('Bearer acb-access-token')

    const me = await api('GET', '/billing/me', { token: payer.token })
    expect(me.data.data.plan).toBe('PRO')
    expect(me.data.data.daysLeft).toBeGreaterThanOrEqual(29)

    // Trạng thái đồng bộ được ghi lại cho trang quản trị
    const status = await api('GET', '/admin/billing/settings', { token: adminToken })
    expect(status.data.data.sync).toMatchObject({ provider: 'ACB', syncEnabled: true, intervalMinutes: 3 })
    expect(status.data.data.sync.lastSyncStatus).toBe('OK')
  }, 120000)
})

// ─── Hạn mức AI theo ngày ───────────────────────────────────

describe('Hạn mức trợ lý AI', () => {
  it('gói Free được 5 lượt mỗi ngày, hết lượt thì trả 429 kèm gợi ý nâng cấp', async () => {
    const quota = await api('GET', '/ai/quota', { token: aiUser.token })
    expect(quota.status).toBe(200)
    expect(quota.data.data.limit).toBe(PLANS.FREE.aiDailyLimit)
    expect(quota.data.data.remaining).toBe(5)

    for (let i = 0; i < 5; i += 1) {
      await aiQuotaService.consumeQuota(aiUser.userId)
    }

    const used = await api('GET', '/ai/quota', { token: aiUser.token })
    expect(used.data.data.used).toBe(5)
    expect(used.data.data.remaining).toBe(0)

    const blocked = await api('POST', '/ai/parse-tasks', {
      token: aiUser.token,
      body: { text: 'nhắc tôi 7h tối mai đi học' },
    })
    expect(blocked.status).toBe(429)
    expect(blocked.data.message).toMatch(/5 lượt/)
  })

  it('không trừ lượt khi AI trả lỗi (không có AI_INFER_URL chạy được)', async () => {
    const fresh = await newUser('bill_ai_off')
    const before = await api('GET', '/ai/quota', { token: fresh.token })

    const res = await api('POST', '/ai/parse-tasks', {
      token: fresh.token,
      body: { text: 'nhắc tôi 7h tối mai đi học' },
    })
    // 503/504/502 tuỳ tình trạng server AI, quan trọng là KHÔNG phải 429 và
    // lượt vẫn còn nguyên
    expect([502, 503, 504]).toContain(res.status)

    const after = await api('GET', '/ai/quota', { token: fresh.token })
    expect(after.data.data.used).toBe(before.data.data.used)
    expect(after.data.data.remaining).toBe(5)
  }, 120000)

  it('gói Pro không giới hạn lượt AI', async () => {
    const proUser = await newUser('bill_ai_pro')
    await api('POST', '/billing/trial', { token: proUser.token })

    const quota = await api('GET', '/ai/quota', { token: proUser.token })
    expect(quota.data.data.plan).toBe('PRO')
    expect(quota.data.data.limit).toBe(null)
    expect(quota.data.data.unlimited).toBe(true)
  }, 120000)
})
