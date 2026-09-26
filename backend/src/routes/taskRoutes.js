import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as taskValidation from '../dto/request/taskValidation.js'
import * as taskController from '../controllers/taskController.js'
import * as reminderController from '../controllers/reminderController.js'
import {
  taskReminderParamValidation,
  createReminderValidation,
  updateReminderValidation,
  deleteReminderValidation,
} from '../dto/request/reminderValidation.js'
import subtaskRoutes from './subtaskRoutes.js'
import reminderRoutes from './reminderRoutes.js'

const router = Router()

// ── Nhắc nhở của một công việc ─────────────────────────────
// Khai báo Ở ĐÂY (chứ không trong reminderRoutes) vì reminderRoutes còn được
// gắn ở /reminders — thêm vào đó thì POST /reminders (thiếu taskId) sẽ lọt vào
// controller và lỗi khó hiểu. Trước đây 4 route này bị thiếu hẳn nên thêm/sửa/xoá
// nhắc nhở từ màn chi tiết công việc luôn trả 404 và bị nuốt im lặng.
router.get('/:taskId/reminders', auth, taskReminderParamValidation, validate, reminderController.getByTask)
router.post('/:taskId/reminders', auth, createReminderValidation, validate, reminderController.createReminder)
router.put(
  '/:taskId/reminders/:reminderId',
  auth,
  updateReminderValidation,
  validate,
  reminderController.updateReminder,
)
router.delete(
  '/:taskId/reminders/:reminderId',
  auth,
  deleteReminderValidation,
  validate,
  reminderController.deleteReminder,
)

// Nested routes
router.use('/:taskId/subtasks', subtaskRoutes)
router.use('/:taskId/reminders', reminderRoutes)

/**
 * @swagger
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Danh sách công việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [TODO, IN_PROGRESS, COMPLETED, CANCELLED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Danh sách tasks
 */
router.get('/', auth, taskValidation.getTasksValidation, validate, taskController.getTasks)

/**
 * @swagger
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Tạo công việc mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskRequest'
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
router.post(
  '/',
  auth,
  taskValidation.createTaskValidation,
  validate,
  taskController.createTask,
)

/**
 * @swagger
 * /tasks/{taskId}:
 *   get:
 *     tags: [Tasks]
 *     summary: Chi tiết công việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chi tiết task
 *       404:
 *         description: Không tìm thấy
 */
router.get('/:taskId', auth, taskController.getTaskById)

/**
 * @swagger
 * /tasks/{taskId}:
 *   put:
 *     tags: [Tasks]
 *     summary: Cập nhật công việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskRequest'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put(
  '/:taskId',
  auth,
  taskValidation.updateTaskValidation,
  validate,
  taskController.updateTask,
)

/**
 * @swagger
 * /tasks/{taskId}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Xóa công việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete('/:taskId', auth, taskController.deleteTask)

/**
 * @swagger
 * /tasks/{taskId}/complete:
 *   post:
 *     tags: [Tasks]
 *     summary: Hoàn thành công việc (tự sinh task repeat nếu có)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Hoàn thành
 */
router.post('/:taskId/complete', auth, taskController.completeTask)

/**
 * @swagger
 * /tasks/{taskId}/reopen:
 *   post:
 *     tags: [Tasks]
 *     summary: Mở lại công việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Mở lại thành công
 */
router.post('/:taskId/reopen', auth, taskController.reopenTask)

/**
 * @swagger
 * /tasks/{taskId}/cancel:
 *   post:
 *     tags: [Tasks]
 *     summary: Hủy công việc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Hủy thành công
 */
router.post('/:taskId/cancel', auth, taskController.cancelTask)

export default router
