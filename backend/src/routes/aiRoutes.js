import { Router } from 'express'
import auth from '../middleware/auth.js'
import * as aiController from '../controllers/aiController.js'

const router = Router()

/**
 * @swagger
 * /ai/parse-tasks:
 *   post:
 *     tags: [AI]
 *     summary: Phân tích văn bản tự nhiên thành danh sách công việc (gói Pro)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Danh sách công việc
 */
/**
 * @swagger
 * /ai/quota:
 *   get:
 *     tags: [AI]
 *     summary: Số lượt trợ lý AI còn lại hôm nay theo gói
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hạn mức AI trong ngày
 */
router.get('/quota', auth, aiController.getQuota)

router.post('/parse-tasks', auth, aiController.parseTasks)

export default router