import { PAID_PLANS } from './planLimits.js'

/**
 * Tính ngày bắt đầu / hết hạn khi đổi gói (mô phỏng đăng ký 30 ngày/kỳ).
 *
 * Quy tắc:
 * - Về FREE → xoá mốc thời gian (gói miễn phí không giới hạn).
 * - Nâng cấp/gia hạn cùng gói trả phí đang còn hạn → giữ ngày bắt đầu,
 *   hết hạn cộng thêm 30 ngày (tính từ hạn hiện tại nếu chưa quá hạn).
 * - Đổi sang gói trả phí khác (hoặc đã hết hạn) → bắt đầu từ hôm nay,
 *   hết hạn sau 30 ngày.
 *
 * @param {object} params
 * @param {'FREE'|'PLUS'|'PRO'} params.currentPlan Gói hiện tại của user
 * @param {Date|null} params.currentStartedAt
 * @param {Date|null} params.currentExpiresAt
 * @param {'FREE'|'PLUS'|'PRO'} params.newPlan Gói mới muốn áp dụng
 * @param {number} [params.days=30] Số ngày của kỳ (đổi thưởng có thể dùng 7 ngày)
 * @param {Date} [params.now]
 * @returns {{ planStartedAt: Date|null, planExpiresAt: Date|null }}
 */
export function computePlanDates({ currentPlan, currentStartedAt, currentExpiresAt, newPlan, days = 30, now = new Date() }) {
  if (newPlan === 'FREE') {
    return { planStartedAt: null, planExpiresAt: null }
  }

  if (!PAID_PLANS.includes(newPlan)) {
    return { planStartedAt: null, planExpiresAt: null }
  }

  const stillActive =
    currentPlan === newPlan &&
    currentExpiresAt &&
    new Date(currentExpiresAt) > now

  // Gia hạn cùng gói còn hạn: cộng thêm days ngày từ ngày hết hạn hiện tại
  if (stillActive) {
    const expiresAt = new Date(currentExpiresAt)
    expiresAt.setDate(expiresAt.getDate() + days)
    return {
      planStartedAt: currentStartedAt || now,
      planExpiresAt: expiresAt,
    }
  }

  // Gói mới / đã hết hạn: kỳ mới days ngày từ hôm nay
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + days)
  return { planStartedAt: now, planExpiresAt: expiresAt }
}

/**
 * Số ngày còn lại của gói trả phí (âm nếu đã hết hạn, null khi chưa biết).
 * @param {Date|string|null} expiresAt
 * @param {Date} [now]
 * @returns {number|null}
 */
export function daysLeft(expiresAt, now = new Date()) {
  if (!expiresAt) return null
  const diff = Math.floor((new Date(expiresAt) - now) / 86400000)
  return diff
}
