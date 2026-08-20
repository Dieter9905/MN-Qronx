import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as subtaskController from '../controllers/subtaskController.js'
import {
  subtaskParamValidation,
  createSubtaskValidation,
  updateSubtaskValidation,
} from '../dto/request/subtaskValidation.js'

const router = Router({ mergeParams: true })

router.use(auth)

router.get('/', subtaskParamValidation, validate, subtaskController.getSubtasks)
router.post('/', createSubtaskValidation, validate, subtaskController.createSubtask)
router.put('/:subtaskId', updateSubtaskValidation, validate, subtaskController.updateSubtask)
router.post('/:subtaskId/toggle', subtaskParamValidation, validate, subtaskController.toggleSubtask)
router.delete('/:subtaskId', subtaskParamValidation, validate, subtaskController.deleteSubtask)

export default router
