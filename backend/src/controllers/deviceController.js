import catchAsync from '../utils/catchAsync.js'
import * as deviceService from '../services/deviceService.js'
import * as pushService from '../services/pushService.js'
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

// ─── Web Push (PWA) ─────────────────────────────────────────
// Có đăng ký Web Push thì nhắc nhở mới kêu khi người dùng ĐÓNG tab/trình duyệt.

/** GET /devices/push/key — khoá công khai VAPID để trình duyệt đăng ký. */
export const getPushKey = catchAsync(async (req, res) => {
  const publicKey = await pushService.getPublicKey()
  success(res, 200, 'Thao tác thành công', { publicKey })
})

/** POST /devices/push — lưu subscription (người dùng bấm BẬT thông báo). */
export const subscribePush = catchAsync(async (req, res) => {
  const row = await pushService.subscribe(req.user.id, req.body, req.get('user-agent'))
  success(res, 201, 'Đã bật thông báo đẩy — giờ đóng trình duyệt vẫn nhận nhắc', row)
})

/** POST /devices/push/unsubscribe — tắt thông báo cho máy/tab này. */
export const unsubscribePush = catchAsync(async (req, res) => {
  const removed = await pushService.unsubscribe(req.user.id, req.body.endpoint)
  success(res, 200, removed ? 'Đã tắt thông báo đẩy' : 'Subscription không còn tồn tại', { removed })
})

/** GET /devices/push — số subscription đang đăng ký (giao diện hiển thị). */
export const getPushStatus = catchAsync(async (req, res) => {
  const count = await pushService.countSubscriptions(req.user.id)
  success(res, 200, 'Thao tác thành công', {
    subscriptions: count,
    permission: null, // trình duyệt tự biết permission của nó, backend chỉ cần biết số bản đã lưu
  })
})

export const getLogs = catchAsync(async (req, res) => {
  const result = await deviceService.getLogs(req.user.id, req.query)
  success(res, 200, 'Thao tác thành công', result)
})
