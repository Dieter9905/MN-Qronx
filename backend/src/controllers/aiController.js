import * as aiService from '../services/aiService.js'
import ApiError from '../utils/ApiError.js'
import { getUserPlan } from '../utils/planLimits.js'
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
 * Chỉ dành cho gói PRO.
 */
export async function parseTasks(req, res, next) {
  try {
    const text = req.body?.text
    if (!text || !String(text).trim()) {
      throw ApiError.badRequest('Vui lòng nhập nội dung công việc')
    }

    const plan = await getUserPlan(req.user.id)
    if (plan !== 'PRO') {
      throw ApiError.forbidden('Tính năng AI chỉ dành cho gói Pro')
    }

    const tasks = await aiService.parseTasks(String(text))
    success(res, 200, 'Phân tích thành công', { tasks })
  } catch (err) {
    const status = AI_ERROR_STATUS[err.code]
    if (status) {
      const detail = err.detail ? ` — ${err.detail}` : ''
      return next(new ApiError(status, `${err.message}${detail}`))
    }
    next(err)
  }
}

export default { parseTasks }