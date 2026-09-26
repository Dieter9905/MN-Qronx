import { Router } from 'express'
import auth from '../middleware/auth.js'
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

// PUT /plans/upgrade (nâng cấp mô phỏng) đã bị gỡ: xem /api/v1/billing/*
// để mua gói bằng chuyển khoản hoặc Play Billing.

export default router
