import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { MAX_FAMILY_SEATS, isPlanExpired } from '../utils/planLimits.js'
import { startOfDay, addDays } from '../utils/dateUtils.js'

// Xuất lại để giao diện/test không phải biết gói này định nghĩa ở đâu.
export { MAX_FAMILY_SEATS }

// ─── Gói Pro Gia đình ────────────────────────────────────────
//
// Vì sao bán thêm gói này: năm quyền lợi Pro trước đều bán cho MỘT người, nên
// doanh thu chỉ tăng khi có thêm khách mới. Gói gia đình nâng TIỀN MỖI KHÁCH
// (199.000đ thay vì 79.000đ cho một người) và nhờ mỗi khách kéo theo ba khách
// dùng miễn phí — mỗi người trong nhà là một tài khoản thật, việc thật, chuông
// thật, nên cũng là người có thể trả tiền sau này.
//
// Nguyên tắc quan trọng nhất của dịch vụ này: quyền lợi của người trong nhà được
// VẬT CHẤT HOÁ trên `users.plan` (PRO) thay vì suy ra ở mỗi chỗ kiểm tra gói.
// Mọi cổng quyền lợi cũ — nhắc dai, báo cáo, kế hoạch tuần, giao việc, thiết bị,
// âm thanh — vì thế chạy đúng mà KHÔNG phải sửa một dòng nào, và cũng không có
// chỗ nào tính khác chỗ nào về việc "người này có được dùng Pro không".
//
// Gói Pro Gia đình chỉ sống khi CHỦ GÓI còn hạn. Chủ hết hạn thì cả nhà cùng
// hết và dòng thành viên bị xoá — khi chủ mua lại phải MỜI LẠI, vì tự bật lại
// quyền cho người đã muốn rời đi là điều không ai mong đợi.

/** Quyền lợi của một chỗ ngồi: Pro (vật chất hoá) + subscription provider=FAMILY. */
const SEAT_PLAN = 'PRO'

/** Đang có một lượt đồng bộ chạy hay không (chốt chặn trong tiến trình). */
let syncing = false

/** Người mua gói: chỉ chủ gói FAMILY còn hạn mới được thao tác với ghế. */
async function loadActiveOwner(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, fullName: true, email: true, plan: true, planExpiresAt: true },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  if (user.plan !== 'FAMILY' || isPlanExpired(user)) {
    throw ApiError.badRequest(
      'Gói Pro Gia đình là quyền lợi của người mua gói. Mua gói Pro Gia đình để dùng chung cho cả nhà (tối đa 4 tài khoản).',
    )
  }
  return user
}

/** Ghế còn trống trong nhà: tổng 4 tài khoản trừ chủ gói. */
export function seatsLeft(memberCount) {
  return Math.max(0, MAX_FAMILY_SEATS - 1 - memberCount)
}

/**
 * Cấp quyền Pro cho một chỗ ngồi, đúng bằng hạn của chủ gói.
 * Đóng ghế cũ (nếu có) trước rồi mới ghi ghế mới → không bao giờ có hai ghế
 * ACTIVE cùng lúc, nên khi chủ hết hạn chỉ cần quét một dòng.
 */
async function grantSeat(owner, member) {
  const now = new Date()
  const seatStart = member.plan === SEAT_PLAN ? new Date(member.planStartedAt || now) : now

  await prisma.user.update({
    where: { userId: member.userId },
    data: {
      plan: SEAT_PLAN,
      planStartedAt: seatStart,
      planExpiresAt: owner.planExpiresAt,
    },
  })

  // Gia hạn = SỬA dòng ghế đang có, không tạo dòng mới: nếu tạo mới thì mỗi lần
  // chủ gia hạn lại đóng một dòng rồi mở một dòng, và hai lượt đồng bộ chạy sát
  // nhau có thể để lại hai ghế cùng ACTIVE cho một người.
  const existing = await prisma.subscription.findFirst({
    where: { userId: member.userId, provider: 'FAMILY', status: 'ACTIVE' },
    orderBy: { subscriptionId: 'desc' },
  })
  if (existing) {
    await prisma.subscription.update({
      where: { subscriptionId: existing.subscriptionId },
      data: {
        plan: SEAT_PLAN,
        expiresAt: owner.planExpiresAt,
        startedAt: seatStart,
        providerRef: `family:${owner.userId}`,
        note: `Chỗ trong gói Pro Gia đình của ${owner.email}`,
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId: member.userId,
        plan: SEAT_PLAN,
        cycle: 'MONTHLY',
        // Khác provider với các đơn trả tiền thật: báo cáo doanh thu không được phép
        // đếm một chỗ ngồi là một khách đã trả tiền.
        provider: 'FAMILY',
        status: 'ACTIVE',
        providerRef: `family:${owner.userId}`,
        startedAt: seatStart,
        expiresAt: owner.planExpiresAt,
        note: `Chỗ trong gói Pro Gia đình của ${owner.email}`,
      },
    })
  }
  return true
}

