import cron from 'node-cron'
import { sendRenewalReminders } from '../services/billingService.js'

// ─── Nhắc trước khi gói hết hạn ─────────────────────────────
// Chuyển khoản không tự gia hạn được, nên nhắc trước 3 ngày (kèm nút "Gia hạn
// ngay") là chốt giữ khách quan trọng nhất của hệ thống thanh toán này.
//
// Chạy mỗi phút và TỰ QUYẾT ĐỊNH: chỉ gửi khi nằm trong khung giờ 08:00–21:00
// theo giờ Việt Nam và đã qua chu kỳ 15 phút. Nhờ cột reminder_sent_at, mỗi kỳ
// chỉ gửi đúng một lần cho dù cron gọi bao nhiêu lần.

const TASK = '* * * * *'
const RUN_EVERY_MS = 15 * 60_000
const QUIET_FROM_HOUR = 8 // trước 08:00 không làm phiền người dùng
const QUIET_AFTER_HOUR = 21 // sau 21:00 cũng vậy

let busy = false
let lastRunAt = 0

/** Giờ hiện tại theo múi giờ Việt Nam (máy chủ Render chạy UTC). */
function vietnamHour() {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    hour12: false,
  }).format(new Date())
  return Number(formatted)
}

/**
 * Gửi nhắc trước hạn nếu đã qua chu kỳ và đang trong giờ hành chính.
 * @returns {Promise<object|null>} kết quả gửi, hoặc null nếu lần này bỏ qua
 */
export async function runRenewalRemindersIfDue({ force = false } = {}) {
  if (busy) return null

  if (!force) {
    const hour = vietnamHour()
    if (hour < QUIET_FROM_HOUR || hour >= QUIET_AFTER_HOUR) return null
    if (Date.now() - lastRunAt < RUN_EVERY_MS) return null
  }

  busy = true
  try {
    const result = await sendRenewalReminders({ daysBefore: 3 })
    lastRunAt = Date.now()
    if (result.due > 0) {
      console.log(
        `[RenewalReminder] Nhắc trước hạn: ${result.sent} đã gửi, ${result.failed} lỗi (còn ${result.due} kỳ đến hạn)`
      )
    }
    return result
  } catch (err) {
    console.error('[RenewalReminder] Lỗi nhắc trước hạn:', err.message)
    return null
  } finally {
    busy = false
  }
}

cron.schedule(TASK, () => {
  runRenewalRemindersIfDue().catch((err) =>
    console.error('[RenewalReminder] Lỗi không mong đợi:', err.message)
  )
})

console.log('[RenewalReminder] Nhắc trước khi gói hết hạn đã khởi động (08:00–21:00 VN, mỗi 15 phút)')
