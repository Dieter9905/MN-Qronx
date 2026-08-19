import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as authController from '../controllers/authController.js'
import {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from '../dto/request/authValidation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Đăng ký, đăng nhập, quản lý phiên
 */

// Public routes
router.post('/register', registerValidation, validate, authController.register)
router.post('/login', loginValidation, validate, authController.login)
router.post('/refresh-token', refreshTokenValidation, validate, authController.refreshToken)
router.post('/forgot-password', forgotPasswordValidation, validate, authController.forgotPassword)
router.post('/reset-password', resetPasswordValidation, validate, authController.resetPassword)

// Protected routes (cần login)
router.post('/logout', auth, authController.logout)

export default router
