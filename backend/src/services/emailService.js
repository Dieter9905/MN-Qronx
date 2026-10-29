import nodemailer from 'nodemailer'
import config from '../config/index.js'

let transporter = null

// ─── Chọn đường gửi ────────────────────────────────────────
// Chỉ còn hai đường: Resend (HTTPS, trả mã lỗi thật) và SMTP. Mailjet đã bị gỡ
// khỏi dự án — tài khoản bị khoá gửi nên chỉ sinh lỗi 401 vô ích.
// MAIL_TRANSPORT=auto (mặc định) | resend | smtp

export function isSmtpConfigured() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass)
}

/** Resend đã có API key chưa (RESEND_API_KEY). */
export function isResendConfigured() {
  return Boolean(config.resend.apiKey)
}

/** Địa chỉ gửi thực tế của Resend: RESEND_FROM, không có thì dùng EMAIL_FROM. */
export function resendFrom() {
  return config.resend.from || config.smtp.from
}

/**
 * Đã cấu hình được ít nhất một đường gửi chưa.
 * Giữ tên cũ để không phá vỡ các chỗ đang gọi.
 */
export function isEmailConfigured() {
  return isResendConfigured() || isSmtpConfigured()
}

/** Đường gửi sẽ được dùng thực tế: 'resend' | 'smtp' | 'none'. */
export function resolveTransport() {
  const want = config.mail.transport
  if (want === 'resend') return isResendConfigured() ? 'resend' : 'none'
  if (want === 'smtp') return isSmtpConfigured() ? 'smtp' : 'none'
  // auto: Resend trước (không phụ thuộc hộp thư cá nhân), rồi SMTP
  if (isResendConfigured()) return 'resend'
  if (isSmtpConfigured()) return 'smtp'
  return 'none'
}

/** Thông tin chẩn đoán — dùng cho log khởi động và script gửi thử. */
export function getMailStatus() {
  const transport = resolveTransport()
  return {
    transport,
    requested: config.mail.transport,
    resendConfigured: isResendConfigured(),
    smtpConfigured: isSmtpConfigured(),
    from: transport === 'resend' ? resendFrom() : config.smtp.from,
  }
}

// ─── Chuẩn bị dữ liệu ──────────────────────────────────────

/**
 * Tách "Name" và "Email" từ chuỗi "Name <email@x.com>" hoặc "email@x.com".
 */
export function parseAddress(value) {
  const raw = String(value || '').trim()
  const m = /^([^<]*)<([^>]+)>/.exec(raw)
  if (m) return { Name: m[1].trim(), Email: m[2].trim() }
  return { Email: raw }
}

/** Chuẩn hoá danh sách người nhận: chuỗi, mảng chuỗi, hoặc mảng object. */
export function normalizeRecipients(value) {
  if (!value) return []
  const list = Array.isArray(value) ? value : String(value).split(',')
  return list
    .map((item) => (typeof item === 'string' ? parseAddress(item) : { Name: item?.Name, Email: item?.Email }))
    .filter((item) => item.Email)
}

// ─── Gửi qua SMTP ──────────────────────────────────────────

function getTransporter() {
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
    // Tránh treo request khi SMTP chậm/không kết nối được
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 25000,
  })
  return transporter
}

async function sendViaSmtp({ to, cc, bcc, replyTo, subject, text, html }) {
  const info = await getTransporter().sendMail({
    from: config.smtp.from,
    to: Array.isArray(to) ? to.join(', ') : to,
    ...(cc && { cc: Array.isArray(cc) ? cc.join(', ') : cc }),
    ...(bcc && { bcc: Array.isArray(bcc) ? bcc.join(', ') : bcc }),
    // Reply-To mặc định trùng tài khoản gửi: tăng độ tin cậy trong mắt Gmail
    // (thư hệ thống không có Reply-To, chỉ trả lời là vào hòm chủ, dễ bị coi bulk).
    replyTo: replyTo || config.smtp.user || undefined,
    subject,
    text,
    html,
  })
  return { sent: true, via: 'smtp', messageId: info.messageId }
}

// ─── Gửi qua Resend (https://resend.com) ───────────────────
// POST https://api.resend.com/emails
// Tài liệu: https://resend.com/docs/api-reference/emails/send-email

const RESEND_ERROR_HINTS = {
  401: 'RESEND_API_KEY sai hoặc đã bị thu hồi. Lấy key mới ở Resend → API Keys.',
  403: 'Tên miền gửi chưa được xác thực trong Resend. Thêm bản ghi DNS rồi bấm Verify — xem docs/email-domain-setup.md (mục Resend).',
  422: 'Dữ liệu gửi không hợp lệ (from/to/subject) — kiểm tra lại EMAIL_FROM / RESEND_FROM.',
  429: 'Vượt hạn mức gửi của Resend (gói miễn phí: 100 thư/ngày · 3.000/tháng). Thử lại sau.',
}

