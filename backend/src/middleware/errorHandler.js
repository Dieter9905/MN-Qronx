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

  // Unexpected / unhandled errors
  console.error('[Unhandled Error]', err)
  return res.status(500).json({
    success: false,
    message: 'Lỗi hệ thống',
    errors: config.isProduction ? undefined : { detail: err.message },
  })
}

export default errorHandler
