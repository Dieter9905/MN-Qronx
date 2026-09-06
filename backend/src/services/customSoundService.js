import customSoundRepo from '../repositories/customSoundRepo.js'
import deviceRepo from '../repositories/deviceRepo.js'
import ApiError from '../utils/ApiError.js'
import { getUserPlan } from '../utils/planLimits.js'

export const MAX_CUSTOM_SOUNDS = 10
export const MAX_FILE_BYTES = 3 * 1024 * 1024 // 3 MB

// ─── Danh sách âm thanh của user ────────────────────────

export async function listSounds(userId) {
  return customSoundRepo.findByUser(userId)
}

// ─── Import MP3 (chỉ Plus/Pro) ─────────────────────────

/**
 * @param {number} userId
 * @param {{ name?: string, mimeType?: string, dataBase64: string }} payload
 */
export async function importSound(userId, payload) {
  const plan = await getUserPlan(userId)
  if (!['PLUS', 'PRO'].includes(plan)) {
    throw ApiError.badRequest(
      'Nhập âm thanh báo thức MP3 riêng chỉ dành cho gói Plus và Pro. Nâng cấp gói để sử dụng tính năng này.'
    )
  }

  const count = await customSoundRepo.countByUser(userId)
  if (count >= MAX_CUSTOM_SOUNDS) {
    throw ApiError.badRequest(`Bạn chỉ được lưu tối đa ${MAX_CUSTOM_SOUNDS} âm thanh tùy chỉnh. Hãy xóa bớt âm thanh cũ trước khi thêm mới.`)
  }

  const buf = Buffer.from(String(payload.dataBase64 || ''), 'base64')
  if (!buf.length) {
    throw ApiError.badRequest('Không đọc được nội dung tệp âm thanh')
  }
  if (buf.length > MAX_FILE_BYTES) {
    throw ApiError.badRequest(`Tệp âm thanh tối đa ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB`)
  }

  // Kiểm tra sơ bộ đúng là file audio (magic bytes của MP3/WAV/OGG/M4A…)
  const looksLikeAudio = isAudioBuffer(buf)
  if (!looksLikeAudio) {
    throw ApiError.badRequest('Tệp không phải định dạng âm thanh hợp lệ (MP3, WAV, OGG, M4A…)')
  }

  const allowedMime = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/m4a',
    'audio/aac',
    'audio/mp4',
  ]
  const mimeType = allowedMime.includes(payload.mimeType) ? payload.mimeType : 'audio/mpeg'

  const rawName = String(payload.name || '').trim().replace(/\.(mp3|wav|ogg|m4a|aac)$/i, '')
  const name = (rawName || 'Âm thanh của tôi').slice(0, 120)

  return customSoundRepo.create(userId, {
    name,
    mimeType,
    sizeBytes: buf.length,
    data: buf,
  })
}

function isAudioBuffer(buf) {
  if (buf.length < 4) return false
  const head = buf.subarray(0, 12)
  // MP3: ID3 tag hoặc frame 0xFFEx
  if (head.toString('latin1', 0, 3) === 'ID3') return true
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true
  // WAV / OGG / FLAC / M4A
  const magic = head.toString('latin1', 0, 4)
  if (magic === 'RIFF') return true
  if (magic === 'OggS') return true
  if (magic === 'fLaC') return true
  if (head.toString('latin1', 4, 8) === 'ftyp') return true
  return false
}

// ─── Lấy dữ liệu nhị phân (phát âm thanh) ──────────────

export async function getSoundData(userId, soundId) {
  const sound = await customSoundRepo.findOwned(soundId, userId, { withData: true })
  if (!sound) throw ApiError.notFound('Không tìm thấy âm thanh tùy chỉnh')
  return {
    data: sound.data,
    name: sound.name,
    mimeType: sound.mimeType,
    sizeBytes: sound.sizeBytes,
  }
}

// ─── Xoá âm thanh ───────────────────────────────────────

export async function removeSound(userId, soundId) {
  const sound = await customSoundRepo.findOwned(soundId, userId)
  if (!sound) throw ApiError.notFound('Không tìm thấy âm thanh tùy chỉnh')

  await customSoundRepo.deleteSound(soundId)

  // Nếu đang được chọn làm âm thanh báo thức → quay về mặc định
  const setting = await deviceRepo.findSetting(userId)
  if (setting && setting.alarmSound === `custom:${soundId}`) {
    await deviceRepo.updateSetting(userId, { alarmSound: 'classic' })
  }

  return { soundId, removed: true }
}
