import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import {
  registerDeviceValidation,
  deviceIdValidation,
  updateSettingsValidation,
  logQueryValidation,
} from '../dto/request/deviceValidation.js'
import * as deviceController from '../controllers/deviceController.js'

const router = Router()

// ── Devices ────────────────────────────────────────────
router.post(
  '/',
  auth,
  registerDeviceValidation,
  validate,
  deviceController.registerDevice,
)

router.get(
  '/',
  auth,
  deviceController.getDevices,
)

router.delete(
  '/:deviceId',
  auth,
  deviceIdValidation,
  validate,
  deviceController.deactivateDevice,
)

// ── Notification Settings ──────────────────────────────
router.get(
  '/settings',
  auth,
  deviceController.getSettings,
)

router.put(
  '/settings',
  auth,
  updateSettingsValidation,
  validate,
  deviceController.updateSettings,
)

// ── Notification Logs ──────────────────────────────────
router.get(
  '/logs',
  auth,
  logQueryValidation,
  validate,
  deviceController.getLogs,
)

export default router
