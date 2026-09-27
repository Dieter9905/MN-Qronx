import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as familyService from '../services/familyService.js'

/**
 * Controller gói Pro Gia đình — một khách trả tiền, cả nhà dùng chung.
 *
 * Cả ba phía (chủ gói, người trong nhà, người chưa có nhà) gọi CÙNG một đường
 * GET /me/family rồi tự phân vai ở giao diện: như vậy không có chuyện hai màn
 * hình nói hai chuyện khác nhau về cùng một gói.
 *
 * Không tự chuyển đổi dữ liệu ở đây — middleware transformResponse lo, giống
 * mọi controller khác.
 */

export const getFamily = catchAsync(async (req, res) => {
  const data = await familyService.listFamily(req.user.id)
  success(res, 200, 'Thao tác thành công', data)
})

export const inviteMember = catchAsync(async (req, res) => {
  const data = await familyService.inviteMember(req.user.id, req.body)
  success(res, 201, 'Đã thêm vào gói gia đình — họ đã có quyền lợi Pro ngay.', data)
})

export const removeMember = catchAsync(async (req, res) => {
  const memberId = parseInt(req.params.memberId, 10)
  const data = await familyService.removeMember(req.user.id, memberId)
  success(res, 200, 'Đã gỡ thành viên khỏi gói gia đình', data)
})

export const leaveFamily = catchAsync(async (req, res) => {
  const data = await familyService.leaveFamily(req.user.id)
  success(res, 200, 'Bạn đã rời gói Pro Gia đình', data)
})
