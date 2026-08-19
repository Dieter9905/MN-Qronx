import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import ApiError from '../utils/ApiError.js'

/**
 * Verify JWT from Authorization header and attach user info to req.user.
 * Does NOT enforce role — use authorize() middleware for that.
 */
const auth = (req, res, next) => {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Chưa xác thực'))
  }

  const token = header.split(' ')[1]

  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = { id: decoded.id, role: decoded.role }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Token đã hết hạn'))
    }
    return next(ApiError.unauthorized('Token không hợp lệ'))
  }
}

export default auth
