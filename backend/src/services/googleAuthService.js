import crypto from 'node:crypto'
import config from '../config/index.js'
import ApiError from '../utils/ApiError.js'
import { loginWithGoogle } from './authService.js'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

/**
 * Kiểm tra Google OAuth đã được cấu hình chưa.
 */
export function isConfigured() {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.callbackUrl)
}

/**
 * Tạo URL đăng nhập Google (Authorization Code flow).
 */
export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Đổi code lấy access_token từ Google.
 */
export async function exchangeCode(code) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.callbackUrl,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw ApiError.unauthorized('Không thể trao đổi mã xác thực Google')
  }
  return data
}

/**
 * Lấy thông tin user từ Google.
 */
export async function getUserInfo(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok || !data.email) {
    throw ApiError.unauthorized('Không lấy được thông tin tài khoản Google')
  }
  return data
}

/**
 * Chạy toàn bộ luồng callback: đổi code → lấy userinfo → đăng nhập/tạo tài khoản.
 * Trả về { accessToken, refreshToken, user } giống login thường.
 */
export async function handleGoogleCallback(code) {
  const tokenData = await exchangeCode(code)
  const profile = await getUserInfo(tokenData.access_token)

  return loginWithGoogle({
    googleId: profile.sub,
    email: profile.email,
    fullName: profile.name,
    avatarUrl: profile.picture || null,
  })
}

/**
 * Sinh state ngẫu nhiên chống CSRF.
 */
export function generateState() {
  return crypto.randomBytes(16).toString('hex')
}