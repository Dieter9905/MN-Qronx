import { validationResult } from 'express-validator'

/**
 * Middleware that checks the result of express-validator checks.
 * If validation errors exist, responds with 400 + errors object.
 * Otherwise forwards to the next middleware.
 *
 * Usage:
 *   router.post('/tasks', [...validations, validate], controller.create)
 */
const validate = (req, res, next) => {
  const result = validationResult(req)

  if (result.isEmpty()) {
    return next()
  }

  // Build { field: message } map from express-validator errors
  const errors = {}
  result.array().forEach((err) => {
    errors[err.path] = err.msg
  })

  return res.status(400).json({
    success: false,
    message: 'Thông tin đầu vào không hợp lệ',
    errors,
  })
}

export default validate
