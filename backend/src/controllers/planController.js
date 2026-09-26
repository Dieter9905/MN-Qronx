import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as planService from '../services/planService.js'

export const getMyPlan = catchAsync(async (req, res) => {
  const data = await planService.getMyPlan(req.user.id)
  success(res, 200, 'Thao tác thành công', data)
})

export default { getMyPlan }
