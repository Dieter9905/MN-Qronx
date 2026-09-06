import { Router } from 'express'
import { body } from 'express-validator'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as planController from '../controllers/planController.js'

const router = Router()

/**
 * @swagger
 * /plans/me:
 *   get:
 *     tags: [Plans]
 *     summary: Gói hiện tại của người dùng
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gói hiện tại
 */
router.get('/me', auth, planController.getMyPlan)

/**
 * @swagger
 * /plans/upgrade:
 *   put:
 *     tags: [Plans]
 *     summary: Nâng cấp gói (mô phỏng thanh toán)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties:
 *               plan: { type: string, enum: [PLUS, PRO] }
 *     responses:
 *       200:
 *         description: Nâng cấp thành công
 */
router.put(
  '/upgrade',
  auth,
  body('plan')
    .trim()
    .isIn(['PLUS', 'PRO']).withMessage('Chỉ có thể nâng cấp lên gói PLUS hoặc PRO'),
  validate,
  planController.upgrade,
)

export default router