import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as userValidation from '../dto/request/userValidation.js'
import * as userController from '../controllers/userController.js'

const router = Router()

/**
 * @swagger
 * /me:
 *   get:
 *     tags: [User Profile]
 *     summary: Lấy hồ sơ cá nhân
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hồ sơ user
 */
router.get('/', auth, userController.getProfile)

/**
 * @swagger
 * /me:
 *   put:
 *     tags: [User Profile]
 *     summary: Cập nhật hồ sơ
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put(
  '/',
  auth,
  userValidation.updateProfileValidation,
  validate,
  userController.updateProfile,
)

/**
 * @swagger
 * /me/password:
 *   put:
 *     tags: [User Profile]
 *     summary: Đổi mật khẩu
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 */
router.put(
  '/password',
  auth,
  userValidation.changePasswordValidation,
  validate,
  userController.changePassword,
)

/**
 * @swagger
 * /me/stats:
 *   get:
 *     tags: [User Profile]
 *     summary: Thống kê cá nhân (today, overdue, completed, categories, devices)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê
 */
router.get('/stats', auth, userController.getStats)

/**
 * @swagger
 * /me/activity:
 *   get:
 *     tags: [User Profile]
 *     summary: 5 thông báo gần nhất
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách activity
 */
router.get('/activity', auth, userController.getRecentActivity)

export default router
