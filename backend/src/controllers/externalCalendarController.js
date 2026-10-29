import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as externalCalendarService from '../services/externalCalendarService.js'

// ─── Lịch ngoài (Google Calendar / Outlook / iCloud .ics): quản lý CRUD ──

export const list = catchAsync(async (req, res) => {
  const calendars = await externalCalendarService.listByUser(req.user.id)
  success(res, 200, 'Thao tác thành công', calendars)
})

export const create = catchAsync(async (req, res) => {
  const { url, name, color } = req.body
  try {
    // Thêm xong là fetch ngay: trả về kèm trạng thái đồng bộ + lỗi (nếu có)
    const cal = await externalCalendarService.create(req.user.id, { url, name, color })
    success(res, 201, cal.lastError ? 'Đã thêm lịch ngoài, đồng bộ đầu chưa thành công — sẽ thử lại sau' : 'Đã thêm lịch ngoài và kéo sự kiện về', cal)
  } catch (err) {
    // URL sai nhà cung cấp: báo lỗi ngay để khách sửa chứ đừng để cron tỏm 1 giờ
    if (/hợp lệ/.test(err?.message || '')) {
      return success(res, 400, err.message, null)
    }
    throw err
  }
})

export const update = catchAsync(async (req, res) => {
  const calendarId = parseInt(req.params.calendarId, 10)
  const { name, isActive } = req.body
  const cal = await externalCalendarService.updateCalendar(req.user.id, calendarId, { name, isActive })
  if (!cal) return success(res, 404, 'Không tìm thấy lịch ngoài', null)
  success(res, 200, 'Cập nhật lịch ngoài thành công', cal)
})

export const remove = catchAsync(async (req, res) => {
  const calendarId = parseInt(req.params.calendarId, 10)
  const ok = await externalCalendarService.removeCalendar(req.user.id, calendarId)
  if (!ok) return success(res, 404, 'Không tìm thấy lịch ngoài', null)
  success(res, 200, 'Đã xoá lịch ngoài và toàn bộ sự kiện của nó')
})

export const sync = catchAsync(async (req, res) => {
  const calendarId = parseInt(req.params.calendarId, 10)
  const cal = await externalCalendarService.findById(req.user.id, calendarId)
  if (!cal) return success(res, 404, 'Không tìm thấy lịch ngoài', null)
  try {
    const count = await externalCalendarService.syncCalendar(cal)
    success(res, 200, `Đã đồng bộ ${count} sự kiện`, await externalCalendarService.findById(req.user.id, calendarId))
  } catch (err) {
    // Đồng bộ thất bại đủ loại (Google/Gmail cấm, URL bỏ trống): report rõ lỗi
    return success(res, 502, err?.message || 'Không đồng bộ được lịch — kiểm tra URL', null)
  }
})

export const events = catchAsync(async (req, res) => {
  const { from, to } = req.query
  const now = new Date()
  const range = {
    // Mặt định 7 ngày lùi (đủ bối cảnh sự kiện vừa passé) + 60 ngày tới
    from: from ? new Date(from) : new Date(now.getTime() - 7 * 86_400_000),
    to: to ? new Date(to) : new Date(now.getTime() + 60 * 86_400_000),
  }
  const list = await externalCalendarService.eventsInRange(req.user.id, range)
  success(res, 200, 'Thao tác thành công', list)
})
