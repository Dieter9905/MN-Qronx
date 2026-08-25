import { param, query } from 'express-validator'

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
