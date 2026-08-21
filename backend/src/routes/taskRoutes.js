import { Router } from 'express'
import auth from '../middleware/auth.js'
import subtaskRoutes from './subtaskRoutes.js'
import validate from '../middleware/validate.js'
import * as reminderController from '../controllers/reminderController.js'
import { createReminderValidation, updateReminderValidation, reminderIdParamValidation } from '../dto/request/reminderValidation.js'
import * as taskController from '../controllers/taskController.js'
import {
  createTaskValidation,
  updateTaskValidation,
  taskIdParamValidation,
  getTasksValidation,
} from '../dto/request/taskValidation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Quản lý công việc
 */

router.use(auth)

router.get('/', getTasksValidation, validate, taskController.getTasks)
router.post('/', createTaskValidation, validate, taskController.createTask)
router.get('/:taskId', taskIdParamValidation, validate, taskController.getTaskById)
router.put('/:taskId', updateTaskValidation, validate, taskController.updateTask)
router.delete('/:taskId', taskIdParamValidation, validate, taskController.deleteTask)
router.post('/:taskId/complete', taskIdParamValidation, validate, taskController.completeTask)
router.post('/:taskId/reopen', taskIdParamValidation, validate, taskController.reopenTask)
router.post('/:taskId/cancel', taskIdParamValidation, validate, taskController.cancelTask)

router.use('/:taskId/subtasks', subtaskRoutes)

// ── Reminder routes (nested under /tasks/:taskId) ───────
const reminderSubRouter = Router({ mergeParams: true })
reminderSubRouter.use(auth)
reminderSubRouter.get('/', reminderController.getByTask)
reminderSubRouter.post('/', createReminderValidation, validate, reminderController.createReminder)
reminderSubRouter.put('/:reminderId', updateReminderValidation, validate, reminderController.updateReminder)
reminderSubRouter.delete('/:reminderId', reminderIdParamValidation, validate, reminderController.deleteReminder)

router.use('/:taskId/reminders', reminderSubRouter)


export default router
