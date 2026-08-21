import { Router } from 'express'
import auth from '../middleware/auth.js'
import authorize from '../middleware/authorize.js'
import validate from '../middleware/validate.js'
import {
  userIdValidation,
  userListValidation,
} from '../dto/request/adminValidation.js'
import * as adminController from '../controllers/adminController.js'

const router = Router()

// All admin routes require auth + ADMIN role
router.use(auth, authorize('ADMIN'))

router.get(
  '/dashboard',
  adminController.getDashboard,
)

router.get(
  '/users',
  userListValidation,
  validate,
  adminController.getUsers,
)

router.post(
  '/users/:userId/lock',
  userIdValidation,
  validate,
  adminController.lockUser,
)

router.post(
  '/users/:userId/unlock',
  userIdValidation,
  validate,
  adminController.unlockUser,
)

export default router
