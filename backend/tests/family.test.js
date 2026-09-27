import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { startServer, stopServer, api, register, login, prisma } from './setup.js'
import { syncFamilySeats, seatsLeft, MAX_FAMILY_SEATS } from '../src/services/familyService.js'
import { sendRenewalReminders, listExpiringSoon } from '../src/services/billingService.js'

// Ghi lại thông báo đẩy: người trong nhà cần biết mình vừa được mời (hoặc vừa bị
// gỡ), còn test thì không muốn gửi chuông thật.
const { pushCalls } = vi.hoisted(() => ({ pushCalls: [] }))

vi.mock('../src/services/pushService.js', () => ({
  pushToUser: async (userId, payload) => {
    pushCalls.push({ userId: Number(userId), title: payload?.title })
    return { total: 1, ok: 1 }
  },
  countSubscriptions: async () => 1,
}))

// ─── Gói Pro Gia đình ────────────────────────────────────────
//
// Gói này bán CỘNG ĐỒNG: một khách trả tiền, tới 4 tài khoản cùng dùng quyền Pro.
// Hai thứ dễ hỏng nhất mà bộ test này phải giữ:
//   1. Người trong nhà phải được quyền Pro THẬT (không phải chỉ hiện tên gói),
//      và hết hạn cùng chủ — không thì khách trả tiền cho cả nhà mà cả nhà không
//      dùng được gì.
//   2. Không ai trong nhà bị nhắc "mua kỳ mới" hay bị admin coi là khách sắp hết
//      hạn — họ không tự gia hạn được, nhắc họ là nhắc sai người.

beforeAll(async () => {
  await startServer()
})

afterAll(async () => {
  await stopServer()
})

async function newUser(prefix, plan = 'FREE', expiresInDays = 30) {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'Family Test')
  const loginRes = await login(email, 'Test@1234')
  const token = loginRes.data.data.accessToken
  const row = await prisma.user.findUnique({ where: { email }, select: { userId: true } })
  if (plan !== 'FREE') {
    await prisma.user.update({
      where: { userId: row.userId },
      data: { plan, planExpiresAt: new Date(Date.now() + expiresInDays * 86400_000) },
    })
  }
  return { email, token, userId: row.userId }
}

/** Mời qua API, trả về response để test kiểm tra mã lỗi lẫn nội dung. */
function invite(owner, email, note) {
  return api('POST', '/me/family/members', { token: owner.token, body: { email, note } })
}

// ─── Cổng gói ────────────────────────────────────────────────

describe('Gói Pro Gia đình — chỉ chủ gói mới được mời', () => {
  it('gói Free mời được không (bị chặn kèm mức giá)', async () => {
    const owner = await newUser('fam_free')
    const mate = await newUser('fam_free_mate')

    const res = await invite(owner, mate.email)
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('Pro Gia đình')
    expect(await prisma.familyMember.count({ where: { ownerId: owner.userId } })).toBe(0)
  })

  it('gói Pro thường cũng mời không được — gia đình là gói riêng', async () => {
    const owner = await newUser('fam_pro', 'PRO')
    const mate = await newUser('fam_pro_mate')

    const res = await invite(owner, mate.email)
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('Pro Gia đình')
  })

  it('chủ gói Pro Gia đình mời được, người được mời có quyền Pro ngay', async () => {
    const owner = await newUser('fam_owner', 'FAMILY')
    const mate = await newUser('fam_mate')

    const res = await invite(owner, mate.email, 'sang giúp chị làm bữa tối nhé')
    expect(res.status).toBe(201)
    expect(res.data.data.role).toBe('OWNER')
    expect(res.data.data.members).toHaveLength(1)
    expect(res.data.data.seatsLeft).toBe(MAX_FAMILY_SEATS - 2)

    const row = await prisma.user.findUnique({ where: { userId: mate.userId } })
    expect(row.plan).toBe('PRO')
    // Hạn của người trong nhà PHẢI lấy theo chủ — nếu không thì hết hạn mỗi người một kiểu
    expect(new Date(row.planExpiresAt).getTime()).toBe(
      new Date((await prisma.user.findUnique({ where: { userId: owner.userId } })).planExpiresAt).getTime(),
    )

    // Ghế phải ghi đúng nguồn: không phải tiền khách trả, nên provider là FAMILY
    const seat = await prisma.subscription.findFirst({
      where: { userId: mate.userId, provider: 'FAMILY', status: 'ACTIVE' },
    })
    expect(seat).toBeTruthy()
    expect(seat.plan).toBe('PRO')

    // Người được mời nhận thông báo biết mình vừa có Pro
    expect(pushCalls.some((p) => p.userId === mate.userId && p.title.includes('Pro Gia đình'))).toBe(true)
  })

  it('người trong nhà dùng được quyền Pro THẬT (giao việc — cửa Free/Plus bị chặn)', async () => {
    const owner = await newUser('fam_gate_owner', 'FAMILY')
    const mate = await newUser('fam_gate_mate')
    const other = await newUser('fam_gate_other')

    await invite(owner, mate.email)

    const planRes = await api('GET', '/plans/me', { token: mate.token })
    expect(planRes.status).toBe(200)
    expect(planRes.data.data.plan).toBe('PRO')

    // Giao việc là quyền lợi chỉ Pro có: Free/Plus nhận 400, người trong nhà phải
    // đi qua được — chứng minh "có Pro" chứ không chỉ là tên gói trên giao diện.
    const taskRes = await api('POST', '/tasks', {
      token: mate.token,
      body: { title: 'Việc của người trong nhà', dueAt: new Date(Date.now() + 7200_000).toISOString() },
    })
    expect(taskRes.status).toBe(201)

    const shareRes = await api('POST', `/tasks/${taskRes.data.data.id}/shares`, {
      token: mate.token,
      body: { email: other.email },
    })
    expect(shareRes.status).toBe(201)
  })
})

