import cron from 'node-cron'
import { billingSettings } from '../services/billingService.js'
import { syncBankTransactions } from '../services/bankApiService.js'

// ─── Đồng bộ giao dịch ngân hàng qua API ────────────────────
// Chạy mỗi phút và TỰ QUYẾT ĐỊNH có làm gì hay không: chỉ gọi API ngân hàng khi
// admin đã bật đồng bộ và đã qua chu kỳ (mặc định 5 phút). Nhờ vậy đổi chu kỳ
// trong app là ăn liền, không cần cấu hình cron rồi deploy lại.

const TASK = '* * * * *'

let busy = false

/** Trả về true nếu lần này thực sự gọi API ngân hàng. */
export async function runBankSyncIfDue() {
  if (busy) return false

  const settings = await billingSettings()
  if (!settings?.syncEnabled) return false

  const intervalMinutes = Math.max(1, Number(settings.syncIntervalMinutes) || 5)
  const last = settings.lastSyncAt ? new Date(settings.lastSyncAt).getTime() : 0
  if (last && Date.now() - last < intervalMinutes * 60_000) return false

  busy = true
  try {
    const result = await syncBankTransactions({ trigger: 'SCHEDULER' })
    if (result.ok) {
      if (result.fetched) console.log(`[BankSync] ${result.message}`)
    } else if (!result.skipped) {
      console.error(`[BankSync] Lỗi: ${result.message}`)
    }
    return true
  } finally {
    busy = false
  }
}

cron.schedule(TASK, () => {
  runBankSyncIfDue().catch((err) => console.error('[BankSync] Lỗi không mong đợi:', err.message))
})

console.log('[BankSync] Đồng bộ giao dịch ngân hàng qua API đã khởi động (kiểm tra mỗi phút)')
