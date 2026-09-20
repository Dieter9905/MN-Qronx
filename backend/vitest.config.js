import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    pool: 'forks',
    maxWorkers: 1,
    // Cấu hình gửi thư cố định cho test: có API key để luôn đi nhánh Mailjet API,
    // và TẮT mọi cửa sổ hạn mức để mỗi lần gửi chỉ có 1 request
    // (mailQuota.test.js tự bật lại cửa sổ cần kiểm tra).
    env: {
      MAIL_TRANSPORT: 'api',
      MAILJET_API_KEY: 'test-api-key',
      MAILJET_SECRET_KEY: 'test-secret-key',
      MAIL_HOURLY_LIMIT: '0',
      MAIL_DAILY_LIMIT: '0',
    },
  },
})
