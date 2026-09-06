import { body, param } from 'express-validator'

export const importSoundValidation = [
  body('name')
    .optional()
    .isString().withMessage('Tên âm thanh phải là chuỗi')
    .isLength({ max: 120 }).withMessage('Tên âm thanh tối đa 120 ký tự'),

  body('mimeType')
    .optional()
    .isIn([
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/ogg',
      'audio/m4a',
      'audio/aac',
      'audio/mp4',
    ])
    .withMessage('Định dạng âm thanh không được hỗ trợ'),

  body('dataBase64')
    .notEmpty().withMessage('Nội dung tệp âm thanh trống')
    .isString().withMessage('Nội dung tệp âm thanh không hợp lệ'),
]

export const soundIdValidation = [
  param('soundId')
    .isInt({ min: 1 }).withMessage('ID âm thanh không hợp lệ'),
]
