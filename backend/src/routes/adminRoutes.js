import { Router } from 'express'
import auth from '../middleware/auth.js'
import authorize from '../middleware/authorize.js'
import validate from '../middleware/validate.js'
import {
  userIdValidation,
  userListValidation,
} from '../dto/request/adminValidation.js'
import * as adminController from '../controllers/adminController.js'

const router = Router()

// All admin routes require auth + ADMIN role
router.use(auth, authorize('ADMIN'))

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Dashboard admin (totalUsers, totalTasks, activeTasks, notificationsToday)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê hệ thống
 *       403:
 *         description: Không có quyền Admin
 */
router.get('/dashboard', adminController.getDashboard)

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Danh sách người dùng (search + paginate)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Danh sách users
 */
router.get('/users', userListValidation, validate, adminController.getUsers)

/**
 * @swagger
 * /admin/users/{userId}/lock:
 *   post:
 *     tags: [Admin]
 *     summary: Khóa tài khoản
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Khóa thành công
 */
router.post('/users/:userId/lock', userIdValidation, validate, adminController.lockUser)

/**
 * @swagger
 * /admin/users/{userId}/unlock:
 *   post:
 *     tags: [Admin]
 *     summary: Mở khóa tài khoản
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Mở khóa thành công
 */
router.post('/users/:userId/unlock', userIdValidation, validate, adminController.unlockUser)

export default router
