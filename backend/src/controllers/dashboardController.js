import catchAsync from '../utils/catchAsync.js'
import * as dashboardService from '../services/dashboardService.js'
import { success } from '../dto/response/apiResponse.js'

export const getDashboard = catchAsync(async (req, res) => {
  const data = await dashboardService.getDashboard(req.user.id)
  success(res, 200, 'Thao tác thành công', data)
})
