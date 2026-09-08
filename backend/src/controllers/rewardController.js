import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as rewardService from '../services/rewardService.js'

/**
 * GET /api/v1/rewards/overview
 */
export const getOverview = catchAsync(async (req, res) => {
  const overview = await rewardService.getOverview(req.user.id)
  success(res, 200, 'Lấy thông tin phần thưởng thành công', overview)
})

/**
 * POST /api/v1/rewards/claim
 * Body: { tierId }
 */
export const claimReward = catchAsync(async (req, res) => {
  const result = await rewardService.claimReward(req.user.id, req.body.tierId)
  success(res, 200, 'Nhận thưởng thành công', result)
})

export default { getOverview, claimReward }