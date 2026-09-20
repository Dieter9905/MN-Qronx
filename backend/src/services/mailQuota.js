import config from '../config/index.js'

/**
 * Hạn mức gửi thư theo thời gian của tài khoản Mailjet.
 *
 * Tài khoản MN-Qronx đang ở giai đoạn duyệt tạm (probation). Hai nguồn nói khác nhau:
 *   - Dashboard Mailjet (app.mailjet.com/account/apikeys): banner
 *     "A temporary global sending limit of 10 emails per hour is currently applied"
 *     → **10 thư/giờ**
 *   - Mail hỗ trợ 18/09/2026 lại viết "10 email mỗi ngày"
 *
 * Vì vậy app kiểm tra CẢ HAI cửa sổ và áp dụng cái chặt hơn. Chặn trước khi gửi để:
 *   - không dồn thư bị Mailjet từ chối (mỗi lần gửi lỗi là tín hiệu xấu khi xét duyệt),
 *   - trả thông báo rõ ràng thay vì lỗi API khó hiểu.
 *
 * Số thư đã gửi lấy từ chính Mailjet (statcounters) nên vẫn đúng khi server restart /
 * chạy nhiều instance. Không đọc được thống kê (mạng, quyền) thì **cho gửi tiếp** —
 * thà để Mailjet tự chặn còn hơn tự khoá oan.
 *
 * Tắt một cửa sổ bằng cách đặt hạn mức của nó = 0.
 */

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Sàn đếm cục bộ: số thư gửi thành công trong tiến trình hiện tại, theo từng cửa sổ.
// Dùng để bù khi thống kê của Mailjet cập nhật trễ vài giây.
// Cấu trúc: { 'hour:2026-09-20T14:00:00Z': 2, 'day:2026-09-20': 5 }
const localFloor = new Map()

export class MailjetQuotaError extends Error {
  constructor({ windowLabel, limit, sent, resetAt, timezone }) {
    super(
      `Đã dùng hết hạn mức ${limit} thư/${windowLabel} (đã gửi ${sent}). ` +
        `Hạn mức làm mới lúc ${resetAt.toLocaleString('vi-VN', { timeZone: timezone })} (${timezone}).`,
    )
    this.name = 'MailjetQuotaError'
    this.code = 'quota-exceeded'
    this.status = 429
    this.limit = limit
    this.sent = sent
    this.resetAt = resetAt
    this.hint =
      `Tài khoản Mailjet đang trong giai đoạn duyệt tạm (dashboard ghi 10 thư/giờ, ` +
      `mail hỗ trợ ghi 10 thư/ngày). Chờ sang ${windowLabel} mới, hoặc xin Mailjet gỡ giới hạn — ` +
      `xem docs/email-domain-setup.md (mục "Trạng thái tài khoản").`
  }
}

// ─── Cửa sổ thời gian ──────────────────────────────────────

/** Lệch múi giờ (ms) của `timeZone` tại thời điểm `date`. */
function tzOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  )
  return asUtc - date.getTime()
}

/** Đầu giờ chứa `date` theo múi giờ cấu hình. */
export function startOfHour(date = new Date(), timeZone = config.mail.quotaTimezone) {
  const offset = tzOffsetMs(date, timeZone)
  const local = new Date(date.getTime() + offset)
  const truncated = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    local.getUTCHours(),
  )
  return new Date(truncated - offset)
}

/** 00:00 của ngày chứa `date` theo múi giờ cấu hình. */
export function startOfDay(date = new Date(), timeZone = config.mail.quotaTimezone) {
  const offset = tzOffsetMs(date, timeZone)
  const local = new Date(date.getTime() + offset)
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return new Date(midnight - offset)
}

/** Thời điểm hạn mức ngày được làm mới (00:00 ngày kế tiếp). */
export function nextResetAt(date = new Date(), timeZone = config.mail.quotaTimezone) {
  return new Date(startOfDay(date, timeZone).getTime() + DAY_MS)
}

