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
    avatarUrl: toGoogleAvatarUrl(profile.picture),
  })
}

/**
 * Google trả ảnh đại diện mặc định ở 96px (hậu tố "=s96-c"), dùng làm avatar
 * trên web sẽ bị mờ. Đổi sang kích thước lớn hơn; giữ nguyên nếu là URL khác.
 */
export function toGoogleAvatarUrl(picture, size = 256) {
  const raw = String(picture || '').trim()
  if (!raw) return null
  if (!/googleusercontent\.com/.test(raw)) return raw
  return raw.replace(/=s\d+(-c)?$/, `=s${size}-c`)
}

/**
 * State tự xác thực (HMAC + timestamp) chống CSRF.
 *
 * Trước đây state được lưu vào cookie và so khớp ở callback — nhưng một số
 * trình duyệt/trình chặn quảng cáo huỷ cookie SameSite=Lax trong luồng chuyển
 * trang (start → Google → callback), làm login Google luôn trượt với lỗi
 * `google_state`. Đổi sang state tự chứng thực: định dạng
 * `nonce.timestamp.chữ-ký`, chỉ server có secret mới sinh được chữ ký hợp lệ,
 * và quá 10 phút là vô hiệu — không cần cookie, không cần lưu server-side.
 */
export const STATE_TTL_MS = 10 * 60 * 1000

function signState(nonce, ts) {
  return crypto
    .createHmac('sha256', config.jwt.secret)
    .update(`${nonce}.${ts}`)
    .digest('hex')
}

export function generateState() {
  const nonce = crypto.randomBytes(16).toString('hex')
  const ts = Date.now().toString(36)
  return `${nonce}.${ts}.${signState(nonce, ts)}`
}

/**
 * Xác thực state của callback Google: chữ ký đúng và không quá hạn (10 phút).
 */
export function verifyState(state) {
  const [nonce, ts, sig] = String(state || '').split('.')
  if (!nonce || !ts || !sig) return false
  const expected = signState(nonce, ts)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  const issued = parseInt(ts, 36)
  const age = Date.now() - issued
  return Number.isFinite(issued) && age >= 0 && age <= STATE_TTL_MS
}