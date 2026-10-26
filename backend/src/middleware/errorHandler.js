import ApiError from '../utils/ApiError.js'
import config from '../config/index.js'

/**
 * Global error handler — MUST have 4 parameters for Express to recognise it.
 * Placed last in the middleware chain.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // If it's an ApiError we threw intentionally, use its status & message
  if (err instanceof ApiError) {
    const body = { success: false, message: err.message }
    if (err.errors) body.errors = err.errors
    return res.status(err.statusCode).json(body)
  }

  // Prisma known request errors
  if (err.code && err.code.startsWith('P')) {
    return res.status(400).json({
      success: false,
      message: 'Lỗi dữ liệu',
      errors: config.isProduction ? undefined : { prisma: err.message },
    })
  }

  // Lỗi phân tích/dung lượng body do CLIENT gửi sai (body-parser):
  // sai JSON, quá lớn… — lỗi của người gọi, không phải hệ thống
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Dữ liệu gửi lên không đúng định dạng JSON' })
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Dữ liệu gửi lên quá lớn' })
  }

  // Unexpected / unhandled errors
  console.error('[Unhandled Error]', err)
  return res.status(500).json({
    success: false,
    message: 'Lỗi hệ thống',
    errors: config.isProduction ? undefined : { detail: err.message },
  })
}

export default errorHandler
