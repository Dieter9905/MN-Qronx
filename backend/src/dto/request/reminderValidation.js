import { body, param } from 'express-validator'

export const taskReminderParamValidation = [
  param('taskId').isInt({ min: 1 }).withMessage('ID công việc không hợp lệ'),
]

export const createReminderValidation = [
  param('taskId').isInt({ min: 1 }).withMessage('ID công việc không hợp lệ'),
  body('remindAt')
    .notEmpty().withMessage('Thời điểm nhắc nhở không được để trống')
    .isISO8601().withMessage('Thời điểm nhắc nhở phải là định dạng ISO-8601'),
]

export const updateReminderValidation = [
  param('taskId').isInt({ min: 1 }).withMessage('ID công việc không hợp lệ'),
  param('reminderId').isInt({ min: 1 }).withMessage('ID nhắc nhở không hợp lệ'),
  body('remindAt')
    .notEmpty().withMessage('Thời điểm nhắc nhở không được để trống')
    .isISO8601().withMessage('Thời điểm nhắc nhở phải là định dạng ISO-8601'),
]

// Xoá nhắc nhở: chỉ có tham số đường dẫn, KHÔNG được đòi body.remindAt như
// updateReminderValidation (đòi thì DELETE luôn trả 400 "Thiếu thông tin").
export const deleteReminderValidation = [
  param('taskId').isInt({ min: 1 }).withMessage('ID công việc không hợp lệ'),
  param('reminderId').isInt({ min: 1 }).withMessage('ID nhắc nhở không hợp lệ'),
]

export const reminderIdParamValidation = [
  param('reminderId').isInt({ min: 1 }).withMessage('ID nhắc nhở không hợp lệ'),
]

export const snoozeValidation = [
  param('reminderId').isInt({ min: 1 }).withMessage('ID nhắc nhở không hợp lệ'),
  body('snoozeMinutes')
    .optional()
    .isInt({ min: 1, max: 60 }).withMessage('Thời gian hoãn phải từ 1-60 phút'),
]
