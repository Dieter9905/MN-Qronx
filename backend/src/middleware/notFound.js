import ApiError from '../utils/ApiError.js'

/**
 * Catch-all 404 — mount AFTER all routes.
 */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Không tìm thấy route: ${req.method} ${req.originalUrl}`))
}

export default notFound
