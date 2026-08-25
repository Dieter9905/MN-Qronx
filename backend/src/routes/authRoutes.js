import { Router } from 'express'
import validate from '../middleware/validate.js'
import auth from '../middleware/auth.js'
import * as authValidation from '../dto/request/authValidation.js'
import * as authController from '../controllers/authController.js'

const router = Router()

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng ký tài khoản mới
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Email đã tồn tại hoặc dữ liệu không hợp lệ
 */
router.post(
  '/register',
  authValidation.registerValidation,
  validate,
  authController.register,
)

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       400:
 *         description: Sai email hoặc mật khẩu
 */
router.post(
  '/login',
  authValidation.loginValidation,
  validate,
  authController.login,
)

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Làm mới AccessToken
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: AccessToken mới
 *       401:
 *         description: RefreshToken không hợp lệ
 */
router.post(
  '/refresh-token',
  authValidation.refreshTokenValidation,
  validate,
  authController.refreshToken,
)

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Quên mật khẩu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Đã gửi reset token
 */
router.post(
  '/forgot-password',
  authValidation.forgotPasswordValidation,
  validate,
  authController.forgotPassword,
)

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Đặt lại mật khẩu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resetToken, newPassword]
 *             properties:
 *               resetToken:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đặt lại thành công
 */
router.post(
  '/reset-password',
  authValidation.resetPasswordValidation,
  validate,
  authController.resetPassword,
)

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng xuất
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.post(
  '/logout',
  auth,
  authController.logout,
)

export default router
