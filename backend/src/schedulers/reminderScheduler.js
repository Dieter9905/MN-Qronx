import cron from 'node-cron'
import prisma from '../config/prisma.js'
import { sendFcmNotification } from '../notifications/fcmSender.js'
import { downgradeExpiredPlans } from '../utils/planLimits.js'
import { pushToUser } from '../services/pushService.js'
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
        // 1. Đánh dấu TRIGGERED
        await prisma.reminder.update({
          where: { reminderId: reminder.reminderId },
          data: { status: 'TRIGGERED' },
        })

        // 2. Gửi Push đến từng device
        const payload = {
          title: `⏰ ${reminder.task.title}`,
          body: `Đến giờ làm: ${reminder.task.title}`,
          taskId: reminder.task.taskId,
          reminderId: reminder.reminderId,
        }

        // Web Push cho trình duyệt: chạy TẠI MÁY CHỦ nên nhắc nhở vẫn kêu khi
        // người dùng ĐÓNG tab — trước đây app chỉ kêu khi còn mở (polling 60s),
        // nên báo thức im lặng đúng lúc cần nhất.
        try {
          const push = await pushToUser(reminder.task.user.userId, payload)
          if (push.total > 0 && push.ok === 0) {
            console.warn(
              `[Scheduler] Không gửi được Web Push nào cho user ${reminder.task.user.userId} (${push.total} subscription)`
            )
          }
        } catch (err) {
          console.error('[Scheduler] Lỗi gửi Web Push:', err.message)
        }

        for (const device of reminder.task.user.devices) {
          try {
            if (device.platform !== 'WEB') {
              await sendFcmNotification(device.deviceToken, payload)
            }

            // 3. Ghi log
            await prisma.notificationLog.create({
              data: {
                reminderId: reminder.reminderId,
                deviceId: device.deviceId,
                action: 'SENT',
              },
            })
          } catch (err) {
            console.error(
              `[Scheduler] Lỗi gửi device ${device.deviceId}:`,
              err.message,
            )
          }
        }
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
