import { body, param, query } from 'express-validator'

export const createTaskValidation = [
  body('title')
    .notEmpty().withMessage('Tiêu đề không được để trống')
    .isLength({ max: 255 }).withMessage('Tiêu đề không quá 255 ký tự'),

  body('dueAt')
    .notEmpty().withMessage('Thời hạn không được để trống')
    .isISO8601().withMessage('Thời hạn phải là định dạng ISO-8601'),

  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Mức ưu tiên không hợp lệ'),

  body('repeatType')
    .optional()
    .isIn(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).withMessage('Loại lặp không hợp lệ'),

  body('repeatDays')
    .optional({ values: 'null' })
    .isArray({ max: 7 }).withMessage('Danh sách ngày lặp phải là mảng tối đa 7 phần tử'),

  body('repeatDays.*')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 7 }).withMessage('Ngày trong tuần phải từ 1 (Thứ 2) đến 7 (Chủ nhật)'),

  body('categoryId')
    .optional({ values: 'null' })
    .isInt({ min: 1 }).withMessage('ID danh mục không hợp lệ'),

  body('description')
    .optional()
    .isString().withMessage('Mô tả phải là chuỗi'),

  body('reminders')
    .optional()
    .isArray({ max: 5 }).withMessage('Tối đa 5 nhắc nhở'),

  body('reminders.*.remindAt')
    .notEmpty().withMessage('Thời điểm nhắc nhở không được để trống')
    .isISO8601().withMessage('Thời điểm nhắc nhở phải là định dạng ISO-8601'),
]

export const updateTaskValidation = [
  param('taskId')
    .isInt({ min: 1 }).withMessage('ID công việc không hợp lệ'),

  body('title')
    .optional()
    .notEmpty().withMessage('Tiêu đề không được để trống')
    .isLength({ max: 255 }).withMessage('Tiêu đề không quá 255 ký tự'),

  body('dueAt')
    .optional()
    .isISO8601().withMessage('Thời hạn phải là định dạng ISO-8601'),

  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Mức ưu tiên không hợp lệ'),

  body('repeatType')
    .optional()
    .isIn(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).withMessage('Loại lặp không hợp lệ'),

  body('repeatDays')
    .optional({ values: 'null' })
    .isArray({ max: 7 }).withMessage('Danh sách ngày lặp phải là mảng tối đa 7 phần tử'),

  body('repeatDays.*')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 7 }).withMessage('Ngày trong tuần phải từ 1 (Thứ 2) đến 7 (Chủ nhật)'),

  body('categoryId')
    .optional({ values: 'null' })
    .isInt({ min: 1 }).withMessage('ID danh mục không hợp lệ'),

  body('description')
    .optional()
    .isString().withMessage('Mô tả phải là chuỗi'),
]

export const taskIdParamValidation = [
  param('taskId')
    .isInt({ min: 1 }).withMessage('ID công việc không hợp lệ'),
]

export const getTasksValidation = [
  query('status')
    .optional()
    .isIn(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .withMessage('Trạng thái không hợp lệ'),

  query('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Mức ưu tiên không hợp lệ'),

  query('categoryId')
    .optional()
    .isInt({ min: 1 }).withMessage('ID danh mục không hợp lệ'),

  query('keyword')
    .optional()
    .isString().withMessage('Từ khóa phải là chuỗi'),

  query('dueFrom')
    .optional()
    .isISO8601().withMessage('dueFrom phải là định dạng ISO-8601'),

  query('dueTo')
    .optional()
    .isISO8601().withMessage('dueTo phải là định dạng ISO-8601'),

  query('sort')
    .optional()
    .isIn(['dueAsc', 'dueDesc', 'priorityDesc'])
    .withMessage('Sort không hợp lệ'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page phải là số nguyên dương'),

  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('PageSize phải từ 1-100'),
]
