import prisma from '../config/prisma.js'
import ApiError from './ApiError.js'

const PAID_PLANS = ['PLUS', 'PRO']

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
 * Kiểm tra gói trả phí của user đã quá hạn hay chưa.
 * @param {{ plan?: string, planExpiresAt?: Date|string|null }} user
 * @returns {boolean}
 */
export function isPlanExpired(user) {
  return (
    !!user &&
    PAID_PLANS.includes(user.plan) &&
    !!user.planExpiresAt &&
    new Date(user.planExpiresAt) <= new Date()
  )
}

/**
 * Hạ gói của một user xuống FREE khi đã quá hạn (kèm xoá mốc thời gian
 * và đưa âm thanh báo thức tùy chỉnh về chuông mặc định).
 * @param {number} userId
 * @returns {Promise<boolean>} true nếu đã hạ gói
 */
export async function downgradeUser(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { plan: true, planExpiresAt: true },
  })
  if (!user || !isPlanExpired(user)) return false

  await prisma.user.update({
    where: { userId },
    data: { plan: 'FREE', planStartedAt: null, planExpiresAt: null },
  })
  // Âm thanh import chỉ dành cho gói trả phí → về chuông mặc định
  await prisma.notificationSetting.updateMany({
    where: { userId, alarmSound: { startsWith: 'custom:' } },
    data: { alarmSound: 'classic' },
  })
  return true
}

/**
 * Quét toàn bộ user có gói trả phí đã quá hạn → hạ xuống FREE.
 * Dùng cho scheduler (mỗi 1 phút) để đảm bảo hạn áp dụng kể cả khi user không truy cập.
 * @returns {Promise<number>} số user đã hạ gói
 */
export async function downgradeExpiredPlans() {
  const now = new Date()
  const res = await prisma.user.updateMany({
    where: { plan: { in: PAID_PLANS }, planExpiresAt: { lt: now } },
    data: { plan: 'FREE', planStartedAt: null, planExpiresAt: null },
  })

  if (res.count > 0) {
    // Đưa âm thanh tùy chỉnh của các user vừa hạ gói về chuông mặc định
    // (chỉ nhắm user đang FREE – user trả phí đang hoạt động không bị ảnh hưởng)
    await prisma.notificationSetting.updateMany({
      where: { alarmSound: { startsWith: 'custom:' }, user: { plan: 'FREE' } },
      data: { alarmSound: 'classic' },
    })
  }
  return res.count
}

/**
 * Lấy gói hiệu lực của user (FREE/PLUS/PRO).
 * Gói trả phí đã quá hạn được tính như FREE ngay lập tức
 * (scheduler / endpoint /me sẽ hạ gói vĩnh viễn sau đó).
 */
export async function getUserPlan(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { plan: true, planExpiresAt: true },
  })
  if (!user) return 'FREE'
  return isPlanExpired(user) ? 'FREE' : user.plan
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