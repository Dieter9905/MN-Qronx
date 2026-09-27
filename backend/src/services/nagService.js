import { PLANS } from '../utils/planLimits.js'
import { addMinutes } from '../utils/dateUtils.js'
import ApiError from '../utils/ApiError.js'

/**
 * Nhắc dai (gói Pro) — "nhắc là nhớ" chứ không phải nhắc một lần rồi thôi.
 *
 * Luồng: cron mỗi phút đọc reminder đến hạn → gửi thông báo → nếu việc CHƯA xong
 * và việc có bật nhắc dai thì đặt lại chính reminder đó vào tương lai gần. Người
 * dùng bấm "Xong" là mọi reminder của việc bị huỷ, nên chuông tự im ngay.
 *
 * Trần NAG_MAX_REPEATS để không bao giờ thành spam: hết trần thì im, việc vẫn nằm
 * trong danh sách quá hạn như bình thường.
 */
export const NAG_INTERVALS = [1, 2, 5, 10, 15, 30]
export const NAG_MAX_REPEATS = 10

/**
 * Chuẩn hoá & kiểm tra giá trị "nhắc dai" người dùng gửi lên.
 * Trả về số phút hợp lệ, hoặc null nghĩa là tắt.
 *
 * @param {*} value Giá trị từ client (số, chuỗi, null, '' …)
 * @returns {number|null}
 */
export function parseNagEveryMinutes(value) {
  if (value === undefined || value === null || value === '' || value === 0 || value === '0') {
    return null
  }
  const every = Number(value)
  if (!NAG_INTERVALS.includes(every)) {
    throw ApiError.badRequest(
      `Chu kỳ nhắc lại không hợp lệ. Chọn một trong: ${NAG_INTERVALS.join(', ')} phút.`
    )
  }
  return every
}

/**
 * Kiểm tra quyền dùng "nhắc dai" theo gói. Gói chưa có quyền mà vẫn gửi giá trị
 * thì báo lỗi rõ ràng kèm chỉ dẫn nâng cấp — im lặng bỏ qua sẽ khiến người dùng
 * tưởng đã bật mà chuông vẫn kêu một lần.
 *
 * @param {string} plan FREE | PLUS | PRO
 * @param {number|null} every
 */
export function assertNagAllowed(plan, every) {
  if (!every) return
  if (!PLANS[plan]?.nagReminders) {
    throw ApiError.badRequest(
      'Nhắc dai (nhắc lại tới khi bạn xác nhận) là tính năng của gói Pro. Nâng cấp để không bỏ lỡ việc quan trọng.'
    )
  }
}

/**
 * Lần nhắc kế tiếp cho một reminder vừa kêu, hoặc null nếu không nhắc nữa.
 *
 * Kiểm tra cả GÓI: người dùng hết hạn Pro thì việc cũ không tiếp tục nhắc dai —
 * nếu không, hết hạn gói rồi chuông vẫn kêu mãi là hành xử khó hiểu.
 */
export function nextNagPlan({ task, user, reminder } = {}) {
  const every = Number(task?.nagEveryMinutes || 0)
  if (!every || every <= 0) return null
  if (!PLANS[user?.plan]?.nagReminders) return null

  const status = task?.status
  if (status === 'COMPLETED' || status === 'CANCELLED') return null

  const done = Number(reminder?.nagCount || 0)
  if (done >= NAG_MAX_REPEATS) return null

  return {
    remindAt: addMinutes(new Date(), every),
    count: done + 1,
    every,
  }
}

/** Tiêu đề thông báo: lần đầu nhắc như thường, các lần sau nói rõ là nhắc lại. */
export function nagNotificationText(task, nagCount = 0) {
  const title = task?.title || 'Công việc'
  if (nagCount > 0) {
    return {
      title: `⏰ Nhắc lại lần ${nagCount}: ${title}`,
      body: 'Việc này vẫn chưa xong — bấm Xong để thôi nhắc.',
    }
  }
  return { title: `⏰ ${title}`, body: `Đến giờ làm: ${title}` }
}

export default {
  NAG_INTERVALS,
  NAG_MAX_REPEATS,
  nextNagPlan,
  nagNotificationText,
  parseNagEveryMinutes,
  assertNagAllowed,
}
