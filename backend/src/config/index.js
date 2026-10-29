import 'dotenv/config'

const required = (key) => {
  const val = process.env[key]
  if (!val) {
    throw new Error(`Missing required env variable: ${key}`)
  }
  return val
}

/** Số nguyên không âm; để trống hoặc sai định dạng thì dùng giá trị mặc định. */
const parseIntOr = (value, fallback) => {
  if (value === undefined || String(value).trim() === '') return fallback
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : fallback
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

  // Đường gửi thư — xem docs/email-domain-setup.md
  // transport: 'auto' (Resend → SMTP) | 'resend' | 'smtp'
  mail: {
    transport: (process.env.MAIL_TRANSPORT || 'auto').toLowerCase(),
  },

  // Resend (https://resend.com) — gửi qua HTTPS, có mã lỗi thật.
  // Cần xác thực tên miền gửi bằng bản ghi DNS: xem docs/email-domain-setup.md (mục Resend).
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    apiUrl: process.env.RESEND_API_URL || 'https://api.resend.com/emails',
    // Để trống → dùng EMAIL_FROM. Trước khi xác thực tên miền, Resend chỉ cho gửi
    // từ onboarding@resend.dev tới chính email chủ tài khoản.
    from: process.env.RESEND_FROM || '',
    timeoutMs: parseInt(process.env.RESEND_TIMEOUT_MS, 10) || 15000,
  },

  fcm: {
    projectId: process.env.FCM_PROJECT_ID || '',
    privateKey: process.env.FCM_PRIVATE_KEY || '',
    clientEmail: process.env.FCM_CLIENT_EMAIL || '',
  },

  // ─── Thanh toán (xem docs/billing.md) ───────────────────
  // Web: chuyển khoản ngân hàng qua VietQR, Casso/Sepay báo về webhook.
  // App Android: Google Play Billing (bắt buộc theo chính sách Play cho gói số).
  billing: {
    bank: {
      // BIN hoặc mã viết tắt của ngân hàng, vd 970436 (Vietcombank) hoặc VCB
      id: process.env.BANK_ID || '',
      account: process.env.BANK_ACCOUNT || '',
      owner: process.env.BANK_ACCOUNT_NAME || '',
      template: process.env.VIETQR_TEMPLATE || 'compact2',
    },
    orderTtlHours: parseIntOr(process.env.ORDER_TTL_HOURS, 48),
    // Số ngày dùng thử Pro miễn phí; đặt 0 để tắt hẳn chương trình dùng thử
    trialDays: parseIntOr(process.env.TRIAL_DAYS, 7),
    // Bí mật dùng để xác thực webhook ngân hàng (bắt buộc nếu dùng webhook).
    // Có thể đặt ngay trong app (Quản trị → Đơn hàng → Cài đặt nhận tiền) —
    // giá trị trong app được ưu tiên hơn biến môi trường này.
    webhookSecret: process.env.BILLING_WEBHOOK_SECRET || '',
    // Địa chỉ công khai của API, dùng để hiện đúng URL webhook cho admin.
    // Bỏ trống thì tự suy ra từ request (đúng cả khi đổi tên miền).
    publicApiUrl: (process.env.PUBLIC_API_URL || '').replace(/\/+$/, ''),

    // ─── Đọc giao dịch bằng API ngân hàng (xem bankApiService.js) ───
    // Đặt được ngay trong app (Quản trị → Đơn hàng → Cài đặt nhận tiền); giá trị
    // trong app được ưu tiên, các biến dưới đây chỉ là giá trị dự phòng.
    bankApi: {
      provider: (process.env.BANK_API_PROVIDER || '').toUpperCase(), // SEPAY | ACB
      baseUrl: process.env.BANK_API_BASE_URL || '',
      token: process.env.BANK_API_TOKEN || '', // SePay API token
      clientId: process.env.BANK_API_CLIENT_ID || '', // ACB ONE CONNECT
      clientSecret: process.env.BANK_API_CLIENT_SECRET || '',
      tokenUrl: process.env.BANK_API_TOKEN_URL || '',
      historyPath: process.env.BANK_API_HISTORY_PATH || '',
      // Đường dẫn tạo QR động của ngân hàng; trống = hệ thống tự sinh mã VietQR
      qrPath: process.env.BANK_API_QR_PATH || '',
      account: process.env.BANK_API_ACCOUNT || '',
      syncIntervalMinutes: parseIntOr(process.env.BANK_SYNC_INTERVAL_MINUTES, 5),
    },
    supportEmail: process.env.SUPPORT_EMAIL || 'support@mn-qronx.id.vn',
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
