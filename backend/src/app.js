import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import routes from './routes/index.js'
import notFound from './middleware/notFound.js'
import errorHandler from './middleware/errorHandler.js'

const app = express()

// ── Security & parsing middleware ──────────────────────────
app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// ── API routes (all under /api/v1) ────────────────────────
app.use('/api/v1', routes)

// ── 404 catch-all ──────────────────────────────────────────
app.use(notFound)

// ── Global error handler (must be last) ────────────────────
app.use(errorHandler)

export default app
