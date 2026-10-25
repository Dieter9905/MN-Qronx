// Chuyển dữ liệu cũ sau khi đổi gói "Pro Gia đình" (FAMILY) thành "Pro Doanh
// nghiệp" (BUSINESS) — xem prisma/schema.prisma (enum Plan, enum BillingProvider)
// và backend/src/utils/planLimits.js. Do schema chỉ đổi giá trị enum, những dòng
// đang mang giá trị cũ sẽ KHÔNG hợp lệ sau khi `prisma db push` tạo ràng buộc
// mới; script này cập nhật trước (hoặc sau) push, mọi lần chạy đều an toàn.
//
// Cách chạy (DATABASE_URL trỏ DB hượt pháp công khai của khách):
//   node scripts/convert-family-to-business.mjs          # chạy thử, chỉ đếm
//   node scripts/convert-family-to-business.mjs --apply  # ghi thật
import prisma from '../src/config/prisma.js'

const apply = process.argv.includes('--apply')

async function main() {
  const users = await prisma.user.updateMany({
    where: { plan: 'FAMILY' },
    data: { plan: 'BUSINESS' },
  })

  const subs = await prisma.subscription.updateMany({
    where: { provider: 'FAMILY' },
    data: { provider: 'BUSINESS' },
  })

  const familySeats = await prisma.subscription.findMany({
    where: { provider: 'BUSINESS' },
    select: { subscriptionId: true },
  })

  console.log(`users.plan  FAMILY → BUSINESS: ${users.count} dòng`)
  console.log(
    `subscriptions.provider FAMILY → BUSINESS: ${subs.count} dòng ` +
      `(trong đó ${familySeats.length} dòng là "chỗ dùng chung", đặt bởi familyService)`
  )

  if (!apply) {
    console.log('CHẠY THỬ — chưa ghi gì. Thêm --apply để ghi thật.')
  }
}

main()
  .catch((err) => {
    console.error('Lỗi chuyển đổi:', err?.message || err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
