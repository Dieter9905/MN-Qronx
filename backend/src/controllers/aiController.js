import * as aiService from '../services/aiService.js'
import ApiError from '../utils/ApiError.js'
import { getUserPlan } from '../utils/planLimits.js'
import { success } from '../dto/response/apiResponse.js'

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
    next(err)
  }
}

export default { parseTasks }