/**
 * Thu hồi quyền của một chỗ ngồi (chỉ khi ghế đó là nguồn quyền lợi).
 * Trả về true nếu vừa hạ gói.
 */
async function revokeSeat(memberId) {
  const seat = await prisma.subscription.findFirst({
    where: { userId: memberId, provider: 'FAMILY', status: 'ACTIVE' },
  })
  if (!seat) return false

  const member = await prisma.user.findUnique({
    where: { userId: memberId },
    select: { plan: true },
  })

  // Người này có gói riêng (admin tặng, đổi điểm…) → không đụng vào; chỉ đóng ghế.
  if (member?.plan === SEAT_PLAN) {
    await prisma.user.update({
      where: { userId: memberId },
      data: { plan: 'FREE', planStartedAt: null, planExpiresAt: null },
    })
    // Âm thanh import chỉ dành cho gói trả phí → về chuông mặc định (giống hạ gói bình thường)
    await prisma.notificationSetting.updateMany({
      where: { userId: memberId, alarmSound: { startsWith: 'custom:' } },
      data: { alarmSound: 'classic' },
    })
  }
  // updateMany thay vì update: hai lượt đồng bộ chạy sát nhau (cron + nhịp /health)
  // cùng thấy dòng ghế này, lượt sau không được ném lỗi vì lượt trước đã đóng nó.
  await prisma.subscription.updateMany({
    where: { subscriptionId: seat.subscriptionId, status: 'ACTIVE' },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  })
  return true
}

/** Đóng vai trò thông báo (bị lỗi cũng không làm hỏng thao tác chính). */
async function notify(userId, payload) {
  try {
    const { pushToUser } = await import('./pushService.js')
    await pushToUser(userId, payload)
  } catch (err) {
    console.error('[Family] Không gửi được thông báo:', err.message)
  }
}

/**
 * Đồng bộ quyền lợi cả nhà theo chủ gói. Chạy mỗi phút cùng nhịp hạ gói hết hạn
 * (scheduler) — nhờ đó mọi đường cấp gói (mua, admin tặng, đổi điểm, dùng thử)
 * đều đưa người trong nhà về đúng hạn mới mà không phải vá từng đường.
 *
 * @returns {Promise<{scanned:number, granted:number, revoked:number, ended:number}>}
 */
export async function syncFamilySeats({ now = new Date() } = {}) {
  // Chốt chặn trong tiến trình: cron mỗi phút và nhịp /health gọi cùng hàm này,
  // nên hai lượt quét có thể chồng nhau trên CÙNG dữ liệu (đã xảy ra thật: một
  // lượt xoá dòng thành viên, lượt kia ném lỗi "No record was found for a delete").
  if (syncing) return { scanned: 0, granted: 0, revoked: 0, ended: 0, skipped: true }
  syncing = true
  try {
    return await runFamilySync(now)
  } finally {
    syncing = false
  }
}

