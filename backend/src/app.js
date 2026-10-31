import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './config/swagger.js'
import routes from './routes/index.js'
import notFound from './middleware/notFound.js'
import transformResponse from './middleware/transformResponse.js'
import errorHandler from './middleware/errorHandler.js'

const app = express()

// ── Security & parsing middleware ──────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors())
app.use(cookieParser())
app.use(
  express.json({
    limit: '8mb',
    // Giữ lại body thô cho webhook ngân hàng: SePay ký HMAC-SHA256 trên đúng
    // chuỗi bytes nhận được, parse ra rồi stringify lại là chữ ký lệch ngay
    // (thứ tự khoá, khoảng trắng và cách escape Unicode đều có thể khác).
    verify: (req, res, buf) => {
      if (req.originalUrl?.includes('/billing/webhook')) req.rawBody = buf
    },
  })
)

// ── Swagger UI ──────────────────────────────────────────────
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'TaskAlarm API Docs',
}))

// Swagger JSON endpoint
app.get('/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

// ── HTTP cache: API KHÔNG BAO GIỜ được cache ───────────────
// Express mặc định gắn ETag vào mọi JSON mà KHÔNG gửi Cache-Control — trình
// duyệt tự ý lưu và revalidate (If-None-Match) → 304 → dùng lại body CŨ. Thật:
// body 401 "hết hạn phiên" nằm trong cache, người dùng vừa đăng nhập bằng
// Google xong nhạn /me trả 304 ngay giây đầu → app tưởng chưa đăng nhập →
// clearSession đá về /login ("văng ra"). no-store diệt tận gốc mọi 304 của API.
app.use('/api/v1', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// ── API routes (all under /api/v1) ────────────────────────
app.use(transformResponse)
app.use('/api/v1', routes)

// ── 404 catch-all ──────────────────────────────────────────
app.use(notFound)

// ── Global error handler (must be last) ────────────────────
app.use(errorHandler)

export default app
