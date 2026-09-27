import prisma from '../config/prisma.js'
import { sendFcmNotification } from '../notifications/fcmSender.js'
import { pushToUser } from './pushService.js'
import { nextNagPlan, nagNotificationText } from './nagService.js'
import { reminderTargetsForTask } from './taskShareService.js'

/**
 * Gửi MỘT nhắc nhở đã đến hạn và quyết định có nhắc lại hay không.
 *
 * Tách khỏi `schedulers/reminderScheduler.js` vì hai lý do:
 *   1. Cron chỉ nên làm việc "tìm cái đến hạn rồi đưa cho hàm này" — logic gửi
 *      nằm ở đây nên **test được** bằng cách tạo dữ liệu thật rồi gọi trực tiếp,
 *      không phải chờ cron.
 *   2. Toàn bộ luật "nhắc dai" gói trong một hàm: gửi xong, việc chưa xong và
 *      người dùng còn quyền Pro → hẹn chính reminder đó kêu lại.
 *
 * @param {object} reminder Reminder kèm `task` (và `task.user` có `devices`, `plan`)
 * @returns {Promise<{ sent: number, nagged: boolean }>}
 */
export async function dispatchReminder(reminder) {
  const task = reminder.task
  const userId = task.user.userId

  // 1. Đánh dấu đã kích hoạt
  await prisma.reminder.update({
    where: { reminderId: reminder.reminderId },
    data: { status: 'TRIGGERED' },
  })

  // 2. Nội dung: các lần nhắc lại nói rõ "Nhắc lại lần N" để người dùng biết
  // chuông đang lặp vì việc chưa xong, chứ không phải app bị lỗi.
  const text = nagNotificationText(task, reminder.nagCount)
  const payload = {
    title: text.title,
    body: text.body,
    taskId: task.taskId,
    reminderId: reminder.reminderId,
  }

  // 3. Web Push cho trình duyệt: chạy TẠI MÁY CHỦ nên nhắc nhở vẫn kêu khi người
  // dùng ĐÓNG tab — trước đây app chỉ kêu khi còn mở (polling 60s), nên báo thức
  // im lặng đúng lúc cần nhất.
  try {
    const push = await pushToUser(userId, payload)
    if (push.total > 0 && push.ok === 0) {
      console.warn(`[Reminder] Không gửi được Web Push nào cho user ${userId} (${push.total} subscription)`)
    }
  } catch (err) {
    console.error('[Reminder] Lỗi gửi Web Push:', err.message)
  }

  // 4. Thiết bị di động (FCM) + ghi log từng thiết bị
  let sent = 0
  for (const device of task.user.devices || []) {
    try {
      if (device.platform !== 'WEB') {
        await sendFcmNotification(device.deviceToken, payload)
      }
      await prisma.notificationLog.create({
        data: {
          reminderId: reminder.reminderId,
          deviceId: device.deviceId,
          action: 'SENT',
        },
      })
      sent += 1
    } catch (err) {
      console.error(`[Reminder] Lỗi gửi device ${device.deviceId}:`, err.message)
    }
  }

  // 5. Nhắc dai (gói Pro): việc chưa xong thì hẹn chính reminder này kêu lại.
  // Bấm "Xong" là mọi reminder của việc đã bị CANCELLED nên chuông tự im; bỏ qua
  // thì chuông lặp tới khi xác nhận hoặc hết trần (không bao giờ thành spam).
  const nag = nextNagPlan({ task, user: task.user, reminder })
  if (nag) {
    await prisma.reminder.update({
      where: { reminderId: reminder.reminderId },
      data: {
        status: 'SCHEDULED',
        remindAt: nag.remindAt,
        nagCount: nag.count,
      },
    })
    console.log(
      `[Reminder] Nhắc dai: việc ${task.taskId} sẽ kêu lại sau ${nag.every} phút (lần ${nag.count})`
    )
  }

  // 6. Người ĐƯỢC GIAO việc cũng phải nghe chuông (gói Pro của chủ việc). Không
  // có bước này thì "nhờ người khác làm" chỉ là một dòng ghi chú: người nhận
  // không bao giờ biết tới lúc họ tự mở app.
  //
  // Cố ý CHỈ gửi Web Push cho người nhận, không ghi notificationLog: nhật ký
  // thông báo gắn với thiết bị để trang "Lịch sử thông báo" của CHỦ việc hiển
  // thị; ghi vào đó là báo sai người đã được nhắc. Người đã báo xong phần mình
  // (doneAt) thì thôi nhắc — họ đã làm xong việc của họ.
  // Ai nhận chuông là luật nằm ở taskShareService.reminderTargetsForTask (hàm
  // thuần, test được) — ở đây chỉ gửi cho những người đó, trừ chủ việc vì đã gửi.
  for (const assigneeId of reminderTargetsForTask(task, userId)) {
    if (assigneeId === userId) continue
    try {
      await pushToUser(assigneeId, {
        title: `👥 Việc bạn được nhờ: ${task.title}`,
        body: 'Bạn được nhờ làm việc này. Bấm để xem chi tiết.',
        taskId: task.taskId,
        reminderId: reminder.reminderId,
        url: '/app/assigned',
      })
    } catch (err) {
      console.error(`[Reminder] Không nhắc được người được giao ${assigneeId}:`, err.message)
    }
  }

  return { sent, nagged: Boolean(nag) }
}

export default { dispatchReminder }
