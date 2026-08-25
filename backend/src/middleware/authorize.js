import ApiError from '../utils/ApiError.js'

/**
 * Factory that returns middleware checking req.user.role against allowed roles.
 *
 * Usage:  router.get('/admin/users', auth, authorize('ADMIN'), handler)
 *         router.get('/me', auth, authorize('USER', 'ADMIN'), handler)
 *
 * @param  {...string} roles  Allowed role names
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Chưa xác thực'))
  }

  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Bạn không có quyền truy cập tài nguyên này'))
  }

  next()
}

export default authorize
