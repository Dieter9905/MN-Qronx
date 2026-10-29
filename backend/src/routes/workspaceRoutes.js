import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import workspaceService from '../services/workspaceService.js'
import { success } from '../dto/response/apiResponse.js'
import ApiError from '../utils/ApiError.js'
import catchAsync from '../utils/catchAsync.js'
import { body, param } from 'express-validator'

// ─── Không gian làm việc: list / tạo lớp – nhóm / đặt mặc định / rename / rời ──
const router = Router()
router.use(auth)

const workspaceIdParam = [param('workspaceId').isInt({ min: 1 }).withMessage('workspaceId không hợp lệ')]

router.get(
  '/',
  catchAsync(async (req, res) => {
    const data = await workspaceService.listMine(req.user.id)
    success(res, 200, 'Thao tác thành công', data)
  })
)

router.post(
  '/',
  body('type').isIn(['STUDENT', 'TEAM']).withMessage('type phải là STUDENT hoặc TEAM'),
  body('name').isString().trim().notEmpty().withMessage('Tên không trống').isLength({ max: 150 }),
  validate,
  catchAsync(async (req, res) => {
    const result = await workspaceService.create(req.user.id, req.body)
    success(res, 201, 'Đã tạo không gian làm việc', result)
  })
)

// ─── Thành viên nhóm (chế độ Nhóm làm việc) ─────────────────────────

router.get(
  '/:workspaceId/members',
  workspaceIdParam,
  validate,
  catchAsync(async (req, res) => {
    const data = await workspaceService.listMembers(req.user.id, parseInt(req.params.workspaceId))
    success(res, 200, 'Thao tác thành công', data)
  })
)

// Tham gia bằng mã mời (MN-XXXXXX) — người được mời không cần chủ nhóm mời từng người
router.post(
  '/join',
  body('code').isString().trim().notEmpty().withMessage('Nhập mã mời nhóm'),
  validate,
  catchAsync(async (req, res) => {
    const data = await workspaceService.joinByCode(req.user.id, req.body.code)
    success(res, 200, 'Đã vào nhóm làm việc', data)
  })
)

router.post(
  '/:workspaceId/invite',
  workspaceIdParam,
  validate,
  catchAsync(async (req, res) => {
    const data = await workspaceService.regenerateInvite(req.user.id, parseInt(req.params.workspaceId))
    success(res, 200, 'Đã tạo mã mời mới — mã cũ hết hiệu lực', data)
  })
)

router.delete(
  '/:workspaceId/members/:memberUserId',
  workspaceIdParam,
  param('memberUserId').isInt({ min: 1 }).withMessage('memberUserId không hợp lệ'),
  validate,
  catchAsync(async (req, res) => {
    const data = await workspaceService.removeMember(
      req.user.id,
      parseInt(req.params.workspaceId),
      parseInt(req.params.memberUserId)
    )
    success(res, 200, 'Đã gỡ thành viên khỏi nhóm', data)
  })
)

router.put(
  '/:workspaceId/default',
  workspaceIdParam,
  validate,
  catchAsync(async (req, res) => {
    const data = await workspaceService.setDefault(req.user.id, parseInt(req.params.workspaceId))
    success(res, 200, 'Đã đặt không gian mặc định', data)
  })
)

router.put(
  '/:workspaceId',
  workspaceIdParam,
  validate,
  body('name').isString().trim().notEmpty().withMessage('Tên không trống').isLength({ max: 150 }),
  validate,
  catchAsync(async (req, res) => {
    const ws = await workspaceService.rename(req.user.id, parseInt(req.params.workspaceId), req.body.name)
    success(res, 200, 'Đã đổi tên không gian', ws)
  })
)

router.delete(
  '/:workspaceId',
  workspaceIdParam,
  validate,
  catchAsync(async (req, res) => {
    const data = await workspaceService.leaveOrDelete(req.user.id, parseInt(req.params.workspaceId))
    success(res, 200, data.deleted ? 'Đã xoá không gian' : 'Đã rời không gian', data)
  })
)

export default router