// ─── Luật mời ────────────────────────────────────────────────

describe('Gói Pro Gia đình — các luật mời', () => {
  let owner

  beforeAll(async () => {
    owner = await newUser('fam_rules', 'FAMILY')
  })

  it('email chưa có tài khoản → nói rõ cần rủ đăng ký, không tạo dòng nào', async () => {
    const res = await invite(owner, `chua_ton_tai_${Date.now()}@example.com`)
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('đăng ký')
    expect(res.data.errors?.needInvite).toBe(true)
  })

  it('mời chính mình → chặn', async () => {
    const res = await invite(owner, owner.email)
    expect(res.status).toBe(400)
  })

  it('người đang có gói trả phí riêng không nhận chỗ — không cướp khách đang trả tiền', async () => {
    const paid = await newUser('fam_paid', 'PLUS')
    const res = await invite(owner, paid.email)
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('trả phí riêng')
    expect(await prisma.familyMember.count({ where: { memberId: paid.userId } })).toBe(0)
  })

  it('người đã ở một nhà khác không nhận thêm chỗ nữa', async () => {
    const otherOwner = await newUser('fam_other', 'FAMILY')
    const mate = await newUser('fam_taken')
    expect((await invite(otherOwner, mate.email)).status).toBe(201)

    const res = await invite(owner, mate.email)
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('nằm trong một gói')
  })

  it('chủ một nhà khác không bị kéo vào nhà này (kéo là mất gói của người đó)', async () => {
    const otherOwner = await newUser('fam_other_owner', 'FAMILY')
    const res = await invite(owner, otherOwner.email)
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('chủ một gói')
  })

  it('chỉ đủ 3 chỗ cho người ngoài (tổng 4 gồm chủ)', async () => {
    expect(seatsLeft(0)).toBe(MAX_FAMILY_SEATS - 1)
    expect(seatsLeft(3)).toBe(0)

    const full = await newUser('fam_full', 'FAMILY')
    for (let i = 0; i < MAX_FAMILY_SEATS - 1; i += 1) {
      const mate = await newUser(`fam_full_mate_${i}`)
      expect((await invite(full, mate.email)).status).toBe(201)
    }
    const extra = await newUser('fam_full_extra')
    const res = await invite(full, extra.email)
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('đã đủ')
    expect(await prisma.familyMember.count({ where: { ownerId: full.userId } })).toBe(3)
  })
})

// ─── Gỡ, rời, và sự sống của gói theo chủ ────────────────────

