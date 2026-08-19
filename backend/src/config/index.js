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

  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    email: process.env.VAPID_EMAIL || 'mailto:admin@taskalarm.com',
  },

  fcm: {
    projectId: process.env.FCM_PROJECT_ID || '',
    privateKey: process.env.FCM_PRIVATE_KEY || '',
    clientEmail: process.env.FCM_CLIENT_EMAIL || '',
  },
}

export default config
