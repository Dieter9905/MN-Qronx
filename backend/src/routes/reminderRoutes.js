import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as reminderController from '../controllers/reminderController.js'
import {
  createReminderValidation,
  updateReminderValidation,
  reminderIdParamValidation,
  snoozeValidation,
} from '../dto/request/reminderValidation.js'

const router = Router()
router.use(auth)

// ── Standalone reminder routes ──────────────────────────
router.get('/due', reminderController.getDue)
router.get('/:reminderId', reminderIdParamValidation, validate, reminderController.getById)
router.post('/:reminderId/snooze', snoozeValidation, validate, reminderController.snoozeReminder)
router.post('/:reminderId/dismiss', reminderIdParamValidation, validate, reminderController.dismissReminder)

export default router
