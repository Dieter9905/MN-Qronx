import app from './app.js'
import './schedulers/reminderScheduler.js'
import { runBankSyncIfDue } from './schedulers/bankSyncScheduler.js'
import { runRenewalRemindersIfDue } from './schedulers/billingReminderScheduler.js'
import { runWeeklyReportsIfDue } from './schedulers/weeklyReportScheduler.js'
import { runSchoolSyncIfDue } from './schedulers/schoolSyncScheduler.js'
import { onHealthPing } from './routes/index.js'
import config from './config/index.js'

// Mỗi lần có người gọi /health (dịch vụ keep-alive gọi đều đặn), kiểm tra xem đã
// đến kỳ đồng bộ giao dịch ngân hàng chưa. Nhờ vậy máy chủ ngủ trên gói free vẫn
// đối soát được thanh toán ngay sau khi tỉnh, không phải chờ cron.

// ── Start server ───────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log(`[TaskAlarm] Server đang chạy trên port ${config.port} (${config.nodeEnv})`)
  console.log(`[TaskAlarm] Swagger UI: http://localhost:${config.port}/docs`)
  console.log(`[TaskAlarm] Reminder Scheduler đã khởi động (mỗi 1 phút)`)
})

onHealthPing(() => {
  runBankSyncIfDue().catch((err) => console.error('[BankSync] Lỗi khi kiểm tra theo nhịp health:', err.message))
  // Nhắc trước khi gói hết hạn: cron có thể ngủ cùng máy, nên cũng cho chạy
  // ngay sau mỗi lần tỉnh dậy để khách không bị lỡ email nhắc.
  runRenewalRemindersIfDue().catch((err) =>
    console.error('[RenewalReminder] Lỗi khi kiểm tra theo nhịp health:', err.message)
  )
  // Báo cáo tuần (thứ 2, sáng): máy chủ ngủ thì cron không chạy, nên tranh thủ gửi
  // ngay sau khi tỉnh — trễ vài giờ vẫn hơn mất cả tuần của khách Pro.
  runWeeklyReportsIfDue().catch((err) =>
    console.error('[WeeklyReport] Lỗi khi kiểm tra theo nhịp health:', err.message)
  )
  // TKB trường: khách kết nối tài khoản trường một lần, mỗi sáng tự cập nhật.
  runSchoolSyncIfDue().catch((err) =>
    console.error('[SchoolSync] Lỗi khi kiểm tra theo nhịp health:', err.message)
  )
})

// ── Graceful shutdown ──────────────────────────────────────
const shutdown = (signal) => {
  console.log(`\n[TaskAlarm] ${signal} received – shutting down gracefully...`)
  server.close(() => {
    console.log('[TaskAlarm] Server closed')
    process.exit(0)
  })

  // Force kill after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('[TaskAlarm] Forced shutdown after timeout')
    process.exit(1)
  }, 10_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('[TaskAlarm] Unhandled Rejection:', reason)
})
