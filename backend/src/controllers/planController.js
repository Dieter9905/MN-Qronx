import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as planService from '../services/planService.js'

export const upgrade = catchAsync(async (req, res) => {
  const user = await planService.upgrade(req.user.id, req.body.plan)
  success(res, 200, `Nâng cấp thành công! Bạn đang dùng gói ${user.plan}`, user)
})

export const getMyPlan = catchAsync(async (req, res) => {
  const data = await planService.getMyPlan(req.user.id)
  success(res, 200, 'Thao tác thành công', data)
})