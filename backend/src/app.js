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
app.use(express.json({ limit: '8mb' }))

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

// ── API routes (all under /api/v1) ────────────────────────
app.use(transformResponse)
app.use('/api/v1', routes)

// ── 404 catch-all ──────────────────────────────────────────
app.use(notFound)

// ── Global error handler (must be last) ────────────────────
app.use(errorHandler)

export default app
