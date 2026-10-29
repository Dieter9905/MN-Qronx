import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    pool: 'forks',
    maxWorkers: 1,
    // Dọn tài khoản test cả trước và sau khi chạy: DATABASE_URL đang trỏ vào
    // Postgres production nên nếu không dọn ở cuối thì rác cứ tích lại.
    globalSetup: ['./tests/globalSetup.js'],
    // Không đặt khoá gửi thư nào: mặc định mọi lần gửi rơi vào nhánh "chưa cấu
    // hình" (log ra console, không gọi mạng). Test nào cần kiểm tra Resend/SMTP
    // thì tự chỉnh config trong file của nó.
    env: {
      MAIL_TRANSPORT: 'auto',
    },
  },
})
