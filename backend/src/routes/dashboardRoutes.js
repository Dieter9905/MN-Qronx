import { Router } from 'express'
import auth from '../middleware/auth.js'
import * as dashboardController from '../controllers/dashboardController.js'

const router = Router()

router.get(
  '/',
  auth,
  dashboardController.getDashboard,
)

export default router
