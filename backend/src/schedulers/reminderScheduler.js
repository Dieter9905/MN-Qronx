import cron from 'node-cron'
import prisma from '../config/prisma.js'
import { downgradeExpiredPlans } from '../utils/planLimits.js'
import { dispatchReminder } from '../services/reminderDispatchService.js'
import taskRepo from '../repositories/taskRepo.js'

// ─── Reminder Scheduler ────────────────────────────────
// Chạy mỗi 1 phút: quét DB tìm reminder SCHEDULED đã đến hạn

const TASK = '*/1 * * * *' // Mỗi 1 phút

// Thùng rác giữ việc 30 ngày rồi mới xoá thật — mỗi ngày dọn một lần là đủ
const TRASH_KEEP_DAYS = 30
const PURGE_EVERY_MS = 24 * 60 * 60_000
let lastPurgeAt = 0

async function purgeTrashIfDue() {
  if (Date.now() - lastPurgeAt < PURGE_EVERY_MS) return
  lastPurgeAt = Date.now()
  try {
    const removed = await taskRepo.purgeExpired(TRASH_KEEP_DAYS)
    if (removed > 0) {
      console.log(`[Scheduler] Đã xoá vĩnh viễn ${removed} việc ở thùng rác quá ${TRASH_KEEP_DAYS} ngày`)
    }
  } catch (err) {
    console.error('[Scheduler] Lỗi dọn thùng rác:', err.message)
  }
}

cron.schedule(TASK, async () => {
  const now = new Date()
  console.log(`[Scheduler] Quét reminders lúc ${now.toISOString()}`)

  // Dọn thùng rác: việc đã xoá quá 30 ngày thì xoá thật
  purgeTrashIfDue()

  // Tự động hạ gói trả phí đã quá hạn xuống FREE
  try {
    const downgraded = await downgradeExpiredPlans()
    if (downgraded > 0) {
      console.log(`[Scheduler] Đã hạ ${downgraded} gói trả phí hết hạn xuống FREE`)
    }
  } catch (err) {
    console.error('[Scheduler] Lỗi hạ gói hết hạn:', err.message)
  }

  try {
    // Tìm tất cả reminder SCHEDULED đã đến hạn
    const dueReminders = await prisma.reminder.findMany({
      where: {
        status: 'SCHEDULED',
        remindAt: { lte: now },
      },
      include: {
        task: {
          include: {
            user: {
              include: {
                devices: { where: { isActive: true } },
              },
            },
          },
        },
      },
    })

    if (dueReminders.length === 0) {
      console.log(`[Scheduler] Không có reminder đến hạn`)
      return
    }

    console.log(`[Scheduler] Tìm thấy ${dueReminders.length} reminder đến hạn`)

    for (const reminder of dueReminders) {
      try {
        // Việc gửi (Web Push + FCM) và việc hẹn nhắc lại nằm trong service để
        // test được trực tiếp — xem services/reminderDispatchService.js
        await dispatchReminder(reminder)
      } catch (err) {
        console.error(
          `[Scheduler] Lỗi xử lý reminder ${reminder.reminderId}:`,
          err.message,
        )
      }
    }
  } catch (err) {
    console.error('[Scheduler] Lỗi quét reminders:', err)
  }
})

console.log('[Scheduler] Reminder Scheduler đã khởi động (mỗi 1 phút)')
