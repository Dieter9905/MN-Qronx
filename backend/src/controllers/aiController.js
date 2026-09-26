import * as aiService from '../services/aiService.js'
import * as aiQuotaService from '../services/aiQuotaService.js'
import ApiError from '../utils/ApiError.js'
import { success } from '../dto/response/apiResponse.js'

// Lỗi của dịch vụ AI riêng (self-hosted) → HTTP status đúng bản chất.
// Trước đây mọi lỗi rơi vào errorHandler và thành 500 "Lỗi hệ thống", không cho
// biết AI chưa deploy / sai URL / quá tải — rất khó lần khi kiểm thử.
const AI_ERROR_STATUS = {
  AI_NETWORK: 503,
  AI_TIMEOUT: 504,
  AI_HTTP: 502,
  AI_BAD_RESPONSE: 502,
  AI_EMPTY: 422,
}

/**
 * POST /api/v1/ai/parse-tasks
 * Gửi đoạn văn tự nhiên tới AI riêng (AI_INFER_URL) → danh sách công việc (đã sanitize).
 *
 * Mọi gói đều dùng được, giới hạn số lượt mỗi ngày theo gói (xem aiQuotaService).
 * Lượt chỉ bị trừ KHI AI trả kết quả thành công, nên lỗi mạng không làm người
 * dùng mất lượt.
 */
export async function parseTasks(req, res, next) {
  try {
    const text = req.body?.text
    if (!text || !String(text).trim()) {
      throw ApiError.badRequest('Vui lòng nhập nội dung công việc')
    }

    await aiQuotaService.assertQuota(req.user.id)

    const tasks = await aiService.parseTasks(String(text))
    const quota = await aiQuotaService.consumeQuota(req.user.id)
    success(res, 200, 'Phân tích thành công', { tasks, quota })
  } catch (err) {
    const status = AI_ERROR_STATUS[err.code]
    if (status) {
      const detail = err.detail ? ` — ${err.detail}` : ''
      return next(new ApiError(status, `${err.message}${detail}`))
    }
    next(err)
  }
}

/**
 * GET /api/v1/ai/quota
 * Số lượt trợ lý AI còn lại hôm nay (để hiển thị trong khung chat).
 */
export async function getQuota(req, res) {
  const quota = await aiQuotaService.getQuota(req.user.id)
  success(res, 200, 'Thao tác thành công', quota)
}

export default { parseTasks, getQuota }