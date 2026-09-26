import { body, param, query } from 'express-validator'

export const sendMessageValidation = [
  body('body')
    .optional({ values: 'falsy' })
    .isString().withMessage('Nội dung phải là chuỗi')
    .isLength({ max: 4000 }).withMessage('Nội dung tối đa 4000 ký tự'),

  body('attachments')
    .optional()
    .isArray({ max: 3 }).withMessage('Mỗi tin nhắn chỉ gửi được tối đa 3 ảnh'),

  body('attachments.*.mimeType')
    .optional()
    .isString().withMessage('Loại ảnh không hợp lệ'),

  body('attachments.*.dataBase64')
    .optional()
    .isString().withMessage('Dữ liệu ảnh không hợp lệ'),
]

export const messageListValidation = [
  query('since')
    .optional({ values: 'falsy' })
    .isInt({ min: 0 }).withMessage('since phải là số nguyên không âm'),
]

export const conversationListValidation = [
  query('keyword')
    .optional({ values: 'falsy' })
    .isString().withMessage('Từ khoá phải là chuỗi'),
  query('status')
    .optional({ values: 'falsy' })
    .isIn(['OPEN', 'RESOLVED']).withMessage('Trạng thái không hợp lệ'),
  query('unread')
    .optional({ values: 'falsy' })
    .isIn(['true', 'false']).withMessage('Bộ lọc chưa đọc không hợp lệ'),
  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
  query('pageSize')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 100 }).withMessage('pageSize phải từ 1 đến 100'),
]

export const conversationIdValidation = [
  param('conversationId')
    .isInt({ min: 1 }).withMessage('ID hội thoại không hợp lệ'),
]

export const conversationStatusValidation = [
  ...conversationIdValidation,
  body('status')
    .notEmpty().withMessage('Trạng thái không được để trống')
    .isIn(['OPEN', 'RESOLVED']).withMessage('Trạng thái chỉ có thể là OPEN hoặc RESOLVED'),
]

export const attachmentIdValidation = [
  param('attachmentId')
    .isInt({ min: 1 }).withMessage('ID ảnh không hợp lệ'),
]
