import nodemailer from 'nodemailer'
import config from '../config/index.js'
import { assertQuotaAvailable, recordSend, MailjetQuotaError } from './mailQuota.js'

let transporter = null

// ─── Chọn đường gửi ────────────────────────────────────────
// Mailjet Send API v3.1 được ưu tiên vì trả về mã lỗi thật (ví dụ tài khoản bị
// khoá: 401 mj-0001). SMTP có thể nhận lệnh rồi bỏ luôn thư khi tài khoản bị
// hạn chế, nên "gửi thành công" qua SMTP không đáng tin.
// MAIL_TRANSPORT=auto (mặc định) | api | smtp

export function isApiConfigured() {
  return Boolean(config.mail.apiKey && config.mail.secretKey)
}

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
  return isResendConfigured() || isApiConfigured() || isSmtpConfigured()
}

/** Đường gửi sẽ được dùng thực tế: 'resend' | 'api' | 'smtp' | 'none'. */
export function resolveTransport() {
  const want = config.mail.transport
  if (want === 'resend') return isResendConfigured() ? 'resend' : 'none'
  if (want === 'api') return isApiConfigured() ? 'api' : 'none'
  if (want === 'smtp') return isSmtpConfigured() ? 'smtp' : 'none'
  // auto: Resend trước (không phụ thuộc tài khoản Mailjet), rồi Mailjet API, cuối cùng SMTP
  if (isResendConfigured()) return 'resend'
  if (isApiConfigured()) return 'api'
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
    apiConfigured: isApiConfigured(),
    smtpConfigured: isSmtpConfigured(),
    from: transport === 'resend' ? resendFrom() : config.smtp.from,
    sandbox: config.mail.sandbox,
    // Hạn mức gửi của Mailjet khi còn duyệt tạm (0 = tắt kiểm tra cửa sổ đó)
    hourlyLimit: config.mail.hourlyLimit,
    dailyLimit: config.mail.dailyLimit,
    quotaTimezone: config.mail.quotaTimezone,
  }
}

// ─── Lỗi từ Mailjet Send API ───────────────────────────────

const ERROR_HINTS = {
  'mj-0001':
    'Tài khoản Mailjet đang bị tạm khoá gửi. Cần trả lời ticket hỗ trợ để gỡ — xem docs/email-domain-setup.md (Bước 8).',
  'mj-0002':
    'Địa chỉ gửi (From) chưa được xác thực trong Mailjet. Thêm và kích hoạt sender trước khi gửi.',
  'mj-0004':
    'Dữ liệu gửi không hợp lệ — kiểm tra lại From/To/Subject/nội dung.',
}

