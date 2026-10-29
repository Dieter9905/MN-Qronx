import { body, param, query } from 'express-validator'

// ─── Lịch ngoài: kiểm tra dữ liệu đầu vào ───────────────────────────
// URL phải https:// — lịch .ics trả về dạng công khai, gửi qua http là
// rủi ro tôi dễ tránh: chỉ nhận https, cùng danh sách nhà cung cấp cho phép.

export const createExternalCalendarValidation = [
  body('url')
    .notEmpty().withMessage('URL lịch không được để trống')
    .matches(/^https:\/\/\S+$/i).withMessage('URL lịch phải bắt đầu bằng https://'),
  body('name')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 120 }).withMessage('Tên lịch tối đa 120 ký tự'),
]

export const updateExternalCalendarValidation = [
  param('calendarId').isInt({ min: 1 }).withMessage('ID lịch không hợp lệ'),
  body('name')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 120 }).withMessage('Tên lịch tối đa 120 ký tự'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('Trạng thái phải là true/false'),
]

export const calendarIdParamValidation = [
  param('calendarId').isInt({ min: 1 }).withMessage('ID lịch không hợp lệ'),
]

export const eventsRangeValidation = [
  query('from').optional().isISO8601().withMessage('Thời điểm bắt đầu phải là ISO-8601'),
  query('to').optional().isISO8601().withMessage('Thời điểm kết thúc phải là ISO-8601'),
]
