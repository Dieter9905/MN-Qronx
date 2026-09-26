import { Router } from 'express'
import * as calendarIcsController from '../controllers/calendarIcsController.js'

const router = Router()

/**
 * @swagger
 * /calendar/{icsKey}:
 *   get:
 *     tags: [Calendar]
 *     summary: Tải tệp lịch .ics (công khai — app lịch đọc URL này)
 *     description: Google Calendar / Outlook gọi trực tiếp bằng URL có khoá, không gửi token. Khoá sai trả 404.
 *     parameters:
 *       - in: path
 *         name: icsKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Khoá lịch của người dùng (lấy từ GET /me/ics)
 *     responses:
 *       200:
 *         description: Tệp calendar (text/calendar)
 *       404:
 *         description: Khoá không đúng hoặc đã bị tạo lại
 */
router.get('/:icsKey', calendarIcsController.getFeed)

export default router
