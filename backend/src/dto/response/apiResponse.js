/**
 * Send a success response matching the API envelope spec.
 *
 * @param {object} res        Express response object
 * @param {number} statusCode HTTP status (default 200)
 * @param {string} message    Human-readable message
 * @param {*}      [data]     Payload – any JSON-serialisable value
 */
export function success(res, statusCode = 200, message = 'Thao tác thành công', data = undefined) {
  const body = { success: true, message }
  if (data !== undefined) body.data = data
  return res.status(statusCode).json(body)
}

/**
 * Send an error response matching the API envelope spec.
 *
 * @param {object}  res        Express response object
 * @param {number}  statusCode HTTP status
 * @param {string}  message    Human-readable message
 * @param {object}  [errors]   Optional field-level errors { field: message }
 */
export function error(res, statusCode, message, errors = undefined) {
  const body = { success: false, message }
  if (errors !== undefined) body.errors = errors
  return res.status(statusCode).json(body)
}
