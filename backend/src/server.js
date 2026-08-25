import app from './app.js'
import './schedulers/reminderScheduler.js'
import config from './config/index.js'

// ── Start server ───────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log(`[TaskAlarm] Server đang chạy trên port ${config.port} (${config.nodeEnv})`)
  console.log(`[TaskAlarm] Swagger UI: http://localhost:${config.port}/docs`)
console.log(`[TaskAlarm] Reminder Scheduler đã khởi động (mỗi 1 phút)`)
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
