import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as userController from '../controllers/userController.js'
import {
  updateProfileValidation,
  changePasswordValidation,
} from '../dto/request/userValidation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: User Profile
 *   description: Quản lý hồ sơ cá nhân
 */

// All routes require authentication
router.use(auth)

router.get('/', userController.getProfile)
router.put('/', updateProfileValidation, validate, userController.updateProfile)
router.put('/password', changePasswordValidation, validate, userController.changePassword)
router.get('/stats', userController.getStats)
router.get('/activity', userController.getRecentActivity)

export default router
