import catchAsync from '../utils/catchAsync.js'
import * as adminService from '../services/adminService.js'
import { success } from '../dto/response/apiResponse.js'

export const getDashboard = catchAsync(async (req, res) => {
  const data = await adminService.getDashboard()
  success(res, 200, 'Thao tác thành công', data)
})

export const getUsers = catchAsync(async (req, res) => {
  const result = await adminService.getUsers(req.query)
  success(res, 200, 'Thao tác thành công', result)
})

export const createUser = catchAsync(async (req, res) => {
  const user = await adminService.createUser(req.body)
  success(res, 201, 'Tạo tài khoản thành công', user)
})

export const lockUser = catchAsync(async (req, res) => {
  const { userId } = req.params
  const user = await adminService.lockUser(parseInt(userId))
  success(res, 200, 'Khóa tài khoản thành công', user)
})

export const unlockUser = catchAsync(async (req, res) => {
  const { userId } = req.params
  const user = await adminService.unlockUser(parseInt(userId))
  success(res, 200, 'Mở khóa tài khoản thành công', user)
})

export const setPlan = catchAsync(async (req, res) => {
  const { userId } = req.params
  const { plan } = req.body
  const user = await adminService.setUserPlan(parseInt(userId), plan)
  success(res, 200, `Đã chuyển gói của ${user.fullName} sang ${user.plan}`, user)
})