/** Một lượt quét thật sự — tách ra để phần chốt chặn ở trên luôn nhả khoá. */
async function runFamilySync(now) {
  const rows = await prisma.familyMember.findMany({
    include: {
      owner: { select: { userId: true, fullName: true, email: true, plan: true, planExpiresAt: true } },
      member: { select: { userId: true, fullName: true, email: true, plan: true, planStartedAt: true, planExpiresAt: true } },
    },
  })

  const state = { scanned: rows.length, granted: 0, revoked: 0, ended: 0 }

  for (const row of rows) {
    const ownerActive =
      row.owner.plan === 'FAMILY' &&
      row.owner.planExpiresAt &&
      new Date(row.owner.planExpiresAt) > now

    if (!ownerActive) {
      const dropped = await revokeSeat(row.memberId)
      // deleteMany thay vì delete: cùng lý do — lượt đồng bộ khác có thể đã xoá dòng
      // này rồi, và "không còn gì để xoá" là kết quả ĐÚNG, không phải lỗi.
      await prisma.familyMember.deleteMany({ where: { familyMemberId: row.familyMemberId } })
      if (dropped) {
        state.revoked += 1
        await notify(row.memberId, {
          title: '🏠 Gói Pro Gia đình đã kết thúc',
          body: `Gói Pro Gia đình của ${row.owner.fullName || 'chủ gói'} không còn hiệu lực — bạn trở lại gói Miễn phí.`,
          url: '/app/billing',
        })
      }
      state.ended += 1
      continue
    }

    const changed = await ensureSeat(row.owner, row.member, now)
    if (changed) state.granted += 1
  }

  return state
}

/**
 * Đảm bảo một chỗ ngồi đang đúng hạn với chủ gói:
 *  • chưa có quyền mà chủ còn hạn → cấp;
 *  • đã có quyền nhưng hạn lệch (chủ vừa gia hạn) → kéo theo;
 *  • đang có gói riêng (admin tặng…) → không đụng.
 */
async function ensureSeat(owner, member, now) {
  // Không đè lên gói người trong nhà có bằng đường khác (đổi điểm, admin tặng,
  // dùng thử) — quyền lợi ấy là của họ, kể cả khi nhà này hết hạn trước.
  const ownSub = await prisma.subscription.findFirst({
    where: { userId: member.userId, status: 'ACTIVE', provider: { not: 'FAMILY' } },
    select: { subscriptionId: true },
  })
  if (ownSub) return false

  const seat = await prisma.subscription.findFirst({
    where: { userId: member.userId, provider: 'FAMILY', status: 'ACTIVE' },
  })

  if (member.plan === SEAT_PLAN && seat) {
    const sameExpiry = seat.expiresAt && new Date(seat.expiresAt).getTime() === new Date(owner.planExpiresAt).getTime()
    if (sameExpiry && new Date(member.planExpiresAt || 0).getTime() === new Date(owner.planExpiresAt).getTime()) {
      return false
    }
    // Ghi đè cả hai mốc (user.planExpiresAt và dòng ghế) = gia hạn cùng lúc
    await grantSeat(owner, { ...member, planStartedAt: seat.startedAt })
    return true
  }

  // Quyền lợi đã bị hạ (chủ từng hết hạn giữa chừng…) mà chủ nay còn hạn → cấp lại
  await grantSeat(owner, member)
  return true
}

/**
 * Mời một người vào nhà (theo email tài khoản MN-Qronx).
 * Người được mời KHÔNG cần trả tiền — đó chính là lý do có gói này.
 */
