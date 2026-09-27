import { Router } from 'express'
import auth from '../middleware/auth.js'
import authorize from '../middleware/authorize.js'
import validate from '../middleware/validate.js'
import {
  userIdValidation,
  userListValidation,
  createUserValidation,
  planChangeValidation,
} from '../dto/request/adminValidation.js'
import * as adminController from '../controllers/adminController.js'
import * as supportController from '../controllers/supportController.js'
import * as billingController from '../controllers/billingController.js'
import {
  orderListValidation,
  orderCodeValidation,
  confirmOrderValidation,
  attachTransferValidation,
  bankSettingsValidation,
} from '../dto/request/billingValidation.js'
import {
  conversationListValidation,
  conversationIdValidation,
  conversationStatusValidation,
  sendMessageValidation,
} from '../dto/request/supportValidation.js'

const router = Router()

// All admin routes require auth + ADMIN role
router.use(auth, authorize('ADMIN'))

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Dashboard admin (totalUsers, totalTasks, activeTasks, notificationsToday)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê hệ thống
 *       403:
 *         description: Không có quyền Admin
 */
router.get('/dashboard', adminController.getDashboard)

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Danh sách người dùng (search + paginate)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Danh sách users
 */
router.get('/users', userListValidation, validate, adminController.getUsers)

/**
 * @swagger
 * /admin/users:
 *   post:
 *     tags: [Admin]
 *     summary: Tạo tài khoản mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName: { type: string, example: 'Nguyen Van A' }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               phoneNumber: { type: string }
 *               role: { type: string, enum: [USER, ADMIN], default: USER }
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
router.post('/users', createUserValidation, validate, adminController.createUser)

/**
 * @swagger
 * /admin/users/{userId}/lock:
 *   post:
 *     tags: [Admin]
 *     summary: Khóa tài khoản
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Khóa thành công
 */
router.post('/users/:userId/lock', userIdValidation, validate, adminController.lockUser)

/**
 * @swagger
 * /admin/users/{userId}/unlock:
 *   post:
 *     tags: [Admin]
 *     summary: Mở khóa tài khoản
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Mở khóa thành công
 */
router.post('/users/:userId/unlock', userIdValidation, validate, adminController.unlockUser)

/**
 * @swagger
 * /admin/users/{userId}/plan:
 *   put:
 *     tags: [Admin]
 *     summary: Đổi gói (FREE/PLUS/PRO) của người dùng
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties:
 *               plan: { type: string, enum: [FREE, PLUS, PRO] }
 *     responses:
 *       200:
 *         description: Đổi gói thành công
 */
router.put('/users/:userId/plan', userIdValidation, planChangeValidation, validate, adminController.setPlan)

/**
 * @swagger
 * /admin/users/{userId}:
 *   delete:
 *     tags: [Admin]
 *     summary: Xoá vĩnh viễn tài khoản và toàn bộ dữ liệu của người dùng
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Xoá thành công
 *       400:
 *         description: Không thể xoá tài khoản Admin hoặc chính mình
 *       404:
 *         description: Không tìm thấy người dùng
 */
router.delete('/users/:userId', userIdValidation, validate, adminController.deleteUser)

// ── Đối soát thanh toán ────────────────────────────────────

/** Danh sách đơn mua gói (lọc theo trạng thái / mã đơn / email) */
router.get('/orders', orderListValidation, validate, billingController.adminListOrders)

/** Xác nhận đã nhận tiền → kích hoạt gói cho người dùng */
router.post(
  '/orders/:orderCode/confirm',
  orderCodeValidation,
  confirmOrderValidation,
  validate,
  billingController.adminConfirmOrder
)

/** Huỷ đơn chưa thanh toán */
router.post(
  '/orders/:orderCode/cancel',
  orderCodeValidation,
  validate,
  billingController.adminCancelOrder
)

/**
 * Gán tay một giao dịch ngân hàng đã vào tài khoản nhưng chưa khớp đơn nào
 * (khách chuyển thiếu, sai nội dung) → kích hoạt gói cho đúng đơn đó.
 */
router.post(
  '/billing/transfers/:eventId/attach',
  attachTransferValidation,
  validate,
  billingController.adminAttachTransfer
)

/**
 * Cài đặt nhận tiền: tài khoản ngân hàng (ACB…), mã xác thực webhook và URL
 * để dán vào SePay/Casso. Đặt trong app nên đổi là ăn liền, không cần deploy.
 */
router.get('/billing/settings', billingController.adminGetBillingSetup)

/** Lưu tài khoản nhận tiền */
router.put(
  '/billing/settings',
  bankSettingsValidation,
  validate,
  billingController.adminSaveBillingSettings
)

/** Sinh mã xác thực webhook mới (mã cũ hết hiệu lực ngay) */
router.post('/billing/settings/rotate-secret', billingController.adminRotateWebhookSecret)

/** Gửi thử webhook từ máy chủ để biết cấu hình SePay đã thông chưa (không kích hoạt gói) */
router.post('/billing/test-webhook', billingController.adminTestWebhook)

/** Kiểm tra kết nối API ngân hàng (gọi thật, chỉ đọc, không kích hoạt gói) */
router.post('/billing/test-connection', billingController.adminTestBankConnection)

/** Đồng bộ ngay: kéo giao dịch từ API ngân hàng rồi kích hoạt gói */
router.post('/billing/sync', billingController.adminSyncBankNow)

// ── CSKH: hội thoại hỗ trợ với người dùng ──────────────────

/** Số tin nhắn chưa trả lời (huy hiệu trên menu quản trị) */
router.get('/support/unread', supportController.adminUnread)

/** Danh sách hội thoại hỗ trợ (lọc theo chưa đọc / trạng thái / từ khoá) */
router.get(
  '/support/conversations',
  conversationListValidation,
  validate,
  supportController.adminListConversations
)

/** Xem một hội thoại kèm toàn bộ tin nhắn */
router.get(
  '/support/conversations/:conversationId',
  conversationIdValidation,
  validate,
  supportController.adminGetConversation
)

/** Admin trả lời người dùng (kèm tối đa 3 ảnh) */
router.post(
  '/support/conversations/:conversationId/messages',
  conversationIdValidation,
  sendMessageValidation,
  validate,
  supportController.adminReply
)

/** Đánh dấu hội thoại đã đọc */
router.post(
  '/support/conversations/:conversationId/read',
  conversationIdValidation,
  validate,
  supportController.adminMarkRead
)

/** Chuyển trạng thái Chờ xử lý / Đã xong */
router.put(
  '/support/conversations/:conversationId/status',
  conversationStatusValidation,
  validate,
  supportController.adminSetStatus
)

export default router
