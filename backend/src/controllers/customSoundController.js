import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import * as customSoundService from '../services/customSoundService.js'

// GET /me/sounds
export const listSounds = catchAsync(async (req, res) => {
  const sounds = await customSoundService.listSounds(req.user.id)
  success(res, 200, 'Thao tác thành công', sounds)
})

// POST /me/sounds
export const importSound = catchAsync(async (req, res) => {
  const sound = await customSoundService.importSound(req.user.id, req.body)
  success(res, 201, 'Đã thêm âm thanh báo thức', sound)
})

// GET /me/sounds/:soundId/data – trả bytes audio (phát trong <audio>)
export const getSoundData = catchAsync(async (req, res) => {
  const sound = await customSoundService.getSoundData(req.user.id, parseInt(req.params.soundId))
  res.set({
    'Content-Type': sound.mimeType,
    'Content-Length': sound.sizeBytes,
    'Content-Disposition': `inline; filename="custom-${sound.name}"`,
    'Cache-Control': 'private, max-age=3600',
  })
  res.send(Buffer.from(sound.data))
})

// DELETE /me/sounds/:soundId
export const removeSound = catchAsync(async (req, res) => {
  const result = await customSoundService.removeSound(req.user.id, parseInt(req.params.soundId))
  success(res, 200, 'Đã xóa âm thanh', result)
})