export class MailjetSendError extends Error {
  constructor({ status, code, identifier, message, hint }) {
    super(hint ? `${message} — ${hint}` : message)
    this.name = 'MailjetSendError'
    this.status = status
    this.code = code
    this.identifier = identifier
    this.hint = hint
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

/**
 * Dựng payload 1 message theo Send API v3.1:
 * https://dev.mailjet.com/docs/email-api/send-api-v31/send-basic-email
 * From/To bắt buộc; cần ít nhất TextPart hoặc HTMLPart (trừ khi dùng TemplateID).
 */
export function buildApiMessage({ to, cc, bcc, replyTo, subject, text, html, templateId, templateVariables, customId }) {
  const from = parseAddress(config.smtp.from || config.mail.apiKey)
  const message = {
    From: from.Name ? { Email: from.Email, Name: from.Name } : { Email: from.Email },
    To: normalizeRecipients(to),
  }

  const ccList = normalizeRecipients(cc)
  const bccList = normalizeRecipients(bcc)
  if (ccList.length) message.Cc = ccList
  if (bccList.length) message.Bcc = bccList
  if (replyTo) message.ReplyTo = parseAddress(replyTo)
  if (subject) message.Subject = subject

  if (templateId) {
    // Khi dùng template, KHÔNG đặt TextPart/HTMLPart
    message.TemplateID = Number(templateId)
    if (templateVariables) message.Variables = templateVariables
  } else {
    if (text) message.TextPart = text
    if (html) message.HTMLPart = html
  }

  if (customId) message.CustomID = String(customId)
  return message
}

// ─── Gửi qua Send API v3.1 ─────────────────────────────────

async function sendViaMailjetApi(message) {
  const payload = { Messages: [message] }
  if (config.mail.sandbox) payload.SandboxMode = true

  const auth = Buffer.from(`${config.mail.apiKey}:${config.mail.secretKey}`).toString('base64')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.mail.timeoutMs)

  let res
  let raw
  try {
    res = await fetch(config.mail.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    raw = await res.text()
  } catch (err) {
    throw new MailjetSendError({
      status: 0,
      message: err.name === 'AbortError' ? 'Gọi Mailjet API quá thời gian chờ' : `Không kết nối được Mailjet API: ${err.message}`,
      hint: 'Kiểm tra kết nối mạng / MAILJET_API_URL.',
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
    const code = data?.ErrorCode || ''
    // 429 = vượt hạn mức/rate limit (giai đoạn duyệt tạm: 10 thư/ngày)
    const hint =
      ERROR_HINTS[code] ||
      (res.status === 429
        ? 'Có thể đã chạm hạn mức gửi trong ngày của Mailjet (tài khoản đang duyệt tạm: 10 thư/ngày). Chạy `npm run mail:status` để xem quota còn lại.'
        : undefined)
    throw new MailjetSendError({
      status: res.status,
      code,
      identifier: data?.ErrorIdentifier,
      message: data?.ErrorMessage || `Mailjet API trả HTTP ${res.status}`,
      hint,
    })
  }

  const result = data?.Messages?.[0]
  if (!result) {
    throw new MailjetSendError({ status: res.status, message: 'Mailjet API không trả về kết quả gửi', hint: raw.slice(0, 200) })
  }
  if (result.Status !== 'success') {
    throw new MailjetSendError({
      status: res.status,
      code: result.Status,
      message: `Mailjet từ chối gửi: ${result.Status}`,
      hint: JSON.stringify(result.Errors || result).slice(0, 300),
    })
  }

  // Metadata theo người nhận: To/Cc/Bcc đều có MessageID · MessageUUID · MessageHref
  const recipients = [...(result.To || []), ...(result.Cc || []), ...(result.Bcc || [])]
  const first = recipients[0] || {}
  return {
    status: result.Status,
    messageId: first.MessageID ? String(first.MessageID) : '',
    messageUuid: first.MessageUUID || '',
    messageHref: first.MessageHref || '',
    accepted: recipients.length,
  }
}

// ─── Gửi qua SMTP (dự phòng) ───────────────────────────────

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
    ...(replyTo && { replyTo }),
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
 * Gửi 1 email. Thứ tự mặc định (MAIL_TRANSPORT=auto): Resend → Mailjet Send API
 * v3.1 → SMTP. Đặt MAIL_TRANSPORT=resend|api|smtp để buộc đi một đường.
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

  // Hạn mức gửi là giới hạn ở tầng tài khoản Mailjet (áp cho cả API và SMTP), nên kiểm
  // tra trước khi gửi để không đốt quota bằng những lần gửi chắc chắn thất bại.
  // SandboxMode không gửi thật → bỏ qua kiểm tra. Đi đường Resend thì hạn mức của
  // Mailjet không liên quan, không được để nó chặn thư gửi được.
  if (transport !== 'resend' && !config.mail.sandbox) {
    await assertQuotaAvailable()
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

  if (transport === 'api') {
    const message = buildApiMessage(opts)
    try {
      const result = await sendViaMailjetApi(message)
      recordSend(result.accepted || 1)
      return { sent: true, via: 'api', messageId: result.messageId, messageUuid: result.messageUuid, accepted: result.accepted }
    } catch (err) {
      console.error(`[Email] Mailjet API lỗi${err.code ? ` (${err.code})` : ''}: ${err.message}`)
      throw err
    }
  }

  const info = await sendViaSmtp(opts)
  recordSend(normalizeRecipients(opts.to).length || 1)
  return info
}

export { MailjetQuotaError }

export default {
  isEmailConfigured,
  isApiConfigured,
  isSmtpConfigured,
  isResendConfigured,
  resolveTransport,
  getMailStatus,
  sendEmail,
  MailjetSendError,
  MailjetQuotaError,
}
