import { body, param } from 'express-validator'

export const subtaskParamValidation = [
  param('taskId').isInt({ min: 1 }).withMessage('ID công việc không hợp lệ'),
  param('subtaskId').isInt({ min: 1 }).withMessage('ID việc con không hợp lệ'),
]

export const createSubtaskValidation = [
  param('taskId').isInt({ min: 1 }).withMessage('ID công việc không hợp lệ'),
  body('content')
    .notEmpty().withMessage('Nội dung việc con không được để trống')
    .isLength({ max: 255 }).withMessage('Nội dung không quá 255 ký tự'),
]

export const updateSubtaskValidation = [
  param('taskId').isInt({ min: 1 }).withMessage('ID công việc không hợp lệ'),
  param('subtaskId').isInt({ min: 1 }).withMessage('ID việc con không hợp lệ'),
  body('content')
    .notEmpty().withMessage('Nội dung việc con không được để trống')
    .isLength({ max: 255 }).withMessage('Nội dung không quá 255 ký tự'),
]