export async function inviteMember(ownerId, { email, note } = {}) {
  const owner = await loadActiveOwner(ownerId)

  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) throw ApiError.badRequest('Cần email của người bạn muốn mời')

  const memberCount = await prisma.familyMember.count({ where: { ownerId } })
  if (seatsLeft(memberCount) <= 0) {
    throw ApiError.badRequest(
      `Nhà bạn đã đủ ${MAX_FAMILY_SEATS} tài khoản (gồm bạn). Bớt một người rồi mời người khác.`,
    )
  }

  const target = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
    select: {
      userId: true,
      fullName: true,
      email: true,
      plan: true,
      planExpiresAt: true,
      isActive: true,
    },
  })
  if (!target) {
    throw ApiError.badRequest(
      `${cleanEmail} chưa có tài khoản MN-Qronx. Hãy rủ họ đăng ký (miễn phí), rồi mời lại.`,
      { needInvite: true, email: cleanEmail },
    )
  }
  if (target.userId === ownerId) throw ApiError.badRequest('Bạn đang là chủ gói rồi')

  // Một người chỉ nằm trong một nhà: vừa tránh bị hai gói cùng lúc, vừa tránh
  // trường hợp chủ một nhà bị "kéo" vào nhà khác và gói của người đó mất quyền.
  const elsewhere = await prisma.familyMember.findFirst({
    where: { OR: [{ memberId: target.userId }, { ownerId: target.userId }] },
  })
  if (elsewhere?.ownerId === target.userId) {
    throw ApiError.badRequest(
      `${target.fullName} đang là chủ một gói Pro Gia đình khác nên không thể vào thêm nhà bạn.`,
    )
  }
  if (elsewhere) {
    throw ApiError.badRequest(`${target.fullName} đã nằm trong một gói Pro Gia đình khác rồi.`)
  }

  // Người này đang là CHỦ một nhà khác: trước hết vì tự trả tiền, nhưng lỗi phải
  // nói đúng lý do — nếu không thì chủ nhà kia tưởng mình chỉ "đang trả phí" chứ
  // không hiểu mình đang có trách nhiệm với cả một gói.
  if (target.plan === 'FAMILY' && !isPlanExpired(target)) {
    throw ApiError.badRequest(
      `${target.fullName} đang là chủ một gói Pro Gia đình khác nên không thể vào thêm nhà bạn.`,
    )
  }

  // Người này đang tự trả tiền (hoặc còn hạn Pro/Plus) → giữ chỗ cho người chưa có,
  // chứ không cướp khách đang trả phí của app.
  if (target.plan !== 'FREE' && !isPlanExpired(target)) {
    throw ApiError.badRequest(
      `${target.fullName} đang có gói trả phí riêng nên không cần chia sẻ chỗ — hãy mời người đang dùng gói Miễn phí.`,
    )
  }

  await prisma.familyMember.create({
    data: {
      ownerId,
      memberId: target.userId,
      note: note ? String(note).trim().slice(0, 255) : null,
    },
  })
  await grantSeat(owner, target)

  await notify(target.userId, {
    title: '🏠 Bạn được mời vào gói Pro Gia đình',
    body: `${owner.fullName || 'Một người'} thêm bạn vào gói Pro Gia đình — giờ bạn có nhắc dai, báo cáo và kế hoạch tuần.`,
    url: '/app/billing',
  })

  return listFamily(ownerId)
}

/** Gỡ một người khỏi nhà (chủ gói làm). Người đó mất quyền Pro ngay lập tức. */
export async function removeMember(ownerId, memberId) {
  await loadActiveOwner(ownerId)

  const row = await prisma.familyMember.findFirst({
    where: { ownerId, memberId: Number(memberId) },
    include: { member: { select: { userId: true, fullName: true } } },
  })
  if (!row) throw ApiError.notFound('Không tìm thấy người trong gói gia đình này')

  await prisma.familyMember.delete({ where: { familyMemberId: row.familyMemberId } })
  const dropped = await revokeSeat(row.memberId)

  if (dropped) {
    await notify(row.memberId, {
      title: '🏠 Bạn không còn trong gói Pro Gia đình',
      body: 'Chủ gói đã gỡ bạn khỏi nhà — quyền lợi Pro kết thúc ở đây, dữ liệu của bạn vẫn còn nguyên.',
      url: '/app/billing',
    })
  }

  return listFamily(ownerId)
}

/** Người trong nhà tự rời đi (muốn mua gói riêng hoặc không muốn dùng chung nữa). */
export async function leaveFamily(userId) {
  const row = await prisma.familyMember.findFirst({
    where: { memberId: userId },
    include: { owner: { select: { userId: true, fullName: true, email: true } } },
  })
  if (!row) throw ApiError.badRequest('Bạn không nằm trong gói Pro Gia đình nào')

  const me = await prisma.user.findUnique({ where: { userId }, select: { fullName: true } })

  await prisma.familyMember.delete({ where: { familyMemberId: row.familyMemberId } })
  await revokeSeat(userId)

  await notify(row.ownerId, {
    title: '🏠 Có người đã rời gói gia đình',
    body: `${me?.fullName || 'Một thành viên'} đã rời gói Pro Gia đình của bạn — còn một chỗ trống để mời người khác.`,
    url: '/app/billing',
  })

  return { left: true, ownerId: row.ownerId }
}

