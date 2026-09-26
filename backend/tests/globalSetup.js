import prisma from '../src/config/prisma.js'
import { cleanupTestData } from './cleanupTestData.js'

/**
 * Dọn dẹp bao quanh cả vòng chạy test: xoá rác còn sót của lần trước, chạy test,
 * rồi xoá lại lần nữa. DATABASE_URL trỏ vào Postgres production nên nếu chỉ dọn
 * ở đầu mỗi tệp test thì tài khoản test cứ tích lại trong DB thật.
 */
export default async function globalSetup() {
  await cleanupTestData()

  return async function teardown() {
    await cleanupTestData()
    await prisma.$disconnect()
  }
}
