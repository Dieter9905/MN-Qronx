import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('[Seed] Seeding database...')

  // ── Roles ─────────────────────────────────────────────
  const userRole = await prisma.role.upsert({
    where: { roleName: 'USER' },
    update: {},
    create: { roleName: 'USER', description: 'Nguoi dung quan ly cong viec ca nhan' },
  })

  const adminRole = await prisma.role.upsert({
    where: { roleName: 'ADMIN' },
    update: {},
    create: { roleName: 'ADMIN', description: 'Quan tri vien he thong' },
  })

  console.log('[Seed] Roles:', userRole.roleName, adminRole.roleName)

  // ── Admin user ────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@taskalarm.com' },
    update: {},
    create: {
      roleId: adminRole.roleId,
      fullName: 'Admin TaskAlarm',
      email: 'admin@taskalarm.com',
      passwordHash: adminPasswordHash,
      phoneNumber: '0901234567',
      isActive: true,
    },
  })

  await prisma.notificationSetting.upsert({
    where: { userId: admin.userId },
    update: {},
    create: { userId: admin.userId, alarmSound: 'DEFAULT', defaultSnoozeMinutes: 5, vibrationEnabled: true },
  })

  // ── Demo user ─────────────────────────────────────────
  const userPasswordHash = await bcrypt.hash('User@1234', 10)
  const planStart = new Date()
  const planEnd = new Date(planStart.getTime() + 30 * 86400000)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@taskalarm.com' },
    update: { plan: 'PLUS', planStartedAt: planStart, planExpiresAt: planEnd },
    create: {
      roleId: userRole.roleId,
      fullName: 'Nguyen Van A',
      email: 'demo@taskalarm.com',
      passwordHash: userPasswordHash,
      phoneNumber: '0912345678',
      isActive: true,
      plan: 'PLUS',
      planStartedAt: planStart,
      planExpiresAt: planEnd,
    },
  })

  await prisma.notificationSetting.upsert({
    where: { userId: demoUser.userId },
    update: {},
    create: { userId: demoUser.userId, alarmSound: 'URGENT', defaultSnoozeMinutes: 10, vibrationEnabled: true },
  })

  console.log('[Seed] Users:', admin.email, demoUser.email)

  // ── Categories ────────────────────────────────────────
  const categories = [
    { categoryName: 'Cong viec', colorCode: '#FF5722' },
    { categoryName: 'Hoc tap', colorCode: '#2196F3' },
    { categoryName: 'Suc khoe', colorCode: '#4CAF50' },
    { categoryName: 'Tai chinh', colorCode: '#FFC107' },
    { categoryName: 'Gia dinh', colorCode: '#9C27B0' },
  ]

  const savedCategories = []
  for (const cat of categories) {
    const existing = await prisma.category.findFirst({
      where: { userId: demoUser.userId, categoryName: cat.categoryName },
    })
    if (!existing) {
      const created = await prisma.category.create({
        data: { userId: demoUser.userId, ...cat },
      })
      savedCategories.push(created)
    } else {
      savedCategories.push(existing)
    }
  }

  console.log('[Seed] Categories:', savedCategories.length)

  // ── Tasks ─────────────────────────────────────────────
  const now = new Date()
  const day = (d) => new Date(now.getTime() + d * 86400000)
  const hour = (h) => new Date(now.getTime() + h * 3600000)

  const tasksData = [
    // TODO tasks
    { title: 'Hoan thanh bao cao Q3', priority: 'HIGH', status: 'TODO', dueAt: day(2), categoryId: savedCategories[0].categoryId, repeatType: 'NONE' },
    { title: 'On thi Final Database', priority: 'URGENT', status: 'TODO', dueAt: day(5), categoryId: savedCategories[1].categoryId, repeatType: 'NONE' },
    { title: 'Di kham suc khoe dinh ky', priority: 'MEDIUM', status: 'TODO', dueAt: day(7), categoryId: savedCategories[2].categoryId, repeatType: 'MONTHLY' },
    { title: 'Nop thue thu nhap ca nhan', priority: 'HIGH', status: 'TODO', dueAt: day(10), categoryId: savedCategories[3].categoryId, repeatType: 'NONE' },
    { title: 'Mua qua sinh nhat me', priority: 'MEDIUM', status: 'TODO', dueAt: day(3), categoryId: savedCategories[4].categoryId, repeatType: 'NONE' },

    // IN_PROGRESS tasks
    { title: 'Trien khai module Authentication', priority: 'HIGH', status: 'IN_PROGRESS', dueAt: day(1), categoryId: savedCategories[0].categoryId, repeatType: 'NONE' },
    { title: 'Viet bai tap lon mon Web', priority: 'URGENT', status: 'IN_PROGRESS', dueAt: hour(6), categoryId: savedCategories[1].categoryId, repeatType: 'NONE' },
    { title: 'Chay bo 30 phut moi sang', priority: 'LOW', status: 'IN_PROGRESS', dueAt: day(0), categoryId: savedCategories[2].categoryId, repeatType: 'DAILY' },

    // OVERDUE tasks
    { title: 'Nop bai tap CSDL', priority: 'URGENT', status: 'TODO', dueAt: day(-2), categoryId: savedCategories[1].categoryId, repeatType: 'NONE' },
    { title: 'Thanh toan tien dien', priority: 'HIGH', status: 'TODO', dueAt: day(-1), categoryId: savedCategories[3].categoryId, repeatType: 'NONE' },

    // COMPLETED tasks
    { title: 'Setup moi truong phat trien', priority: 'MEDIUM', status: 'COMPLETED', dueAt: day(-3), completedAt: day(-3), categoryId: savedCategories[0].categoryId, repeatType: 'NONE' },
    { title: 'Viet CV xin thuc tap', priority: 'HIGH', status: 'COMPLETED', dueAt: day(-5), completedAt: day(-6), categoryId: savedCategories[0].categoryId, repeatType: 'NONE' },
    { title: 'Doc sach Clean Code', priority: 'LOW', status: 'COMPLETED', dueAt: day(-7), completedAt: day(-8), categoryId: savedCategories[1].categoryId, repeatType: 'NONE' },

    // CANCELLED task
    { title: 'Hop nhom PROJECT', priority: 'MEDIUM', status: 'CANCELLED', dueAt: day(-1), categoryId: savedCategories[0].categoryId, repeatType: 'NONE' },

    // REPEAT task
    { title: 'Lau don phong', priority: 'LOW', status: 'TODO', dueAt: day(4), categoryId: savedCategories[4].categoryId, repeatType: 'WEEKLY' },
  ]

  // Delete existing demo tasks
  await prisma.notificationLog.deleteMany({ where: { reminder: { task: { userId: demoUser.userId } } } })
  await prisma.reminder.deleteMany({ where: { task: { userId: demoUser.userId } } })
  await prisma.subtask.deleteMany({ where: { task: { userId: demoUser.userId } } })
  await prisma.task.deleteMany({ where: { userId: demoUser.userId } })

  const savedTasks = []
  for (const t of tasksData) {
    const task = await prisma.task.create({
      data: { userId: demoUser.userId, ...t },
    })
    savedTasks.push(task)
  }

  console.log('[Seed] Tasks:', savedTasks.length)

  // ── Subtasks ──────────────────────────────────────────
  const subtasksData = [
    { taskId: savedTasks[0].taskId, content: 'Thu thap du lieu Q3', isCompleted: true, displayOrder: 1 },
    { taskId: savedTasks[0].taskId, content: 'Phan tich xu huong', isCompleted: true, displayOrder: 2 },
    { taskId: savedTasks[0].taskId, content: 'Viet bao cao tong hop', isCompleted: false, displayOrder: 3 },
    { taskId: savedTasks[0].taskId, content: 'Review cung team', isCompleted: false, displayOrder: 4 },
    { taskId: savedTasks[5].taskId, content: 'Viet code module Auth', isCompleted: true, displayOrder: 1 },
    { taskId: savedTasks[5].taskId, content: 'Viet code module User', isCompleted: true, displayOrder: 2 },
    { taskId: savedTasks[5].taskId, content: 'Viet code module Task', isCompleted: false, displayOrder: 3 },
    { taskId: savedTasks[5].taskId, content: 'Viet tests', isCompleted: false, displayOrder: 4 },
  ]

  for (const s of subtasksData) {
    await prisma.subtask.create({ data: s })
  }

  console.log('[Seed] Subtasks:', subtasksData.length)

  // ── Reminders ─────────────────────────────────────────
  const remindersData = [
    { taskId: savedTasks[0].taskId, remindAt: day(1), status: 'SCHEDULED' },
    { taskId: savedTasks[0].taskId, remindAt: day(2), status: 'SCHEDULED' },
    { taskId: savedTasks[6].taskId, remindAt: hour(2), status: 'SCHEDULED' },
    { taskId: savedTasks[8].taskId, remindAt: day(-2), status: 'TRIGGERED', snoozeCount: 1 },
    { taskId: savedTasks[9].taskId, remindAt: day(-1), status: 'DISMISSED' },
    { taskId: savedTasks[3].taskId, remindAt: day(10), status: 'SCHEDULED' },
  ]

  for (const r of remindersData) {
    await prisma.reminder.create({ data: r })
  }

  console.log('[Seed] Reminders:', remindersData.length)

  // ── Devices ───────────────────────────────────────────
  const existingDevice = await prisma.device.findFirst({
    where: { userId: demoUser.userId, deviceToken: 'demo-web-push-token-abc123' },
  })
  if (!existingDevice) {
    await prisma.device.create({
      data: {
        userId: demoUser.userId,
        deviceToken: 'demo-web-push-token-abc123',
        platform: 'WEB',
        isActive: true,
      },
    })
  }

  console.log('[Seed] Devices: 1')
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