/**
 * Trạng thái gói gia đình của người gọi — cả hai phía (chủ gói và người trong
 * nhà) xem cùng một màn hình, chỉ khác phần quyền thao tác.
 */
export async function listFamily(userId) {
  const owned = await prisma.familyMember.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    include: {
      member: {
        select: {
          userId: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          plan: true,
          planExpiresAt: true,
        },
      },
    },
  })
  const membership = await prisma.familyMember.findFirst({
    where: { memberId: userId },
    include: {
      owner: {
        select: { userId: true, fullName: true, email: true, plan: true, planExpiresAt: true },
      },
    },
  })

  const me = await prisma.user.findUnique({
    where: { userId },
    select: { plan: true, planExpiresAt: true },
  })

  const ownerActive =
    me?.plan === 'FAMILY' && me.planExpiresAt && new Date(me.planExpiresAt) > new Date()

  return {
    role: owned.length > 0 ? 'OWNER' : membership ? 'MEMBER' : null,
    ownerActive: Boolean(ownerActive),
    maxSeats: MAX_FAMILY_SEATS,
    seatsUsed: owned.length + 1,
    seatsLeft: seatsLeft(owned.length),
    expiresAt: ownerActive ? me.planExpiresAt : null,
    owner: membership
      ? {
          userId: membership.owner.userId,
          fullName: membership.owner.fullName,
          email: membership.owner.email,
          expiresAt: membership.owner.planExpiresAt,
          ownerActive:
            membership.owner.plan === 'FAMILY' &&
            membership.owner.planExpiresAt &&
            new Date(membership.owner.planExpiresAt) > new Date(),
        }
      : null,
    // Người trong nhà thấy được chủ gói có đang xem tiến độ của mình hay không
    progressShared: membership ? membership.shareProgress : null,
    members: owned.map((row) => ({
      familyMemberId: row.familyMemberId,
      userId: row.member.userId,
      fullName: row.member.fullName,
      email: row.member.email,
      avatarUrl: row.member.avatarUrl,
      note: row.note,
      joinedAt: row.createdAt,
      expiresAt: row.member.planExpiresAt,
    })),
  }
}

// ─── "Cả nhà hôm nay" — chủ gói nhìn tiến độ người trong nhà ─

/** Trạng thái còn phải làm. Việc đã xong/huỷ không bao giờ tính là quá hạn. */
const OPEN_STATUSES = ['TODO', 'IN_PROGRESS']

/**
 * Số liệu của MỘT tài khoản. Một hàm duy nhất cho chủ gói lẫn từng thành viên:
 * hai chỗ đếm hai kiểu là cách chắc chắn nhất để màn hình "cả nhà" nói dối.
 *
 * Ngày tính theo giờ Việt Nam (dateUtils.startOfDay) — "hôm nay" của khách không
 * phải "hôm nay" của máy chủ UTC.
 */
async function progressOf(userId, now) {
  const today = startOfDay(now)
  const weekStart = startOfDay(addDays(now, -6))

  const [doneToday, doneWeek, open, overdue, worst] = await Promise.all([
    prisma.task.count({
      where: { userId, deletedAt: null, status: 'COMPLETED', completedAt: { gte: today } },
    }),
    prisma.task.count({
      where: { userId, deletedAt: null, status: 'COMPLETED', completedAt: { gte: weekStart } },
    }),
    prisma.task.count({
      where: { userId, deletedAt: null, status: { in: OPEN_STATUSES } },
    }),
    prisma.task.count({
      where: { userId, deletedAt: null, status: { in: OPEN_STATUSES }, dueAt: { lt: now } },
    }),
    // Việc quá hạn LÂU NHẤT trước — đây mới là thứ cần nhắc, không phải việc trễ 5 phút
    prisma.task.findMany({
      where: { userId, deletedAt: null, status: { in: OPEN_STATUSES }, dueAt: { lt: now } },
      orderBy: { dueAt: 'asc' },
      take: 3,
      select: { taskId: true, title: true, dueAt: true },
    }),
  ])

  return { doneToday, doneWeek, open, overdue, worst }
}

