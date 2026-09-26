import { body, param, query } from 'express-validator'

// ─── Tạo đơn thanh toán ─────────────────────────────────────
export const createOrderValidation = [
  body('plan')
    .trim()
    .isIn(['PLUS', 'PRO']).withMessage('Chỉ có thể mua gói PLUS hoặc PRO'),
  body('cycle')
    .optional({ values: 'falsy' })
    .trim()
    .isIn(['MONTHLY', 'YEARLY']).withMessage('Kỳ thanh toán chỉ là MONTHLY hoặc YEARLY'),
]

// ─── Mã đơn trên đường dẫn ──────────────────────────────────
export const orderCodeValidation = [
  param('orderCode')
    .trim()
    .toUpperCase()
    .matches(/^MNQ[A-Z0-9]{8}$/).withMessage('Mã đơn không hợp lệ'),
]

// ─── Admin: danh sách đơn ───────────────────────────────────
export const orderListValidation = [
  query('status')
    .optional({ values: 'falsy' })
    .isIn(['PENDING', 'PAID', 'CANCELLED', 'EXPIRED']).withMessage('Trạng thái đơn không hợp lệ'),
  query('keyword')
    .optional({ values: 'falsy' })
    .isString().withMessage('Từ khoá phải là chuỗi')
    .isLength({ max: 100 }).withMessage('Từ khoá tối đa 100 ký tự'),
  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 }).withMessage('Page phải là số nguyên >= 1'),
  query('pageSize')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 200 }).withMessage('PageSize phải từ 1 đến 200'),
]

// ─── Admin: xác nhận / huỷ đơn ──────────────────────────────
export const confirmOrderValidation = [
  body('provider')
    .optional({ values: 'falsy' })
    .trim()
    .isIn(['VIETQR', 'MOMO', 'ADMIN', 'PLAY']).withMessage('Nguồn thanh toán không hợp lệ'),
  body('providerRef')
    .optional({ values: 'falsy' })
    .isString().withMessage('Mã giao dịch phải là chuỗi')
    .isLength({ max: 190 }).withMessage('Mã giao dịch tối đa 190 ký tự'),
  body('note')
    .optional({ values: 'falsy' })
    .isString().withMessage('Ghi chú phải là chuỗi')
    .isLength({ max: 255 }).withMessage('Ghi chú tối đa 255 ký tự'),
]

// ─── Admin: gán giao dịch ngân hàng vào đơn ─────────────────
export const attachTransferValidation = [
  param('eventId')
    .isInt({ min: 1 }).withMessage('ID giao dịch không hợp lệ'),
  body('orderCode')
    .trim()
    .toUpperCase()
    .matches(/^MNQ[A-Z0-9]{8}$/).withMessage('Mã đơn không hợp lệ'),
  body('note')
    .optional({ values: 'falsy' })
    .isString().withMessage('Ghi chú phải là chuỗi')
    .isLength({ max: 255 }).withMessage('Ghi chú tối đa 255 ký tự'),
]

// ─── Admin: cài đặt tài khoản nhận tiền (ACB…) ───────────────
export const bankSettingsValidation = [
  body('bankId')
    .optional({ values: 'falsy' })
    .trim()
    .toUpperCase()
    .matches(/^([0-9]{6}|[A-Za-z]{2,8})$/)
    .withMessage('Mã ngân hàng phải là BIN 6 số (vd 970416 cho ACB) hoặc mã viết tắt (ACB)'),
  body('bankAccount')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9]{6,25}$/)
    .withMessage('Số tài khoản chỉ gồm 6–25 chữ số'),
  body('bankAccountName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3, max: 80 })
    .withMessage('Tên chủ tài khoản từ 3 đến 80 ký tự'),
  body('qrTemplate')
    .optional({ values: 'falsy' })
    .trim()
    .isIn(['compact', 'compact2', 'qr_only', 'print'])
    .withMessage('Mẫu QR không hợp lệ'),
  // ─── API ngân hàng (kéo giao dịch về) ───
  body('bankApiProvider')
    .optional({ values: 'falsy' })
    .trim()
    .toUpperCase()
    .isIn(['SEPAY', 'ACB'])
    .withMessage('Nhà cung cấp API chỉ nhận SEPAY hoặc ACB'),
  body('bankApiBaseUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 190 })
    .withMessage('Base URL tối đa 190 ký tự'),
  body('bankApiToken')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('API token phải là chuỗi')
    .isLength({ max: 255 })
    .withMessage('API token tối đa 255 ký tự'),
  body('bankApiClientId')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 190 })
    .withMessage('Client ID tối đa 190 ký tự'),
  body('bankApiClientSecret')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Client secret phải là chuỗi')
    .isLength({ max: 255 })
    .withMessage('Client secret tối đa 255 ký tự'),
  body('bankApiTokenUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 190 })
    .withMessage('Token URL tối đa 190 ký tự'),
  body('bankApiHistoryPath')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 190 })
    .withMessage('Đường dẫn lịch sử giao dịch tối đa 190 ký tự'),
  body('bankApiQrPath')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 190 })
    .withMessage('Đường dẫn tạo QR động tối đa 190 ký tự'),
  body('bankApiAccount')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9]{6,25}$/)
    .withMessage('Số tài khoản gửi lên API chỉ gồm 6–25 chữ số'),
  body('syncEnabled')
    .optional({ values: 'undefined' })
    .isBoolean()
    .withMessage('Trạng thái đồng bộ phải là true/false'),
  body('syncIntervalMinutes')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 1440 })
    .withMessage('Chu kỳ đồng bộ từ 1 đến 1440 phút'),
]

export const cancelOrderValidation = [
  body('note')
    .optional({ values: 'falsy' })
    .isString().withMessage('Ghi chú phải là chuỗi')
    .isLength({ max: 255 }).withMessage('Ghi chú tối đa 255 ký tự'),
]
