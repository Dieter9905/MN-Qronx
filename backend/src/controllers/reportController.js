import catchAsync from '../utils/catchAsync.js'
import * as reportService from '../services/reportService.js'
import { success } from '../dto/response/apiResponse.js'

// ─── Báo cáo năng suất (gói Pro) ───────────────────────────
// Hai endpoint dùng chung một bộ số liệu: một cho giao diện xem trên màn hình,
// một cho nút "Xuất Excel". Endpoint xuất trả JSON chứa NỘI DUNG file (không
// trả file nhị phân) để trình duyệt tải bằng đúng đường xác thực token hiện có —
// mở tab mới xuống file sẽ không kèm được Authorization header.

export const getReport = catchAsync(async (req, res) => {
  const days = reportService.parseReportDays(req.query.days)
  const data = await reportService.buildReport(req.user.id, { days })
  success(res, 200, 'Thao tác thành công', data)
})

export const exportReport = catchAsync(async (req, res) => {
  const days = reportService.parseReportDays(req.query.days)
  const data = await reportService.exportReportCsv(req.user.id, { days })
  success(res, 200, 'Thao tác thành công', data)
})
