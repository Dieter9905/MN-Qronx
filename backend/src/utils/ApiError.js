/**
 * Custom API error class.
 * Throw this in services/controllers; the global errorHandler middleware
 * will catch it and return the correct JSON envelope.
 */
export default class ApiError extends Error {
  /**
   * @param {number}  statusCode  HTTP status code
   * @param {string}  message     Human-readable message
   * @param {object}  [errors]    Optional field-level errors { field: message }
   */
  constructor(statusCode, message, errors = undefined) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.errors = errors
    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest(message, errors) {
    return new ApiError(400, message, errors)
  }

  static unauthorized(message = 'Chưa xác thực') {
    return new ApiError(401, message)
  }

  static forbidden(message = 'Bạn không có quyền truy cập tài nguyên này') {
    return new ApiError(403, message)
  }

  static notFound(message = 'Không tìm thấy dữ liệu') {
    return new ApiError(404, message)
  }

  static internal(message = 'Lỗi hệ thống') {
    return new ApiError(500, message)
  }

  static tooManyRequests(message = 'Bạn đã dùng quá số lần cho phép') {
    return new ApiError(429, message)
  }
}
