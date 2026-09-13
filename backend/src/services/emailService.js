import nodemailer from 'nodemailer'
import config from '../config/index.js'

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

/**
 * SMTP đã được cấu hình chưa (SMTP_HOST + SMTP_USER + SMTP_PASS).
 * Giữ tên cũ để không phá vỡ các chỗ đang gọi.
 */
export function isEmailConfigured() {
  return isApiConfigured() || isSmtpConfigured()
}

/** Đường gửi sẽ được dùng thực tế: 'api' | 'smtp' | 'none'. */
export function resolveTransport() {
  const want = config.mail.transport
  if (want === 'api') return isApiConfigured() ? 'api' : 'none'
  if (want === 'smtp') return isSmtpConfigured() ? 'smtp' : 'none'
  if (isApiConfigured()) return 'api'
  if (isSmtpConfigured()) return 'smtp'
  return 'none'
}

/** Thông tin chẩn đoán — dùng cho log khởi động và script gửi thử. */
export function getMailStatus() {
  return {
    transport: resolveTransport(),
    requested: config.mail.transport,
    apiConfigured: isApiConfigured(),
    smtpConfigured: isSmtpConfigured(),
    from: config.smtp.from,
    sandbox: config.mail.sandbox,
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
    throw new MailjetSendError({
      status: res.status,
      code,
      identifier: data?.ErrorIdentifier,
      message: data?.ErrorMessage || `Mailjet API trả HTTP ${res.status}`,
      hint: ERROR_HINTS[code],
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

// ─── API công khai ─────────────────────────────────────────

/**
 * Gửi 1 email. Mặc định dùng Mailjet Send API v3.1; đặt MAIL_TRANSPORT=smtp
 * để buộc đi SMTP. Khi chưa cấu hình gì: log nội dung ra console và trả
 * sent:false để phía gọi hiển thị mã xác nhận.
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

  if (transport === 'api') {
    const message = buildApiMessage(opts)
    try {
      const result = await sendViaMailjetApi(message)
      return { sent: true, via: 'api', messageId: result.messageId, messageUuid: result.messageUuid, accepted: result.accepted }
    } catch (err) {
      console.error(`[Email] Mailjet API lỗi${err.code ? ` (${err.code})` : ''}: ${err.message}`)
      throw err
    }
  }

  return sendViaSmtp(opts)
}

export default { isEmailConfigured, isApiConfigured, isSmtpConfigured, resolveTransport, getMailStatus, sendEmail }
