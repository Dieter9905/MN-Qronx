import cron from 'node-cron'
import prisma from '../config/prisma.js'
import { downgradeExpiredPlans } from '../utils/planLimits.js'
import { syncFamilySeats } from '../services/familyService.js'
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

  // Đồng bộ quyền lợi Pro của người trong nhà theo chủ gói: mọi đường cấp gói
  // (mua, admin tặng, đổi điểm, dùng thử) đều đi qua đây trong vòng 1 phút, nên
  // không phải vá từng đường. Chạy trước hay sau khi hạ gói đều được — service
  // tự kiểm hạn của chủ gói chứ không tin vào việc nó đã được hạ hay chưa.
  try {
    const family = await syncFamilySeats()
    if (family.revoked > 0 || family.granted > 0) {
      console.log(
        `[Scheduler] Gói gia đình: ${family.granted} chỗ được cấp/làm mới, ${family.revoked} chỗ bị thu hồi, ${family.ended} nhà kết thúc`,
      )
    }
  } catch (err) {
    console.error('[Scheduler] Lỗi đồng bộ gói gia đình:', err.message)
  }

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
            // Người được giao việc (gói Pro): lấy sẵn ở đây để dispatchReminder
            // nhắc luôn cho họ, không phải truy vấn thêm cho từng nhắc nhở.
            shares: { where: { doneAt: null }, select: { assigneeId: true, doneAt: true } },
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
