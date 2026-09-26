import { Router } from 'express'
import { success } from '../dto/response/apiResponse.js'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import categoryRoutes from './categoryRoutes.js'
import taskRoutes from './taskRoutes.js'
import reminderRoutes from './reminderRoutes.js'
import deviceRoutes from './deviceRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'
import adminRoutes from './adminRoutes.js'
import planRoutes from './planRoutes.js'
import rewardRoutes from './rewardRoutes.js'
import aiRoutes from './aiRoutes.js'
import supportRoutes from './supportRoutes.js'
// import notificationRoutes from './notificationRoutes.js'
// import dashboardRoutes from './dashboardRoutes.js'
// import adminRoutes from './adminRoutes.js'

const router = Router()

// ── Health check ───────────────────────────────────────────
/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Kiểm tra trạng thái server
 *     responses:
 *       200:
 *         description: Server đang hoạt động
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Server đang hoạt động
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 */
router.get('/health', (req, res) => {
  success(res, 200, 'Server đang hoạt động', { status: 'ok' })
})

// ── API v1 routes ──────────────────────────────────────────
router.use('/auth',          authRoutes)
router.use('/me',            userRoutes)
router.use('/categories',    categoryRoutes)
router.use('/tasks',         taskRoutes)
router.use('/reminders',     reminderRoutes)
router.use('/devices',       deviceRoutes)
router.use('/dashboard',     dashboardRoutes)
router.use('/admin',         adminRoutes)
router.use('/plans',         planRoutes)
router.use('/rewards',        rewardRoutes)
router.use('/ai',             aiRoutes)
router.use('/support',        supportRoutes)

export default router
