import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as externalCalendarController from '../controllers/externalCalendarController.js'
import {
  createExternalCalendarValidation,
  updateExternalCalendarValidation,
  calendarIdParamValidation,
  eventsRangeValidation,
} from '../dto/request/externalCalendarValidation.js'

const router = Router()
router.use(auth)

// ── Lịch ngoài: nhâp sự kiện từ Google Calendar / Outlook (URL .ics) ──
router.get('/', externalCalendarController.list)
router.get('/events', eventsRangeValidation, validate, externalCalendarController.events)
router.post('/', createExternalCalendarValidation, validate, externalCalendarController.create)
router.put(
  '/:calendarId',
  updateExternalCalendarValidation,
  validate,
  externalCalendarController.update
)
router.post(
  '/:calendarId/sync',
  calendarIdParamValidation,
  validate,
  externalCalendarController.sync
)
router.delete(
  '/:calendarId',
  calendarIdParamValidation,
  validate,
  externalCalendarController.remove
)

export default router