export class ResendSendError extends Error {
  constructor({ status, code, message, hint }) {
    super(hint ? `${message} — ${hint}` : message)
    this.name = 'ResendSendError'
    this.status = status
    this.code = code
    this.hint = hint
  }
}

/** Định dạng địa chỉ theo Resend: "Tên <email@x.com>" hoặc "email@x.com". */
export function formatResendAddress(value) {
  const { Name, Email } = parseAddress(value)
  if (!Email) return ''
  return Name ? `${Name} <${Email}>` : Email
}

/** Dựng payload theo Send Email API của Resend. */
export function buildResendPayload({ to, cc, bcc, replyTo, subject, text, html, headers }) {
  const asList = (value) =>
    normalizeRecipients(value)
      .map((a) => formatResendAddress(a.Name ? `${a.Name} <${a.Email}>` : a.Email))
      .filter(Boolean)

  const payload = {
    from: formatResendAddress(resendFrom()),
    to: asList(to),
    subject: subject || '',
  }

  const ccList = asList(cc)
  const bccList = asList(bcc)
  if (ccList.length) payload.cc = ccList
  if (bccList.length) payload.bcc = bccList
  if (replyTo) payload.reply_to = formatResendAddress(replyTo)
  if (text) payload.text = text
  if (html) payload.html = html
  if (headers) payload.headers = headers
  return payload
}

async function sendViaResend(payload) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.resend.timeoutMs)

  let res
  let raw
  try {
    res = await fetch(config.resend.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resend.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    raw = await res.text()
  } catch (err) {
    throw new ResendSendError({
      status: 0,
      message: err.name === 'AbortError' ? 'Gọi Resend API quá thời gian chờ' : `Không kết nối được Resend API: ${err.message}`,
      hint: 'Kiểm tra kết nối mạng / RESEND_API_URL.',
    })
  } finally {
    clearTimeout(timer)
  }

  let data = null
  try {
    data = JSON.parse(raw)
  } catch {
    data = null
  }

  if (!res.ok) {
    const message = data?.message || `Resend API trả HTTP ${res.status}`
    // Resend không nhất quán mã trạng thái (key sai có lúc trả 400, lúc 401), nên
    // ngoài mã HTTP còn soi nội dung thông báo để chọn gợi ý đúng.
    const hint =
      RESEND_ERROR_HINTS[res.status] ||
      (/verif/i.test(message)
        ? RESEND_ERROR_HINTS[403]
        : /api key/i.test(message)
          ? RESEND_ERROR_HINTS[401]
          : '')
    throw new ResendSendError({ status: res.status, code: data?.name || '', message, hint })
  }

  return {
    status: 'success',
    messageId: data?.id ? String(data.id) : '',
    accepted: payload.to.length + (payload.cc?.length || 0) + (payload.bcc?.length || 0),
  }
}

// ─── API công khai ─────────────────────────────────────────

/**
 * Gửi 1 email. Thứ tự mặc định (MAIL_TRANSPORT=auto): Resend → SMTP.
 * Đặt MAIL_TRANSPORT=resend|smtp để buộc đi một đường.
 * Khi chưa cấu hình gì: log nội dung ra console và trả sent:false để phía gọi
 * hiển thị mã xác nhận.
 *
 * @param {object} opts { to, subject, text, html, cc, bcc, replyTo, templateId, templateVariables, customId }
 * @returns {Promise<{sent: boolean, via?: string, messageId?: string, smtpMissing?: boolean, devLog?: string}>}
 */
export async function sendEmail(opts) {
  const { to, subject, text } = opts
  const transport = resolveTransport()

  if (transport === 'none') {
    console.log(`\n[Email DEV] → ${to}\n  Chủ đề: ${subject}\n  ${text}\n`)
    return { sent: false, smtpMissing: true, devLog: text }
  }

  if (transport === 'resend') {
    const payload = buildResendPayload(opts)
    try {
      const result = await sendViaResend(payload)
      return { sent: true, via: 'resend', messageId: result.messageId, accepted: result.accepted }
    } catch (err) {
      console.error(`[Email] Resend lỗi${err.status ? ` (HTTP ${err.status})` : ''}: ${err.message}`)
      throw err
    }
  }

  return sendViaSmtp(opts)
}

export default {
  isEmailConfigured,
  isSmtpConfigured,
  isResendConfigured,
  resolveTransport,
  getMailStatus,
  sendEmail,
  ResendSendError,
}
