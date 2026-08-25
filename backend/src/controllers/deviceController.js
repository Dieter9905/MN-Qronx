import catchAsync from '../utils/catchAsync.js'
import * as deviceService from '../services/deviceService.js'
import { success } from '../dto/response/apiResponse.js'

export const registerDevice = catchAsync(async (req, res) => {
  const { deviceToken, platform } = req.body
  const device = await deviceService.registerDevice(req.user.id, deviceToken, platform)
  success(res, 201, 'Đăng ký thiết bị thành công', device)
})

export const getDevices = catchAsync(async (req, res) => {
  const devices = await deviceService.getDevices(req.user.id)
  success(res, 200, 'Thao tác thành công', devices)
})

export const deactivateDevice = catchAsync(async (req, res) => {
  const { deviceId } = req.params
  await deviceService.deactivateDevice(req.user.id, parseInt(deviceId))
  success(res, 200, 'Gỡ thiết bị thành công')
})

export const getSettings = catchAsync(async (req, res) => {
  const settings = await deviceService.getSettings(req.user.id)
  success(res, 200, 'Thao tác thành công', settings)
})

export const updateSettings = catchAsync(async (req, res) => {
  const settings = await deviceService.updateSettings(req.user.id, req.body)
  success(res, 200, 'Cập nhật cài đặt thành công', settings)
})

export const getLogs = catchAsync(async (req, res) => {
  const result = await deviceService.getLogs(req.user.id, req.query)
  success(res, 200, 'Thao tác thành công', result)
})
