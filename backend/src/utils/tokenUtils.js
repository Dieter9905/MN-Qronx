import jwt from 'jsonwebtoken'
import config from '../config/index.js'

/**
 * Generate a signed JWT for the given user.
 *
 * @param {{ id: number, role: string }} user
 * @returns {string} Signed JWT string
 */
export function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  })
}

/**
 * Verify and decode a JWT string.
 *
 * @param {string} token
 * @returns {object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret)
}
