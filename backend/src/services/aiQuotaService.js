import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { PLANS, planLimit, isPlanExpired } from '../utils/planLimits.js'
import { vnDateKey } from './billingService.js'

// ─── Hạn mức dùng AI theo ngày ──────────────────────────────
// Trước đây AI chỉ dành cho gói Pro (khoá cứng) — nghĩa là phần lớn người dùng
// chưa từng thấy trợ lý AI làm được gì, mà đây lại chính là thứ khác biệt của
// MN-Qronx. Nay mọi gói đều dùng được với hạn mức theo ngày: FREE 5 lần, Plus 50
// lần, Pro không giới hạn. Ngày tính theo múi giờ Việt Nam.

/** Gói hiệu lực của user (tài khoản hết hạn tính như FREE). */
async function effectivePlan(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { plan: true, planExpiresAt: true },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  return isPlanExpired(user) ? 'FREE' : user.plan
}

function toLimit(value) {
  return value === Infinity ? null : value
}

/**
 * Xem hạn mức AI hiện tại mà KHÔNG trừ lượt (dùng để hiển thị và kiểm tra trước).
 * @returns {Promise<{date: string, plan: string, used: number, limit: number|null, remaining: number|null, unlimited: boolean}>}
 */
export async function getQuota(userId, now = new Date()) {
  const date = vnDateKey(now)
  const plan = await effectivePlan(userId)
  const limit = planLimit(plan, 'aiDailyLimit')
  const row = await prisma.aiUsage.findUnique({
    where: { userId_usageDate: { userId, usageDate: date } },
    select: { count: true },
  })
  const used = row?.count || 0
  const unlimited = limit === Infinity
  return {
    date,
    plan,
    planName: PLANS[plan]?.name || plan,
    used,
    limit: toLimit(limit),
    remaining: unlimited ? null : Math.max(0, limit - used),
    unlimited,
  }
}

/**
 * Kiểm tra còn lượt không, ném 429 kèm gợi ý nâng cấp nếu đã hết.
 */
export async function assertQuota(userId, now = new Date()) {
  const quota = await getQuota(userId, now)
  if (quota.unlimited) return quota
  if (quota.used >= quota.limit) {
    const nextPlan = quota.plan === 'FREE' ? 'Plus hoặc Pro' : 'Pro'
    throw ApiError.tooManyRequests(
      `Bạn đã dùng hết ${quota.limit} lượt trợ lý AI hôm nay của gói ${quota.planName}. ` +
        `Nâng cấp ${nextPlan} để có thêm lượt, hoặc quay lại vào ngày mai.`
    )
  }
  return quota
}

/**
 * Trừ một lượt AI (gọi SAU khi AI trả kết quả thành công, để lỗi mạng không làm
 * người dùng mất lượt).
 */
export async function consumeQuota(userId, now = new Date()) {
  const date = vnDateKey(now)
  const plan = await effectivePlan(userId)
  if (planLimit(plan, 'aiDailyLimit') === Infinity) return getQuota(userId, now)

  await prisma.aiUsage.upsert({
    where: { userId_usageDate: { userId, usageDate: date } },
    create: { userId, usageDate: date, count: 1 },
    update: { count: { increment: 1 } },
  })
  return getQuota(userId, now)
}

/** Lịch sử dùng AI vài ngày gần nhất (cho trang gói). */
export async function getRecentUsage(userId, days = 7, now = new Date()) {
  const from = new Date(now.getTime() - (days - 1) * 86400000)
  const rows = await prisma.aiUsage.findMany({
    where: { userId, usageDate: { gte: vnDateKey(from) } },
    orderBy: { usageDate: 'asc' },
  })
  const map = new Map(rows.map((r) => [r.usageDate, r.count]))
  const out = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = vnDateKey(new Date(now.getTime() - i * 86400000))
    out.push({ date: key, count: map.get(key) || 0 })
  }
  return out
}

export default { getQuota, assertQuota, consumeQuota, getRecentUsage }
