import { Router } from 'express'
import auth from '../middleware/auth.js'
import * as plannerController from '../controllers/plannerController.js'

const router = Router()

/**
 * @swagger
 * /planner/week:
 *   get:
 *     tags: [Planner]
 *     summary: Kế hoạch tuần — mỗi ngày nên làm việc nào (gói Pro)
 *     description: >
 *       Xếp việc đang mở vào 7 ngày tới: quá hạn trước (lâu nhất lên đầu), rồi theo
 *       hạn gần nhất và mức ưu tiên. Việc không còn chỗ trước hạn nằm trong `atRisk`
 *       kèm số ngày sẽ trễ — để người dùng dời hạn thay vì vỡ kế hoạch.
 *       Gói Free/Plus trả 400 kèm chỉ dẫn nâng cấp.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: capacity
 *         schema:
 *           type: integer
 *           enum: [3, 5, 8, 10]
 *           default: 5
 *     responses:
 *       200:
 *         description: Kế hoạch 7 ngày kèm cảnh báo quá tải
 */
router.get('/week', auth, plannerController.getWeekPlan)

export default router
