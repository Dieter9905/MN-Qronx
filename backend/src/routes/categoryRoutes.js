import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import * as categoryController from '../controllers/categoryController.js'
import {
  createCategoryValidation,
  updateCategoryValidation,
  toggleActiveValidation,
  getCategoriesValidation,
} from '../dto/request/categoryValidation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Quản lý danh mục công việc
 */

router.use(auth)

router.get('/', getCategoriesValidation, validate, categoryController.getCategories)
router.post('/', createCategoryValidation, validate, categoryController.create)
router.put('/:categoryId', updateCategoryValidation, validate, categoryController.update)
router.patch('/:categoryId/active', toggleActiveValidation, validate, categoryController.toggleActive)

export default router
