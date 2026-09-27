import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as userValidation from '../dto/request/userValidation.js'
import * as userController from '../controllers/userController.js'
import * as customSoundValidation from '../dto/request/customSoundValidation.js'
import * as customSoundController from '../controllers/customSoundController.js'
import * as calendarIcsController from '../controllers/calendarIcsController.js'

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

/**
 * @swagger
 * /me/weekly-report:
 *   put:
 *     tags: [User Profile]
 *     summary: Bật/tắt báo cáo tuần qua email (quyền lợi gói Pro)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Trạng thái mới
 */
router.put('/weekly-report', auth, userController.setWeeklyReport)

// ── Lịch .ics: dán vào Google Calendar / Outlook một lần là tự đồng bộ ──
router.get('/ics', auth, calendarIcsController.getMyIcs)
router.post('/ics/rotate', auth, calendarIcsController.rotateMyIcs)

// ── Âm thanh báo thức tùy chỉnh (import MP3 – Plus/Pro) ──
router.get('/sounds', auth, customSoundController.listSounds)
router.post(
  '/sounds',
  auth,
  customSoundValidation.importSoundValidation,
  validate,
  customSoundController.importSound,
)
router.get(
  '/sounds/:soundId/data',
  auth,
  customSoundValidation.soundIdValidation,
  validate,
  customSoundController.getSoundData,
)
router.delete(
  '/sounds/:soundId',
  auth,
  customSoundValidation.soundIdValidation,
  validate,
  customSoundController.removeSound,
)

export default router
