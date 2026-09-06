import { body, param, query } from 'express-validator'

// ─── User ID Param ─────────────────────────────────────
export const userIdValidation = [
  param('userId')
    .isInt({ min: 1 }).withMessage('User ID không hợp lệ'),
]

// ─── User List Query ───────────────────────────────────
export const userListValidation = [
  query('keyword')
    .optional()
    .isString().withMessage('Keyword phải là chuỗi')
    .isLength({ max: 100 }).withMessage('Keyword tối đa 100 ký tự'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page phải là số nguyên >= 1'),
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('PageSize phải từ 1 đến 100'),
]

// ─── Create User Body ──────────────────────────────────
export const createUserValidation = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Họ tên không được để trống')
    .isLength({ max: 150 }).withMessage('Họ tên tối đa 150 ký tự'),
  body('email')
    .trim()
    .isEmail().withMessage('Email không hợp lệ')
    .isLength({ max: 254 }).withMessage('Email tối đa 254 ký tự'),
  body('password')
    .isLength({ min: 6, max: 50 }).withMessage('Mật khẩu phải từ 6 đến 50 ký tự'),
  body('phoneNumber')
    .optional({ values: 'falsy' })
    .isString().withMessage('Số điện thoại không hợp lệ')
    .isLength({ max: 20 }).withMessage('Số điện thoại tối đa 20 ký tự'),
  body('role')
    .optional()
    .isIn(['USER', 'ADMIN']).withMessage('Vai trò chỉ là USER hoặc ADMIN'),
]
