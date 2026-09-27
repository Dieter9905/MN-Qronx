import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as userValidation from '../dto/request/userValidation.js'
import * as userController from '../controllers/userController.js'
import * as customSoundValidation from '../dto/request/customSoundValidation.js'
import * as customSoundController from '../controllers/customSoundController.js'
import * as calendarIcsController from '../controllers/calendarIcsController.js'
import * as shareController from '../controllers/taskShareController.js'
import * as familyController from '../controllers/familyController.js'

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
// Gửi thử ngay cho CHÍNH người gọi: thư tuần chỉ đi mỗi thứ 2 nên không có cách nào
// khác để xem trước nội dung thư đang gửi cho khách trả tiền.
router.post('/weekly-report/test', auth, userController.sendTestWeeklyReport)

// ── Gói Pro Gia đình: một khách trả tiền, tới 4 tài khoản cùng dùng quyền Pro ──
// Cả chủ gói lẫn người trong nhà đều gọi GET này rồi tự phân vai ở giao diện.
router.get('/family', auth, familyController.getFamily)
router.post('/family/members', auth, familyController.inviteMember)
router.delete('/family/members/:memberId', auth, familyController.removeMember)
router.post('/family/leave', auth, familyController.leaveFamily)
// "Cả nhà hôm nay": chủ gói nhìn tiến độ người trong nhà (chỉ gói FAMILY còn hạn).
router.get('/family/board', auth, familyController.getBoard)
// Người trong nhà tự quyết định có cho chủ gói xem tiến độ của mình hay không.
router.put('/family/progress', auth, familyController.setProgress)

// ── Việc người khác nhờ tôi làm (giao việc là quyền lợi gói Pro của NGƯỜI GIAO) ──
// Người NHẬN không cần gói trả phí — có thêm người nhận là có thêm khách dùng app.
router.get('/assigned', auth, shareController.getAssigned)
router.put('/assigned/:taskId', auth, shareController.setAssignedDone)

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
