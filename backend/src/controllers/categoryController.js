import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as categoryService from '../services/categoryService.js'

/**
 * GET /api/v1/categories
 */
export const getCategories = catchAsync(async (req, res) => {
  const { isActive } = req.query
  const filter = isActive !== undefined ? isActive === 'true' : undefined
  const categories = await categoryService.getCategories(req.user.id, filter)
  success(res, 200, 'Thao tác thành công', categories)
})

/**
 * POST /api/v1/categories
 */
export const create = catchAsync(async (req, res) => {
  const category = await categoryService.create(req.user.id, req.body)
  success(res, 201, 'Tạo danh mục thành công', category)
})

/**
 * PUT /api/v1/categories/:categoryId
 */
export const update = catchAsync(async (req, res) => {
  const { categoryId } = req.params
  const category = await categoryService.update(
    req.user.id,
    parseInt(categoryId),
    req.body
  )
  success(res, 200, 'Cập nhật danh mục thành công', category)
})

/**
 * PATCH /api/v1/categories/:categoryId/active
 */
export const toggleActive = catchAsync(async (req, res) => {
  const { categoryId } = req.params
  const { isActive } = req.body
  const category = await categoryService.toggleActive(
    req.user.id,
    parseInt(categoryId),
    isActive
  )
  success(res, 200, isActive ? 'Hiện danh mục thành công' : 'Ẩn danh mục thành công', category)
})
