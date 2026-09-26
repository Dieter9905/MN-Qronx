import deviceRepo from '../repositories/deviceRepo.js'
import customSoundRepo from '../repositories/customSoundRepo.js'
import { parsePagination } from '../utils/pagination.js'
import ApiError from '../utils/ApiError.js'
import { PLANS, getUserPlan, planLimit, planLimitError } from '../utils/planLimits.js'

// ─── Register Device ───────────────────────────────────

export async function registerDevice(userId, deviceToken, platform) {
  // Check if token already exists (any user)
  const existing = await deviceRepo.findByToken(deviceToken)

  if (existing) {
    // Same user → reactivate
    if (existing.userId === userId) {
      if (existing.isActive) return existing
      return deviceRepo.update(existing.deviceId, { isActive: true, platform })
    }
    // Different user → reject
    throw ApiError.badRequest('Device token đã được đăng ký bởi tài khoản khác')
  }

  // Giới hạn số thiết bị đồng bộ theo gói
  const plan = await getUserPlan(userId)
  const maxDevices = planLimit(plan, 'devices')
  if (maxDevices !== Infinity) {
    const count = await deviceRepo.countActive(userId)
    if (count >= maxDevices) {
      throw planLimitError({ feature: 'thiết bị đồng bộ', limit: maxDevices, plan })
    }
  }

  return deviceRepo.create(userId, deviceToken, platform)
}

// ─── List Active Devices ───────────────────────────────

export async function getDevices(userId) {
  return deviceRepo.findByUser(userId)
}

// ─── Soft Delete Device ────────────────────────────────

export async function deactivateDevice(userId, deviceId) {
  const device = await deviceRepo.findById(deviceId)
  if (!device) throw ApiError.notFound('Không tìm thấy thiết bị')
  if (device.userId !== userId) throw ApiError.forbidden()

  return deviceRepo.update(deviceId, { isActive: false })
}

// ─── Get Notification Settings ─────────────────────────

export async function getSettings(userId) {
  let setting = await deviceRepo.findSetting(userId)
  if (!setting) {
    setting = await deviceRepo.createSetting(userId)
  }
  return setting
}

// ─── Update Notification Settings ──────────────────────

// Chỉ 3 trường này được ghi. Nếu đưa thẳng body vào Prisma thì một khoá lạ
// (client cũ, gõ sai tên trường) làm Prisma ném "Unknown argument" → 500
// "Lỗi hệ thống" và màn Cài đặt đứng im.
const ALLOWED_SETTING_FIELDS = ['alarmSound', 'defaultSnoozeMinutes', 'vibrationEnabled']

export async function updateSettings(userId, data = {}) {
  // Âm thanh báo thức nâng cao / tùy chỉnh chỉ dành cho gói cao hơn
  if (data.alarmSound) {
    const plan = await getUserPlan(userId)
    const allowed = PLANS[plan]?.alarmSounds || PLANS.FREE.alarmSounds

    const customMatch = /^custom:(\d+)$/.exec(data.alarmSound)
    if (customMatch) {
      if (!['PLUS', 'PRO'].includes(plan)) {
        throw ApiError.badRequest(
          'Âm thanh báo thức tùy chỉnh chỉ dành cho gói Plus và Pro. Nâng cấp gói để sử dụng tính năng này.'
        )
      }
      const sound = await customSoundRepo.findOwned(parseInt(customMatch[1]), userId)
      if (!sound) {
        throw ApiError.badRequest('Âm thanh tùy chỉnh không tồn tại hoặc đã bị xóa')
      }
    } else if (!allowed.includes(data.alarmSound)) {
      throw ApiError.badRequest(
        `Âm thanh “${data.alarmSound}” chỉ dành cho gói Plus và Pro. Gói ${PLANS[plan]?.name || 'Miễn phí'} hỗ trợ: ${allowed.join(', ')}`
      )
    }
  }

  const patch = Object.fromEntries(
    Object.entries(data).filter(([key, value]) => ALLOWED_SETTING_FIELDS.includes(key) && value !== undefined)
  )

  const setting = await deviceRepo.findSetting(userId)
  if (!setting) {
    // Auto-create then update
    await deviceRepo.createSetting(userId)
  }
  if (!Object.keys(patch).length) return deviceRepo.findSetting(userId)
  return deviceRepo.updateSetting(userId, patch)
}

// ─── Get Notification Logs ─────────────────────────────

export async function getLogs(userId, query) {
  const { page, pageSize } = parsePagination(query)

  const result = await deviceRepo.findLogs(userId, {
    from: query.from,
    to: query.to,
    action: query.action,
    page,
    pageSize,
  })

  return {
    items: result.items,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    },
  }
}
