import prisma from '../src/config/prisma.js'

/**
 * Dọn dữ liệu của TÀI KHOẢN KIỂM THỬ (`*@example.com`) khỏi DB.
 *
 * ⚠️ CHỈ đụng tới tài khoản `*@example.com`. DATABASE_URL của máy dev đang trỏ
 * thẳng vào Postgres production, nên mọi lệnh xoá ở đây phải có `where` — test
 * từng có lần xoá sạch công việc / danh mục của MỌI người dùng.
 *
 * Trước đây hàm này chỉ xoá dữ liệu con mà không xoá chính tài khoản test, nên
 * mỗi lần chạy test lại đổ thêm người dùng rác vào DB thật (từng lên tới 85).
 * Nay xoá luôn tài khoản và trả về số tài khoản đã dọn.
 */
export async function cleanupTestData() {
  const testUserEmail = { email: { endsWith: '@example.com' } }
  const testUser = { user: testUserEmail }
  const testUserTask = { task: { user: testUserEmail } }

  // ─── Con trước (các bảng có khoá ngoại RESTRICT, không tự xoá theo) ───
  await prisma.supportConversation.deleteMany({ where: testUser })
  await prisma.notificationLog.deleteMany({ where: { reminder: testUserTask } })
  await prisma.notificationSetting.deleteMany({ where: testUser })
  await prisma.device.deleteMany({ where: testUser })
  await prisma.refreshToken.deleteMany({ where: testUser })
  await prisma.passwordResetRequest.deleteMany({ where: testUser })
  await prisma.reminder.deleteMany({ where: testUserTask })
  await prisma.subtask.deleteMany({ where: testUserTask })
  await prisma.task.deleteMany({ where: testUser })
  await prisma.category.deleteMany({ where: testUser })
  await prisma.pointTransaction.deleteMany({ where: testUser })
  await prisma.invitation.deleteMany({
    where: { OR: [{ inviter: testUserEmail }, { invitee: testUserEmail }] },
  })

  // ─── Cha: xoá tài khoản test ───
  // payment_orders, subscriptions, ai_usage, custom_sounds tự xoá theo khoá ngoại (CASCADE).
  const removed = await prisma.user.deleteMany({ where: testUserEmail })
  await prisma.emailVerificationCode.deleteMany({ where: testUserEmail })

  return removed.count
}

export default cleanupTestData
