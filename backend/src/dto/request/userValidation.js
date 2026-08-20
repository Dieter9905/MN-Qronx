import { body } from 'express-validator'

export const updateProfileValidation = [
  body('fullName')
    .optional()
    .notEmpty().withMessage('Họ tên không được để trống')
    .isLength({ max: 150 }).withMessage('Họ tên không quá 150 ký tự'),

  body('phoneNumber')
    .optional()
    .isLength({ max: 20 }).withMessage('Số điện thoại không quá 20 ký tự'),

  body('avatarUrl')
    .optional()
    .isURL().withMessage('URL ảnh đại diện không hợp lệ')
    .isLength({ max: 500 }).withMessage('URL không quá 500 ký tự'),
]

export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Mật khẩu hiện tại không được để trống'),

  body('newPassword')
    .notEmpty().withMessage('Mật khẩu mới không được để trống')
    .isLength({ min: 6, max: 50 }).withMessage('Mật khẩu mới phải từ 6-50 ký tự'),
]
