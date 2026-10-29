import { Router } from 'express'
import { success } from '../dto/response/apiResponse.js'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import categoryRoutes from './categoryRoutes.js'
import taskRoutes from './taskRoutes.js'
import reminderRoutes from './reminderRoutes.js'
import deviceRoutes from './deviceRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'
import reportRoutes from './reportRoutes.js'
import plannerRoutes from './plannerRoutes.js'
import adminRoutes from './adminRoutes.js'
import planRoutes from './planRoutes.js'
import billingRoutes from './billingRoutes.js'
import rewardRoutes from './rewardRoutes.js'
import aiRoutes from './aiRoutes.js'
import supportRoutes from './supportRoutes.js'
import calendarRoutes from './calendarRoutes.js'
import externalCalendarRoutes from './externalCalendarRoutes.js'
import workspaceRoutes from './workspaceRoutes.js'
import schoolScheduleRoutes from './schoolScheduleRoutes.js'
import workspaceContext from '../middleware/workspaceContext.js'
import auth from '../middleware/auth.js'
// import notificationRoutes from './notificationRoutes.js'
// import dashboardRoutes from './dashboardRoutes.js'
// import adminRoutes from './adminRoutes.js'

const router = Router()

// ── Móc "việc định kỳ" gắn từ server.js ─────────────────────
// Health check là endpoint được dịch vụ keep-alive gọi đều đặn, nên đây là chỗ
// tốt nhất để đánh thức các việc định kỳ sau khi máy chủ ngủ (Render free không
// chạy cron trong lúc ngủ). Không gắn móc thì /health vẫn chạy y như cũ.
let healthHook = null

export function onHealthPing(fn) {
  healthHook = typeof fn === 'function' ? fn : null
}

// ── Ngữ cảnh không gian (X-Workspace) ──────────────────────────────────
// ĐỐI ĐẦU TRƯỚC mọi router.use khác cùng tiền tố, và PHẢI đè auth ngay trước:
// auth của các endpoint nằm trong route file (sau mount này) nên req.user chỉ
// có nếu tự verify ở đây. Không header → null = Cá nhân (tương thích ngược).
router.use('/tasks', auth, workspaceContext)
router.use('/dashboard', auth, workspaceContext)
router.use('/external-calendars', auth, workspaceContext)
router.use('/me/external-calendars', auth, workspaceContext)

// ── Health check ───────────────────────────────────────────
/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Kiểm tra trạng thái server
 *     responses:
 *       200:
 *         description: Server đang hoạt động
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Server đang hoạt động
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 */
router.get('/health', (req, res) => {
  if (healthHook) {
    try {
      healthHook()
    } catch (err) {
      console.error('[Health] Lỗi việc định kỳ:', err.message)
    }
  }
  success(res, 200, 'Server đang hoạt động', { status: 'ok' })
})

// ── API v1 routes ──────────────────────────────────────────
router.use('/auth',          authRoutes)
router.use('/me',            userRoutes)
router.use('/categories',    categoryRoutes)
router.use('/tasks',         taskRoutes)
router.use('/reminders',     reminderRoutes)
router.use('/devices',       deviceRoutes)
router.use('/dashboard',     dashboardRoutes)
router.use('/reports',       reportRoutes)
router.use('/planner',       plannerRoutes)
router.use('/admin',         adminRoutes)
router.use('/plans',         planRoutes)
router.use('/billing',       billingRoutes)
router.use('/rewards',        rewardRoutes)
router.use('/ai',             aiRoutes)
router.use('/support',        supportRoutes)
// Feed .ics công khai — app lịch (Google/Outlook) đọc bằng URL có khoá, không cần token
router.use('/calendar',       calendarRoutes)
// Lịch ngoài: nhập sự kiện từ Google Calendar / Outlook bằng URL .ics
// Đặt cả 2 đường: /external-calendars (chuẩn REST) và /me/external-calendars
// (frontend năm 1.3.0 gọi theo dạng nhóm "me") trỏ về cùng bộ route.
router.use('/external-calendars', externalCalendarRoutes)
router.use('/me/external-calendars', externalCalendarRoutes)

// Không gian làm việc: list / tạo Lớp – Nhóm / đặt mặc định / rename / rời
// Khi Phase 2/3 cắm StudyPlan/TEAM, thêm router.use(...) cho đúng nhóm thôi.
router.use('/workspaces', workspaceRoutes)
// Lịch học (Phase 2 – STUDENT): SchoolLink + ScheduleSlot trên lưới TKB.
// auth + workspaceContext gắn ngay đây (middleware Per-mount, cùng lý do
// với /tasks: auth nằm trong các route file cũ phải tự verify trước).
router.use('/student', auth, workspaceContext, schoolScheduleRoutes)

export default router
