import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import ApiError from '../utils/ApiError.js'
import config from '../config/index.js'
import * as calendarIcsService from '../services/calendarIcsService.js'

// ─── Xuất lịch .ics (một chiều) ─────────────────────────────
// Người dùng dán URL có khoá vào Google Calendar / Outlook một lần, app lịch tự
// đọc lại khi có việc mới. App lịch không mang được mật khẩu nên phải dùng khoá
// riêng trên URL — xem calendarIcsService.js.

/** Địa chỉ công khai của API: cấu hình trước, không có thì suy ra từ request. */
function publicBaseUrl(req) {
  if (config.billing?.publicApiUrl) return config.billing.publicApiUrl
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol
  const host = req.get('x-forwarded-host') || req.get('host')
  return host ? `${proto}://${host}` : ''
}

function icsUrlOf(req, key) {
  return `${publicBaseUrl(req).replace(/\/+$/, '')}/api/v1/calendar/${key}`
}

/**
 * GET /api/v1/calendar/:icsKey — KHÔNG cần đăng nhập (app lịch không gửi token).
 * Trả thẳng tệp text/calendar; khoá sai trả 404 JSON.
 * Chấp nhận cả URL có đuôi `.ics` (một số app lịch tự thêm) — base64url không
 * chứa dấu chấm nên cắt đuôi an toàn.
 */
export const getFeed = catchAsync(async (req, res) => {
  let key = String(req.params.icsKey || '')
  if (key.toLowerCase().endsWith('.ics')) key = key.slice(0, -4)

  const userId = await calendarIcsService.userIdByKey(key)
  if (!userId) throw ApiError.notFound('Không tìm thấy lịch hoặc khoá không đúng')

  const ics = await calendarIcsService.buildCalendar(userId)
  res.set({
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="mn-qronx.ics"',
    // private: nội dung lịch là dữ liệu cá nhân, không để proxy cache chung
    'Cache-Control': 'private, max-age=300',
  })
  res.send(ics)
})

/** GET /api/v1/me/ics — lấy (tự sinh) URL lịch của chính mình. */
export const getMyIcs = catchAsync(async (req, res) => {
  const key = await calendarIcsService.ensureIcsKey(req.user.id)
  success(res, 200, 'Thao tác thành công', { url: icsUrlOf(req, key) })
})

/** POST /api/v1/me/ics/rotate — tạo khoá mới; URL cũ ngừng hoạt động ngay. */
export const rotateMyIcs = catchAsync(async (req, res) => {
  const key = await calendarIcsService.rotateIcsKey(req.user.id)
  success(res, 200, 'Đã tạo khoá mới — thêm lại link vào app lịch giúp mình nhé', {
    url: icsUrlOf(req, key),
  })
})
