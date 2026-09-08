import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import { body } from 'express-validator'
import * as rewardController from '../controllers/rewardController.js'

const router = Router()

/**
 * @swagger
 * /rewards/overview:
 *   get:
 *     tags: [Rewards]
 *     summary: Tổng quan điểm thưởng, chuỗi đăng nhập, mã mời, bảng giá đổi thưởng
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin phần thưởng
 */
router.get('/overview', auth, rewardController.getOverview)

/**
 * @swagger
 * /rewards/claim:
 *   post:
 *     tags: [Rewards]
 *     summary: Đổi điểm lấy phần thưởng (gia hạn gói)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tierId]
 *             properties:
 *               tierId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nhận thưởng thành công
 */
router.post(
  '/claim',
  auth,
  body('tierId').notEmpty().withMessage('Thiếu tierId').isString().withMessage('tierId không hợp lệ'),
  validate,
  rewardController.claimReward
)

export default router