describe('Gói Pro Gia đình — gỡ thành viên và quyền lợi đi theo hạn của chủ', () => {
  it('gỡ thành viên: mất quyền Pro ngay, dữ liệu không đụng tới', async () => {
    const owner = await newUser('fam_drop', 'FAMILY')
    const mate = await newUser('fam_drop_mate')
    const res = await invite(owner, mate.email)
    const memberRow = res.data.data.members[0]

    const drop = await api('DELETE', `/me/family/members/${memberRow.userId}`, { token: owner.token })
    expect(drop.status).toBe(200)

    const row = await prisma.user.findUnique({ where: { userId: mate.userId } })
    expect(row.plan).toBe('FREE')
    expect(row.planExpiresAt).toBeNull()
    // Việc của người này không bị xoá — chỉ mất quyền lợi gói
    const seat = await prisma.subscription.findFirst({ where: { userId: mate.userId, provider: 'FAMILY' } })
    expect(seat.status).toBe('CANCELLED')
  })

  it('người trong nhà tự rời đi được, chủ nhận thông báo', async () => {
    const owner = await newUser('fam_leave', 'FAMILY')
    const mate = await newUser('fam_leave_mate')
    await invite(owner, mate.email)
    pushCalls.length = 0

    const res = await api('POST', '/me/family/leave', { token: mate.token })
    expect(res.status).toBe(200)

    expect(await prisma.familyMember.count({ where: { memberId: mate.userId } })).toBe(0)
    expect((await prisma.user.findUnique({ where: { userId: mate.userId } })).plan).toBe('FREE')
    expect(pushCalls.some((p) => p.userId === owner.userId)).toBe(true)
  })

  it('chủ hết hạn → cả nhà mất quyền và dòng thành viên bị xoá (mua lại phải mời lại)', async () => {
    const owner = await newUser('fam_expire', 'FAMILY')
    const mate = await newUser('fam_expire_mate')
    await invite(owner, mate.email)

    // Hạ chủ xuống quá hạn — đúng việc scheduler làm mỗi phút
    await prisma.user.update({
      where: { userId: owner.userId },
      data: { plan: 'FREE', planExpiresAt: null },
    })

    const state = await syncFamilySeats()
    expect(state.revoked).toBeGreaterThan(0)
    expect(await prisma.familyMember.count({ where: { ownerId: owner.userId } })).toBe(0)
    expect((await prisma.user.findUnique({ where: { userId: mate.userId } })).plan).toBe('FREE')
  })

  it('chủ gia hạn → người trong nhà kéo theo đúng hạn mới', async () => {
    const owner = await newUser('fam_renew', 'FAMILY')
    const mate = await newUser('fam_renew_mate')
    await invite(owner, mate.email)

    const later = new Date(Date.now() + 90 * 86400_000)
    await prisma.user.update({ where: { userId: owner.userId }, data: { planExpiresAt: later } })

    await syncFamilySeats()

    const row = await prisma.user.findUnique({ where: { userId: mate.userId } })
    expect(row.plan).toBe('PRO')
    expect(new Date(row.planExpiresAt).getTime()).toBe(later.getTime())
    const seat = await prisma.subscription.findFirst({
      where: { userId: mate.userId, provider: 'FAMILY', status: 'ACTIVE' },
    })
    expect(new Date(seat.expiresAt).getTime()).toBe(later.getTime())
  })

  it('người trong nhà không mua được gói riêng (để hai nguồn quyền lợi không đánh nhau)', async () => {
    const owner = await newUser('fam_seat_buy', 'FAMILY')
    const mate = await newUser('fam_seat_buy_mate')
    await invite(owner, mate.email)

    const res = await api('POST', '/billing/orders', {
      token: mate.token,
      body: { plan: 'PRO', cycle: 'MONTHLY' },
    })
    expect(res.status).toBe(400)
    expect(res.data.message).toContain('gia đình')
    expect(await prisma.paymentOrder.count({ where: { userId: mate.userId } })).toBe(0)
  })
})

// ─── Không gửi thư nhắc gia hạn cho người trong nhà ──────────

describe('Gói Pro Gia đình — người trong nhà không tự gia hạn được nên không bị nhắc', () => {
  it('thư nhắc "mua kỳ mới" chỉ gửi cho người trả tiền, không gửi cho chỗ ngồi', async () => {
    const owner = await newUser('fam_mail', 'FAMILY', 2)
    const mate = await newUser('fam_mail_mate')
    await invite(owner, mate.email)

    // Chủ gói có một dòng trả tiền thật sắp tới hạn (đúng cảnh khách chuyển khoản)
    await prisma.subscription.create({
      data: {
        userId: owner.userId,
        plan: 'FAMILY',
        cycle: 'MONTHLY',
        provider: 'VIETQR',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 2 * 86400_000),
        note: 'Đơn test — chủ gói sắp hết hạn',
      },
    })

    const sent = []
    const result = await sendRenewalReminders({
      daysBefore: 5,
      mailer: async ({ to }) => {
        sent.push(to)
      },
    })

    // Người trả tiền thì PHẢI được nhắc, còn chỗ ngồi thì không — họ không mua
    // kỳ mới được, gửi thư "Gia hạn ngay" cho họ là mời bấm vào một lỗi.
    expect(result.due).toBeGreaterThanOrEqual(1)
    expect(sent).toContain(owner.email)
    expect(sent).not.toContain(mate.email)

    // Bảng "sắp hết hạn trong 7 ngày" của admin cũng phải loại ghế
    const soon = await listExpiringSoon({ daysAhead: 7 })
    expect(soon.some((s) => s.user.email === owner.email)).toBe(true)
    expect(soon.some((s) => s.user.email === mate.email)).toBe(false)
  })
})
