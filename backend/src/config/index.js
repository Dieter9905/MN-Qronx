import 'dotenv/config'

const required = (key) => {
  const val = process.env[key]
  if (!val) {
    throw new Error(`Missing required env variable: ${key}`)
  }
  return val
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
  },

  fcm: {
    projectId: process.env.FCM_PROJECT_ID || '',
    privateKey: process.env.FCM_PRIVATE_KEY || '',
    clientEmail: process.env.FCM_CLIENT_EMAIL || '',
  },

  // AI thật qua 9Router (OpenAI-compatible gateway, key chỉ nằm ở server)
  ai: {
    baseUrl: process.env.AI_BASE_URL || 'http://localhost:20128/v1',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'kr/claude-sonnet-4.5',
  },
}

export default config
