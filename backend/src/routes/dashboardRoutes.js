import { Router } from 'express'
import auth from '../middleware/auth.js'
import * as dashboardController from '../controllers/dashboardController.js'

const router = Router()

/**
 * @swagger
 * /dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Dashboard cá nhân (todayCount, overdueCount, completedCount, upcomingCount)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê dashboard
 */
router.get('/', auth, dashboardController.getDashboard)

export default router
