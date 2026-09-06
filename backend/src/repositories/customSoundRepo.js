import prisma from '../config/prisma.js'

const META_SELECT = {
  customSoundId: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
}

async function findByUser(userId) {
  return prisma.customSound.findMany({
    where: { userId },
    select: META_SELECT,
    orderBy: { createdAt: 'desc' },
  })
}

async function countByUser(userId) {
  return prisma.customSound.count({ where: { userId } })
}

async function create(userId, data) {
  return prisma.customSound.create({
    data: { userId, ...data },
    select: META_SELECT,
  })
}

async function findOwned(soundId, userId, { withData = false } = {}) {
  return prisma.customSound.findFirst({
    where: { customSoundId: soundId, userId },
    select: withData
      ? { ...META_SELECT, data: true }
      : META_SELECT,
  })
}

async function deleteSound(soundId) {
  return prisma.customSound.delete({ where: { customSoundId: soundId } })
}

export default {
  findByUser,
  countByUser,
  create,
  findOwned,
  deleteSound,
}
