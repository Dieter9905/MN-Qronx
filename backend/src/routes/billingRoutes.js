import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as billingController from '../controllers/billingController.js'
import {
  createOrderValidation,
  orderCodeValidation,
} from '../dto/request/billingValidation.js'

const router = Router()

// ── Công khai: bảng giá dùng cho trang giá của khách ────────
router.get('/products', billingController.getProducts)

// ── Webhook ngân hàng (xác thực bằng BILLING_WEBHOOK_SECRET) ─
router.post('/webhook/bank', billingController.bankWebhook)

// ── Người dùng đã đăng nhập ─────────────────────────────────
router.get('/me', auth, billingController.getMyBilling)
router.post('/trial', auth, billingController.startTrial)
router.post('/orders', auth, createOrderValidation, validate, billingController.createOrder)
router.get('/orders/:orderCode', auth, orderCodeValidation, validate, billingController.getOrder)

// Khách bấm “Tôi đã chuyển” → kiểm tra lại và kéo giao dịch ngân hàng ngay
router.post('/orders/:orderCode/check', auth, orderCodeValidation, validate, billingController.checkMyOrder)
router.post(
  '/orders/:orderCode/cancel',
  auth,
  orderCodeValidation,
  validate,
  billingController.cancelOrder
)

export default router
