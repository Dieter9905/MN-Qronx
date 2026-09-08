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

  body('inviteCode')
    .optional({ values: 'falsy' })
    .isString().withMessage('Mã giới thiệu không hợp lệ')
    .isLength({ min: 4, max: 16 }).withMessage('Mã giới thiệu không hợp lệ')
    .matches(/^[A-Za-z0-9]+$/).withMessage('Mã giới thiệu không hợp lệ'),
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
