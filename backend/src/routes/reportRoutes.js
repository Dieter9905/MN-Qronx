import { Router } from 'express'
import auth from '../middleware/auth.js'
import * as reportController from '../controllers/reportController.js'

const router = Router()

/**
 * @swagger
 * /reports:
 *   get:
 *     tags: [Reports]
 *     summary: Báo cáo năng suất (gói Pro)
 *     description: >
 *       Số liệu trong 7/30/90 ngày gần nhất: việc đã xong theo ngày/thứ/giờ, tỉ lệ
 *       xong đúng hạn, việc tồn đọng lâu nhất, danh mục, số việc được "nhắc dai" cứu.
 *       Gói Free/Plus trả 400 kèm chỉ dẫn nâng cấp.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           enum: [7, 30, 90]
 *           default: 30
 *     responses:
 *       200:
 *         description: Số liệu báo cáo
 */
router.get('/', auth, reportController.getReport)

/**
 * @swagger
 * /reports/export:
 *   get:
 *     tags: [Reports]
 *     summary: Nội dung file CSV báo cáo (mở bằng Excel) — gói Pro
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           enum: [7, 30, 90]
 *           default: 30
 *     responses:
 *       200:
 *         description: '{ filename, content, rows, truncated }'
 */
router.get('/export', auth, reportController.exportReport)

export default router
