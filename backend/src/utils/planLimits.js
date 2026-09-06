import prisma from '../config/prisma.js'
import ApiError from './ApiError.js'

// ─── Cấu hình giới hạn tính năng theo gói ───────────────────
// FREE  → Miễn phí (giới hạn cơ bản)
// PLUS  → Plus (mở rộng)
// PRO   → Pro (không giới hạn)
export const PLANS = {
  FREE: {
    name: 'Miễn phí',
    activeTasks: 10,
    remindersPerTask: 2,
    categories: 5,
    subtasksPerTask: 5,
    devices: 1,
    repeatTasks: false,
    alarmSounds: ['classic', 'DEFAULT', 'URGENT'],
  },
  PLUS: {
    name: 'Plus',
    activeTasks: 100,
    remindersPerTask: 5,
    categories: 20,
    subtasksPerTask: 50,
    devices: 3,
    repeatTasks: true,
    alarmSounds: ['classic', 'digital', 'bell', 'DEFAULT', 'URGENT'],
  },
  PRO: {
    name: 'Pro',
    activeTasks: Infinity,
    remindersPerTask: 5,
    categories: Infinity,
    subtasksPerTask: Infinity,
    devices: Infinity,
    repeatTasks: true,
    alarmSounds: ['classic', 'digital', 'bell', 'morning', 'gentle', 'DEFAULT', 'URGENT'],
  },
}

/**
 * Lấy gói hiện tại của user (FREE/PLUS/PRO).
 */
export async function getUserPlan(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { plan: true },
  })
  return user?.plan || 'FREE'
}

/**
 * Lấy giới hạn của một tính năng theo gói.
 */
export function planLimit(plan, key) {
  return PLANS[plan]?.[key] ?? Infinity
}

/**
 * Tạo lỗi giới hạn gói với thông điệp dễ hiểu.
 */
export function planLimitError({ feature, limit, plan = 'FREE', upgrade = 'Plus hoặc Pro' }) {
  const limitText = limit === Infinity ? 'không giới hạn' : limit
  return ApiError.badRequest(
    `Bạn đã đạt giới hạn ${limitText} ${feature} của gói Miễn phí. Nâng cấp lên gói ${upgrade} để mở rộng giới hạn.`
  )
}

export default { PLANS, getUserPlan, planLimit, planLimitError }