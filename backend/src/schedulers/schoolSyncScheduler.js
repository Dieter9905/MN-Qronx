// ─── Đồng bộ TKB từ cổng trường mỗi ngày ──────────────────────────────────
// OneUni-style: người dùng kết nối tài khoản trường MỘT lần, sau đó hệ thống
// tự đăng nhập và cập nhật thời khoá biểu mỗi sáng — không cần bấm gì.
//
// Job chạy 05:00 giờ VN (trước giờ học buổi sáng) và cũng tranh thủ chạy sau
// mỗi nhịp /health: máy chủ Render gói free ngủ sau 15 phút, cron sẽ không
// chạy nếu không ai gọi, nên phải "bắt kịp" lúc máy tỉnh dậy.
import cron from 'node-cron'
import { syncAllConnectedSchools } from '../services/schoolScheduleService.js'

const TASK = '*/30 * * * *'
const RUN_EVERY_MS = 30 * 60_000
const SYNC_FROM_HOUR = 5
const SYNC_UNTIL_HOUR = 8 // sau 8:00 thì để mai, tránh dồn request giữa ngày

let busy = false
let lastRunAt = 0

function vietnamHour(when = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(when)
  )
}

/** Chỉ đồng bộ trong khung 05:00–08:00 giờ VN. */
export function isSchoolSyncWindow(when = new Date()) {
  const hour = vietnamHour(when)
  return hour >= SYNC_FROM_HOUR && hour < SYNC_UNTIL_HOUR
}

export async function runSchoolSyncIfDue({ force = false, now } = {}) {
  if (busy) return null
  if (!force) {
    if (!isSchoolSyncWindow(now)) return null
    if (Date.now() - lastRunAt < RUN_EVERY_MS) return null
  }

  busy = true
  try {
    const result = await syncAllConnectedSchools()
    lastRunAt = Date.now()
    if (result.total > 0) {
      console.log(
        `[SchoolSync] Đồng bộ TKB ${result.ok}/${result.total} tài khoản trường` +
          (result.failed ? `, ${result.failed} lỗi` : '')
      )
    }
    return result
  } catch (err) {
    console.error('[SchoolSync] Lỗi đồng bộ TKB trường:', err.message)
    return null
  } finally {
    busy = false
  }
}

cron.schedule(TASK, () => {
  runSchoolSyncIfDue().catch((err) => console.error('[SchoolSync] Lỗi không mong đợi:', err.message))
})

console.log('[SchoolSync] Đồng bộ TKB từ cổng trường đã khởi động (05:00–08:00 giờ VN)')
