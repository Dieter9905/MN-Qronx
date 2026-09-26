import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as supportController from '../controllers/supportController.js'
import {
  sendMessageValidation,
  messageListValidation,
  attachmentIdValidation,
} from '../dto/request/supportValidation.js'

const router = Router()

// Mọi route hỗ trợ đều cần đăng nhập (user hoặc admin)
router.use(auth)

/**
 * @swagger
 * /support/conversation:
 *   get:
 *     tags: [Support]
 *     summary: Hội thoại hỗ trợ của tôi (kèm tin nhắn gần nhất)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hội thoại + danh sách tin nhắn
 */
router.get('/conversation', supportController.getMyConversation)

/**
 * @swagger
 * /support/messages:
 *   get:
 *     tags: [Support]
 *     summary: Chỉ lấy tin nhắn mới hơn `since` (dùng cho chat trực tiếp)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: since
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Danh sách tin nhắn mới + số chưa đọc
 */
router.get('/messages', messageListValidation, validate, supportController.getMyMessages)

/**
 * @swagger
 * /support/messages:
 *   post:
 *     tags: [Support]
 *     summary: Gửi tin nhắn cho admin (kèm tối đa 3 ảnh base64)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               body: { type: string, example: 'Mình không nhận được email xác nhận' }
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     mimeType: { type: string, example: 'image/jpeg' }
 *                     dataBase64: { type: string }
 *     responses:
 *       201:
 *         description: Đã gửi
 */
router.post('/messages', sendMessageValidation, validate, supportController.sendMessage)

// Người dùng đã đọc tin của admin
router.post('/read', supportController.markRead)

// Huy hiệu chưa đọc trên menu
router.get('/unread', supportController.getUnread)

// Ảnh đính kèm (chỉ chủ hội thoại hoặc admin)
router.get('/attachments/:attachmentId', attachmentIdValidation, validate, supportController.getAttachment)

export default router