/** Khoá ngày "YYYY-MM-DD" theo múi giờ cấu hình. */
function dayKey(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

// ─── Hạn mức + cửa sổ ──────────────────────────────────────

const WINDOWS = [
  {
    key: 'hour',
    label: 'giờ',
    getLimit: () => config.mail.hourlyLimit,
    start: (now) => startOfHour(now),
    reset: (now) => new Date(startOfHour(now).getTime() + HOUR_MS),
    floorKey: (now) => `${dayKey(now, config.mail.quotaTimezone)}T${startOfHour(now).toISOString().slice(11, 13)}`,
  },
  {
    key: 'day',
    label: 'ngày',
    getLimit: () => config.mail.dailyLimit,
    start: (now) => startOfDay(now),
    reset: (now) => nextResetAt(now),
    floorKey: (now) => dayKey(now, config.mail.quotaTimezone),
  },
]

/** Hạn mức thư/giờ (0 = tắt kiểm tra). */
export function getHourlyLimit() {
  return config.mail.hourlyLimit
}

/** Hạn mức thư/ngày (0 = tắt kiểm tra). */
export function getDailyLimit() {
  return config.mail.dailyLimit
}

/** Có cửa sổ nào đang được kiểm tra không. */
export function isQuotaEnforced() {
  return WINDOWS.some((w) => w.getLimit() > 0)
}

function bumpLocalFloor(windowKey, floorKey, n) {
  const key = `${windowKey}:${floorKey}`
  localFloor.set(key, (localFloor.get(key) || 0) + n)
  return localFloor.get(key)
}

function getLocalFloor(windowKey, floorKey) {
  return localFloor.get(`${windowKey}:${floorKey}`) || 0
}

/** Ghi nhận một lần gửi thành công (gọi sau khi API/SMTP xác nhận). */
export function recordSend(count = 1) {
  if (!isQuotaEnforced()) return
  const now = new Date()
  for (const w of WINDOWS) {
    if (w.getLimit() > 0) bumpLocalFloor(w.key, w.floorKey(now), count)
  }
}

// ─── Đọc thống kê từ Mailjet ────────────────────────────────

function hasCredentials() {
  return Boolean(config.mail.apiKey && config.mail.secretKey)
}

/** GET 1 endpoint REST của Mailjet, tự cắt timeout. */
async function restGet(path) {
  const auth = Buffer.from(`${config.mail.apiKey}:${config.mail.secretKey}`).toString('base64')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.mail.timeoutMs)
  try {
    const res = await fetch(`${config.mail.restUrl}${path}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal,
    })
    const raw = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 200)}`)
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'quá thời gian chờ' : err.message)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Đếm số thư đã gửi kể từ `from` theo thống kê Mailjet.
 * Thử /statcounters trước, không dùng được thì đếm qua /message.
 * @returns {Promise<{count: number|null, error?: string, source?: string}>} count = null khi không đọc được.
 */
export async function fetchSentSince(from) {
  if (!hasCredentials()) return { count: null, error: 'Chưa cấu hình MAILJET_API_KEY / MAILJET_SECRET_KEY' }

  const fromTs = Math.floor(from.getTime() / 1000)
  try {
    const data = await restGet(
      `/statcounters?CounterSource=ApiKey&CounterTiming=Message&CounterResolution=Day&FromTS=${fromTs}`,
    )
    const rows = data?.Data || []
    const count = rows.reduce((sum, row) => sum + Number(row.MessageSentCount || 0), 0)
    return { count, source: 'statcounters' }
  } catch (statsErr) {
    // Dự phòng: /message trả về `Total` = số thư khớp bộ lọc FromTS
    try {
      const data = await restGet(`/message?FromTS=${fromTs}&Limit=1`)
      return { count: Number(data?.Total || 0), source: 'message' }
    } catch (msgErr) {
      return { count: null, error: `statcounters: ${statsErr.message} · message: ${msgErr.message}` }
    }
  }
}

/** Trạng thái của một cửa sổ hạn mức (giờ hoặc ngày). */
async function windowStatus(w, now) {
  const limit = w.getLimit()
  const floorKey = w.floorKey(now)
  const resetAt = w.reset(now)

  if (limit <= 0) {
    return { key: w.key, label: w.label, limit: 0, enforced: false, sent: null, remaining: null, resetAt, error: null }
  }

  const { count, error } = await fetchSentSince(w.start(now))
  const sent = Math.max(count ?? 0, getLocalFloor(w.key, floorKey))
  return {
    key: w.key,
    label: w.label,
    limit,
    enforced: true,
    sent,
    remaining: Math.max(0, limit - sent),
    countedFrom: count === null ? 'local' : 'mailjet',
    resetAt,
    error: error || null,
  }
}

/**
 * Trạng thái hạn mức hiện tại — dùng cho `npm run mail:status` và log cảnh báo.
 * Trả về từng cửa sổ (`hourly`, `daily`) + thông tin của cửa sổ đang "siết" nhất.
 */
export async function getQuotaStatus({ now = new Date() } = {}) {
  const timezone = config.mail.quotaTimezone
  const windows = await Promise.all(WINDOWS.map((w) => windowStatus(w, now)))
  const hour = windows.find((w) => w.key === 'hour')
  const day = windows.find((w) => w.key === 'day')

  // Cửa sổ chặt nhất = còn ít thư nhất (tính theo tỉ lệ), dùng cho thông báo lỗi
  const enforced = windows.filter((w) => w.enforced)
  const binding = enforced.sort((a, b) => a.remaining - b.remaining)[0] || null

  return {
    hourly: hour,
    daily: day,
    windows,
    enforced: enforced.length > 0,
    binding,
    limit: binding?.limit ?? 0,
    sent: binding?.sent ?? 0,
    remaining: binding?.remaining ?? null,
    resetAt: binding?.resetAt ?? day.resetAt,
    timezone,
  }
}

/**
 * Chặn gửi khi đã hết hạn mức của bất kỳ cửa sổ nào.
 * Ném MailjetQuotaError (status 429) nếu hết. Không đọc được thống kê → bỏ qua (fail open).
 */
export async function assertQuotaAvailable() {
  if (!isQuotaEnforced()) return null
  const status = await getQuotaStatus()

  for (const w of status.windows) {
    if (!w.enforced) continue
    if (w.remaining <= 0) {
      throw new MailjetQuotaError({
        windowLabel: w.label,
        limit: w.limit,
        sent: w.sent,
        resetAt: w.resetAt,
        timezone: status.timezone,
      })
    }
    if (w.error && w.countedFrom === 'local') {
      console.warn(`[MailQuota] Không đọc được thống kê Mailjet cho cửa sổ ${w.label} (${w.error}) — tạm bỏ qua kiểm tra.`)
    }
  }
  return status
}

export default {
  getHourlyLimit,
  getDailyLimit,
  isQuotaEnforced,
  startOfHour,
  startOfDay,
  nextResetAt,
  fetchSentSince,
  getQuotaStatus,
  assertQuotaAvailable,
  recordSend,
}
