import catchAsync from '../utils/catchAsync.js'
import * as plannerService from '../services/plannerService.js'
import { success } from '../dto/response/apiResponse.js'

// ─── Kế hoạch tuần (gói Pro) ───────────────────────────────
// Số việc mỗi ngày do người dùng chọn (3/5/8/10) — gửi lên mỗi lần xem kế hoạch,
// không lưu DB, nên đổi là thấy kết quả ngay.

export const getWeekPlan = catchAsync(async (req, res) => {
  const capacity = plannerService.parseCapacity(req.query.capacity)
  const data = await plannerService.buildWeekPlan(req.user.id, { capacity })
  success(res, 200, 'Thao tác thành công', data)
})
