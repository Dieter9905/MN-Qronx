import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { computePlanDates, daysLeft } from '../utils/planDates.js'
import { PLANS, isPlanExpired, downgradeUser } from '../utils/planLimits.js'

// ─── Nâng cấp gói (mô phỏng thanh toán, kỳ 30 ngày) ───

export async function upgrade(userId, plan) {
  if (!['PLUS', 'PRO'].includes(plan)) {
    throw ApiError.badRequest('Chỉ có thể nâng cấp lên gói PLUS hoặc PRO')
  }

  const current = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, fullName: true, email: true, plan: true, planStartedAt: true, planExpiresAt: true },
  })
  if (!current) throw ApiError.notFound('Không tìm thấy người dùng')

  const dates = computePlanDates({
    currentPlan: current.plan,
    currentStartedAt: current.planStartedAt,
    currentExpiresAt: current.planExpiresAt,
    newPlan: plan,
  })

  return prisma.user.update({
    where: { userId },
    data: { plan, ...dates },
    select: {
      userId: true,
      fullName: true,
      email: true,
      plan: true,
      planStartedAt: true,
      planExpiresAt: true,
    },
  })
}

// ─── Gói hiện tại ───────────────────────────────────────

export async function getMyPlan(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      plan: true,
      planStartedAt: true,
      planExpiresAt: true,
      updatedAt: true,
    },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')

  // Gói đã quá hạn → hạ FREE ngay
  if (isPlanExpired(user)) {
    await downgradeUser(userId)
    user.plan = 'FREE'
    user.planStartedAt = null
    user.planExpiresAt = null
  }

  return {
    plan: user.plan,
    planName: PLANS[user.plan]?.name || user.plan,
    planStartedAt: user.planStartedAt,
    planExpiresAt: user.planExpiresAt,
    daysLeft: daysLeft(user.planExpiresAt),
    limits: PLANS[user.plan] || PLANS.FREE,
  }
}