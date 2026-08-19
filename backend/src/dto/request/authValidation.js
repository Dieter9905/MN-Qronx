import { body } from 'express-validator'

export const registerValidation = [
  body('fullName')
    .notEmpty().withMessage('Họ tên không được để trống')
    .isLength({ max: 150 }).withMessage('Họ tên không quá 150 ký tự'),

  body('email')
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ'),

  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6, max: 50 }).withMessage('Mật khẩu phải từ 6-50 ký tự'),
]

export const loginValidation = [
  body('email')
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ'),

  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống'),
]

export const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('RefreshToken không được để trống'),
]

export const forgotPasswordValidation = [
  body('email')
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không hợp lệ'),
]

export const resetPasswordValidation = [
  body('resetToken')
    .notEmpty().withMessage('Reset token không được để trống'),

  body('newPassword')
    .notEmpty().withMessage('Mật khẩu mới không được để trống')
    .isLength({ min: 6, max: 50 }).withMessage('Mật khẩu mới phải từ 6-50 ký tự'),
]
