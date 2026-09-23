import 'dotenv/config'

const required = (key) => {
  const val = process.env[key]
  if (!val) {
    throw new Error(`Missing required env variable: ${key}`)
  }
  return val
}

/**
 * Hạn mức gửi thư (theo giờ / theo ngày).
 * Mặc định 10 vì tài khoản Mailjet đang ở giai đoạn duyệt tạm (probation):
 * dashboard ghi "10 emails per hour", mail hỗ trợ lại ghi 10 thư/ngày.
 * Đặt biến tương ứng = 0 để TẮT kiểm tra cửa sổ đó (sau khi Mailjet gỡ giới hạn).
 */
const parseLimit = (value) => {
  if (value === undefined || String(value).trim() === '') return 10
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return 10
  return n
}

const config = {
  port: parseInt(process.env.PORT, 10) || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  database: {
    url: required('DATABASE_URL'),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: '1h', // AccessToken hết hạn 1 giờ
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    email: process.env.VAPID_EMAIL || 'mailto:admin@taskalarm.com',
  },

  // SMTP gửi email (mã xác nhận đăng ký, quên mật khẩu…)
  // Chưa cấu hình → dev log mã ra console để test, production trả lỗi gửi thư
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'MN-Qronx <no-reply@mn-qronx.id.vn>',
    secure: process.env.SMTP_SECURE === 'true',
  },

  // Mailjet Send API v3.1 (HTTPS 443) — xem docs/email-domain-setup.md
  // transport: 'auto' (API trước, SMTP dự phòng) | 'api' | 'smtp'
  mail: {
    transport: (process.env.MAIL_TRANSPORT || 'auto').toLowerCase(),
    apiUrl: process.env.MAILJET_API_URL || 'https://api.mailjet.com/v3.1/send',
    apiKey: process.env.MAILJET_API_KEY || process.env.SMTP_USER || '',
    secretKey: process.env.MAILJET_SECRET_KEY || process.env.SMTP_PASS || '',
    sandbox: process.env.MAILJET_SANDBOX === 'true',
    timeoutMs: parseInt(process.env.MAILJET_TIMEOUT_MS, 10) || 15000,
    // Endpoint REST v3 (đọc thống kê: statcounters, sender, domain…)
    restUrl: process.env.MAILJET_REST_URL || 'https://api.mailjet.com/v3/REST',
    // Hạn mức gửi + múi giờ dùng để xác định "một giờ"/"một ngày" (Mailjet reset theo giờ)
    hourlyLimit: parseLimit(process.env.MAIL_HOURLY_LIMIT),
    dailyLimit: parseLimit(process.env.MAIL_DAILY_LIMIT),
    quotaTimezone: process.env.MAIL_QUOTA_TZ || 'Asia/Ho_Chi_Minh',
  },

  fcm: {
    projectId: process.env.FCM_PROJECT_ID || '',
    privateKey: process.env.FCM_PRIVATE_KEY || '',
    clientEmail: process.env.FCM_CLIENT_EMAIL || '',
  },

  // AI riêng của MN-Qronx (self-hosted inference server, xem thư mục ai/ ở root).
  // Giữ đọc AI_BASE_URL/AI_MODEL cũ để tương thích ngược, ưu tiên tên mới.
  ai: {
    inferUrl: (process.env.AI_INFER_URL || process.env.AI_BASE_URL || 'http://localhost:8000').replace(/\/+$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    modelVersion: process.env.AI_MODEL_VERSION || process.env.AI_MODEL || 'mn-qronx-parser-v1',
  },
}

export default config
