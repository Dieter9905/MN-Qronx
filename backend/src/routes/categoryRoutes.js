import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as categoryValidation from '../dto/request/categoryValidation.js'
import * as categoryController from '../controllers/categoryController.js'

const router = Router()

/**
 * @swagger
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: Danh sách danh mục
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Danh sách categories
 */
router.get('/', auth, categoryController.getCategories)

/**
 * @swagger
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Tạo danh mục mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryRequest'
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
router.post(
  '/',
  auth,
  categoryValidation.createCategoryValidation,
  validate,
  categoryController.create,
)

/**
 * @swagger
 * /categories/{categoryId}:
 *   put:
 *     tags: [Categories]
 *     summary: Cập nhật danh mục
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryRequest'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put(
  '/:categoryId',
  auth,
  categoryValidation.updateCategoryValidation,
  validate,
  categoryController.update,
)

/**
 * @swagger
 * /categories/{categoryId}/active:
 *   patch:
 *     tags: [Categories]
 *     summary: Ẩn/hiện danh mục (soft toggle)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Toggle thành công
 */
router.patch(
  '/:categoryId/active',
  auth,
  categoryValidation.toggleActiveValidation,
  validate,
  categoryController.toggleActive,
)

export default router
