import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as familyService from '../services/familyService.js'

/**
 * Controller gói Pro Doanh nghiệp — một khách trả tiền, cả nhóm dùng chung.
 *
 * Cả ba phía (chủ gói, người trong nhóm, người chưa có nhà) gọi CÙNG một đường
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
  success(res, 201, 'Đã thêm vào gói doanh nghiệp — họ đã có quyền lợi Pro ngay.', data)
})

export const removeMember = catchAsync(async (req, res) => {
  const memberId = parseInt(req.params.memberId, 10)
  const data = await familyService.removeMember(req.user.id, memberId)
  success(res, 200, 'Đã gỡ thành viên khỏi gói doanh nghiệp', data)
})

export const leaveFamily = catchAsync(async (req, res) => {
  const data = await familyService.leaveFamily(req.user.id)
  success(res, 200, 'Bạn đã rời gói Pro Doanh nghiệp', data)
})

// ── "Cả nhóm hôm nay" ─────────────────────────────────────────

/** Bảng tiến độ — CHỈ chủ gói. Gọi bằng tài khoản khác thì service trả lỗi rõ ràng. */
export const getBoard = catchAsync(async (req, res) => {
  const data = await familyService.getFamilyBoard(req.user.id)
  success(res, 200, 'Thao tác thành công', data)
})

/** Người trong nhóm bật/tắt việc cho chủ gói xem tiến độ của mình. */
export const setProgress = catchAsync(async (req, res) => {
  const shared = req.body?.shared !== false
  const data = await familyService.setProgressSharing(req.user.id, shared)
  success(
    res,
    200,
    data.shared ? 'Chủ gói sẽ thấy tiến độ của bạn' : 'Đã tắt chia sẻ tiến độ — chủ gói không thấy số liệu của bạn nữa',
    data,
  )
})