/**
 * Bảng "Cả nhà hôm nay" — CHỈ chủ gói xem được.
 *
 * Vì sao là quyền lợi riêng của gói gia đình chứ không phải một trang cho mọi
 * người: người trả tiền cho cả nhà cần một lý do để trả 199.000đ thay vì 79.000đ,
 * mà lý do bền nhất là thấy được cả nhà đang tiến bộ tới đâu. Người trong nhà
 * luôn tắt được phần chia sẻ này (`shareProgress`) và biết rõ là đang bật.
 */
export async function getFamilyBoard(ownerId, { now = new Date() } = {}) {
  const owner = await prisma.user.findUnique({
    where: { userId: ownerId },
    select: { userId: true, fullName: true, avatarUrl: true, plan: true, planExpiresAt: true, email: true },
  })
  if (!owner) throw ApiError.notFound('Không tìm thấy người dùng')

  if (owner.plan !== 'FAMILY' || isPlanExpired(owner)) {
    // Người trong nhà gõ đúng địa chỉ này là chuyện thường (menu ai cũng thấy).
    // Nói cho họ biết trang của họ dùng để làm gì, thay vì đọc câu bán gói.
    const membership = await prisma.familyMember.findFirst({
      where: { memberId: ownerId },
      select: { familyMemberId: true },
    })
    throw ApiError.badRequest(
      membership
        ? 'Bảng "Cả nhà" chỉ chủ gói (người trả tiền) xem được. Bạn đang dùng chỗ trong gói của người khác — mục Cả nhà của bạn dùng để bật/tắt chia sẻ tiến độ.'
        : 'Bảng "Cả nhà" là quyền lợi của gói Pro Gia đình. Mua gói để cả nhà dùng chung và thấy cả nhà đang tới đâu.',
    )
  }

  const rows = await prisma.familyMember.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'asc' },
    include: {
      member: { select: { userId: true, fullName: true, avatarUrl: true, email: true } },
    },
  })

  const meProfile = await prisma.user.findUnique({
    where: { userId: ownerId },
    select: { userId: true, fullName: true, avatarUrl: true },
  })
  const me = { ...(await progressOf(ownerId, now)), ...meProfile, shared: true }

  const members = []
  for (const row of rows) {
    const person = {
      userId: row.member.userId,
      fullName: row.member.fullName,
      email: row.member.email,
      avatarUrl: row.member.avatarUrl,
      joinedAt: row.createdAt,
      note: row.note,
    }
    // Không chia sẻ thì KHÔNG trả số liệu — che ở giao diện là chưa đủ, dữ liệu
    // của người ta không được rời máy chủ.
    members.push(
      row.shareProgress ? { ...person, shared: true, ...(await progressOf(row.member.userId, now)) } : { ...person, shared: false },
    )
  }

  const shared = members.filter((m) => m.shared)
  const totals = [me, ...shared].reduce(
    (acc, p) => ({
      doneToday: acc.doneToday + p.doneToday,
      doneWeek: acc.doneWeek + p.doneWeek,
      open: acc.open + p.open,
      overdue: acc.overdue + p.overdue,
    }),
    { doneToday: 0, doneWeek: 0, open: 0, overdue: 0 },
  )

  return {
    me,
    members,
    totals,
    hiddenCount: members.length - shared.length,
    expiresAt: owner.planExpiresAt,
    maxSeats: MAX_FAMILY_SEATS,
  }
}

/** Người trong nhà tự quyết định có cho chủ gói xem tiến độ của mình hay không. */
export async function setProgressSharing(userId, shared) {
  const row = await prisma.familyMember.findFirst({ where: { memberId: userId } })
  if (!row) throw ApiError.badRequest('Bạn không nằm trong gói Pro Gia đình nào')

  const updated = await prisma.familyMember.update({
    where: { familyMemberId: row.familyMemberId },
    data: { shareProgress: Boolean(shared) },
  })
  return { shared: updated.shareProgress }
}

export default {
  inviteMember,
  removeMember,
  leaveFamily,
  listFamily,
  getFamilyBoard,
  setProgressSharing,
  syncFamilySeats,
  seatsLeft,
  MAX_FAMILY_SEATS,
}
