import { body, param, query } from 'express-validator'

// ─── Register Device ───────────────────────────────────
export const registerDeviceValidation = [
  body('deviceToken')
    .notEmpty().withMessage('Device token không được để trống')
    .isString().withMessage('Device token phải là chuỗi')
    .isLength({ max: 500 }).withMessage('Device token tối đa 500 ký tự'),
  body('platform')
    .notEmpty().withMessage('Platform không được để trống')
    .isIn(['WEB', 'ANDROID', 'IOS']).withMessage('Platform phải là WEB, ANDROID hoặc IOS'),
]

// ─── Device ID Param ───────────────────────────────────
export const deviceIdValidation = [
  param('deviceId')
    .isInt({ min: 1 }).withMessage('Device ID không hợp lệ'),
]

// ─── Update Notification Settings ──────────────────────
export const updateSettingsValidation = [
  body('alarmSound')
    .optional()
    .isString().withMessage('Alarm sound phải là chuỗi')
    .isLength({ max: 50 }).withMessage('Alarm sound tối đa 50 ký tự'),
  body('defaultSnoozeMinutes')
    .optional()
    .isInt({ min: 1, max: 60 }).withMessage('Snooze minutes phải từ 1 đến 60'),
  body('vibrationEnabled')
    .optional()
    .isBoolean().withMessage('Vibration enabled phải là boolean'),
]

// ─── Notification Log Query ────────────────────────────
export const logQueryValidation = [
  query('from')
    .optional()
    .isISO8601().withMessage('From phải là ngày hợp lệ (ISO 8601)'),
  query('to')
    .optional()
    .isISO8601().withMessage('To phải là ngày hợp lệ (ISO 8601)'),
  query('action')
    .optional()
    .isIn(['SENT', 'SNOOZED', 'DISMISSED']).withMessage('Action phải là SENT, SNOOZED hoặc DISMISSED'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page phải là số nguyên >= 1'),
  // Trần phải khớp MAX_PAGE_SIZE của phân trang (200) — trước đây để 100 nên
  // /devices/logs?pageSize=200 (thống kê thông báo của admin) luôn trả 400.
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 200 }).withMessage('PageSize phải từ 1 đến 200'),
]
