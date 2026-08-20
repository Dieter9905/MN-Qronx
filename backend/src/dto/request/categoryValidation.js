import { body, param, query } from 'express-validator'

export const createCategoryValidation = [
  body('categoryName')
    .notEmpty().withMessage('Tên danh mục không được để trống')
    .isLength({ max: 100 }).withMessage('Tên danh mục không quá 100 ký tự'),

  body('colorCode')
    .optional()
    .isLength({ max: 20 }).withMessage('Mã màu không quá 20 ký tự'),
]

export const updateCategoryValidation = [
  param('categoryId')
    .isInt({ min: 1 }).withMessage('ID danh mục không hợp lệ'),

  body('categoryName')
    .optional()
    .notEmpty().withMessage('Tên danh mục không được để trống')
    .isLength({ max: 100 }).withMessage('Tên danh mục không quá 100 ký tự'),

  body('colorCode')
    .optional()
    .isLength({ max: 20 }).withMessage('Mã màu không quá 20 ký tự'),
]

export const toggleActiveValidation = [
  param('categoryId')
    .isInt({ min: 1 }).withMessage('ID danh mục không hợp lệ'),

  body('isActive')
    .isBoolean().withMessage('isActive phải là true/false')
    .toBoolean(),
]

export const getCategoriesValidation = [
  query('isActive')
    .optional()
    .isIn(['true', 'false']).withMessage('isActive phải là true hoặc false'),
]
