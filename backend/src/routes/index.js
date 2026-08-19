import { Router } from 'express'
import { success } from '../dto/response/apiResponse.js'
// import authRoutes from './authRoutes.js'
// import userRoutes from './userRoutes.js'
// import categoryRoutes from './categoryRoutes.js'
// import taskRoutes from './taskRoutes.js'
// import reminderRoutes from './reminderRoutes.js'
// import deviceRoutes from './deviceRoutes.js'
// import notificationRoutes from './notificationRoutes.js'
// import dashboardRoutes from './dashboardRoutes.js'
// import adminRoutes from './adminRoutes.js'

const router = Router()

// ── Health check ───────────────────────────────────────────
router.get('/health', (req, res) => {
  success(res, 200, 'Server đang hoạt động', { status: 'ok' })
})

// ── API v1 routes ──────────────────────────────────────────
// Uncomment each as modules are implemented:
// router.use('/auth',          authRoutes)
// router.use('/me',            userRoutes)
// router.use('/categories',    categoryRoutes)
// router.use('/tasks',         taskRoutes)
// router.use('/reminders',     reminderRoutes)
// router.use('/devices',       deviceRoutes)
// router.use('/notification-settings',  notificationRoutes.settings)
// router.use('/notification-logs',      notificationRoutes.logs)
// router.use('/dashboard',     dashboardRoutes)
// router.use('/admin',         adminRoutes)

export default router
