import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('[Seed] Seeding database...')

  // ── Roles ─────────────────────────────────────────────
  const userRole = await prisma.role.upsert({
    where: { roleName: 'USER' },
    update: {},
    create: { roleName: 'USER', description: 'Người dùng quản lý công việc cá nhân' },
  })

  const adminRole = await prisma.role.upsert({
    where: { roleName: 'ADMIN' },
    update: {},
    create: { roleName: 'ADMIN', description: 'Quản trị viên hệ thống' },
  })

  console.log('[Seed] Roles:', userRole.roleName, adminRole.roleName)

  // ── Admin user ────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@taskalarm.com' },
    update: {},
    create: {
      roleId: adminRole.roleId,
      fullName: 'Quản trị viên',
      email: 'admin@taskalarm.com',
      passwordHash: adminPasswordHash,
      phoneNumber: '',
      isActive: true,
    },
  })

  // ── Default notification setting for admin ─────────────
  await prisma.notificationSetting.upsert({
    where: { userId: admin.userId },
    update: {},
    create: {
      userId: admin.userId,
      alarmSound: 'DEFAULT',
      defaultSnoozeMinutes: 5,
      vibrationEnabled: true,
    },
  })

  console.log('[Seed] Admin user:', admin.email)
  console.log('[Seed] Done!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('[Seed] Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
