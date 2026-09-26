import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { PLANS, isPlanExpired, downgradeUser } from '../utils/planLimits.js'
import * as billingService from './billingService.js'

// ─── Gói hiện tại ───────────────────────────────────────
// LƯU Ý: nâng cấp gói mô phỏng (ai bấm nút là thành Pro) đã bị GỠ BỎ. Muốn có
// gói trả phí thì phải đi qua /billing/orders (chuyển khoản) hoặc Play Billing
// trong app Android. Gói đã quá hạn được hạ ngay khi user xem thông tin gói.

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
    daysLeft: user.planExpiresAt
      ? Math.ceil((new Date(user.planExpiresAt) - Date.now()) / 86400000)
      : null,
    limits: PLANS[user.plan] || PLANS.FREE,
  }
}

export default { getMyPlan }
