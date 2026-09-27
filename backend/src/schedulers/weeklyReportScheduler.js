import cron from 'node-cron'
import { sendWeeklyReports, DEFAULT_BATCH } from '../services/weeklyReportService.js'

// ─── Báo cáo tuần qua email ─────────────────────────────────
// Gửi vào SÁNG THỨ 2 (07:00–10:00 giờ Việt Nam) — đúng lúc khách ngồi lên kế hoạch
// cho tuần mới, nên thư vừa là báo cáo vừa là lời nhắc mở app.
//
// Chạy mỗi 15 phút và tự quyết định, giống nhắc gia hạn gói:
//   • chỉ làm trong khung giờ trên, chỉ ngày thứ 2;
//   • mỗi lượt gửi một lô nhỏ (DEFAULT_BATCH) vì tài khoản Mailjet đang bị giới hạn
//     10 thư/giờ — gặp trần thì dừng và các lượt sau gửi tiếp;
//   • cột weeklyReportSentAt bảo đảm mỗi khách đúng MỘT thư mỗi tuần, dù cron và
//     nhịp /health gọi bao nhiêu lần.
//
// Máy chủ Render gói free ngủ sau 15 phút không có request, nên cron có thể không
// chạy: server.js gọi hàm này ở mỗi nhịp /health để bắt kịp khi máy tỉnh dậy.

const TASK = '*/15 * * * *'
const RUN_EVERY_MS = 15 * 60_000
const SEND_FROM_HOUR = 7
const SEND_UNTIL_HOUR = 10 // sau 10:00 thì để tuần sau, không làm phiền giữa ngày
const SEND_WEEKDAY = 1 // ISO: 1 = Thứ 2

let busy = false
let lastRunAt = 0

/** Ngày/giờ theo giờ Việt Nam (Render chạy UTC → không được dùng giờ máy chủ). */
function vietnamNow(when = new Date()) {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(when)
  )
  return { key, hour, weekday: new Date(`${key}T00:00:00Z`).getUTCDay() }
}

/**
 * Có đang trong khung gửi thư không: Thứ 2, 07:00–10:00 giờ Việt Nam.
 * Tách riêng để test được "3 giờ sáng thứ 4 thì không gửi" mà không phải chờ đồng hồ.
 */
export function isSendWindow(when = new Date()) {
  const { hour, weekday } = vietnamNow(when)
  return weekday === SEND_WEEKDAY && hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR
}

/**
 * Gửi báo cáo tuần nếu đang đúng kỳ.
 * @param {{force?: boolean, limit?: number, now?: Date}} options
 * @returns {Promise<object|null>} kết quả gửi, hoặc null nếu lượt này bỏ qua
 */
export async function runWeeklyReportsIfDue({
  force = false,
  limit = DEFAULT_BATCH,
  now,
  recipients,
} = {}) {
  if (busy) return null

  if (!force) {
    if (!isSendWindow()) return null
    if (Date.now() - lastRunAt < RUN_EVERY_MS) return null
  }

  busy = true
  try {
    const result = await sendWeeklyReports({ now: now || new Date(), limit, recipients })
    lastRunAt = Date.now()
    if (result.candidates > 0) {
      console.log(
        `[WeeklyReport] Gửi ${result.sent}/${result.candidates} thư` +
          (result.failed ? `, ${result.failed} lỗi` : '') +
          (result.quotaReached ? ' — chạm hạn mức gửi thư, để lượt sau' : '')
      )
    }
    return result
  } catch (err) {
    console.error('[WeeklyReport] Lỗi gửi báo cáo tuần:', err.message)
    return null
  } finally {
    busy = false
  }
}

cron.schedule(TASK, () => {
  runWeeklyReportsIfDue().catch((err) => console.error('[WeeklyReport] Lỗi không mong đợi:', err.message))
})

console.log('[WeeklyReport] Báo cáo tuần qua email đã khởi động (Thứ 2, 07:00–10:00 giờ VN)')
