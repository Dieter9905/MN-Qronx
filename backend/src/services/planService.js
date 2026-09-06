import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'

// ─── Nâng cấp gói (mô phỏng thanh toán) ────────────────

export async function upgrade(userId, plan) {
  if (!['PLUS', 'PRO'].includes(plan)) {
    throw ApiError.badRequest('Chỉ có thể nâng cấp lên gói PLUS hoặc PRO')
  }

  return prisma.user.update({
    where: { userId },
    data: { plan },
    select: {
      userId: true,
      fullName: true,
      email: true,
      plan: true,
    },
  })
}

// ─── Gói hiện tại ───────────────────────────────────────

export async function getMyPlan(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, plan: true },
  })
  return { plan: user?.plan || 'FREE' }
}