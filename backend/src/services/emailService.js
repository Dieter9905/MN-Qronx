import nodemailer from 'nodemailer'
import config from '../config/index.js'

let transporter = null

/**
 * SMTP đã được cấu hình chưa (SMTP_HOST + SMTP_USER + SMTP_PASS).
 */
export function isEmailConfigured() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass)
}

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

/**
 * Tách "Name" và "Email" từ chuỗi "Name <email@x.com>".
 */
function parseFrom(from) {
  const m = /^([^<]*)<([^>]+)>/.exec(String(from || '').trim())
  if (m) return { name: m[1].trim(), email: m[2].trim() }
  return { name: '', email: String(from || '').trim() }
}

/**
 * Gửi email qua REST API Mailjet (HTTPS 443) — hoạt động cả khi
 * host chặn cổng SMTP (như Render chặn 587/465).
 * Dùng chính API key (SMTP_USER) + secret key (SMTP_PASS) làm chứng thực.
 */
async function sendViaMailjetApi({ to, subject, text, html }) {
  const { name, email } = parseFrom(config.smtp.from || config.smtp.user)
  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.smtp.user}:${config.smtp.pass}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: email, Name: name || 'MN-Qronx' },
          To: [{ Email: to }],
          Subject: subject,
          TextPart: text,
          HTMLPart: html,
        },
      ],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Mailjet API ${res.status}: ${JSON.stringify(data).slice(0, 200)}`)
  }
  const msg = data?.Messages?.[0]
  const id = msg?.To?.[0]?.MessageID || msg?.Status
  return String(id || '')
}

/**
 * Gửi email. Ưu tiên SMTP; nếu SMTP lỗi (vd host chặn cổng SMTP)
 * tự động thử REST API Mailjet qua HTTPS. Khi chưa cấu hình gì:
 * log nội dung ra console và trả sent:false để API fallback hiển thị mã.
 *
 * @param {object} opts { to, subject, text, html }
 * @returns {Promise<{sent: boolean, via?: string, messageId?: string, smtpMissing?: boolean, devLog?: string}>}
 */
export async function sendEmail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    console.log(`\n[Email DEV] → ${to}\n  Chủ đề: ${subject}\n  ${text}\n`)
    return { sent: false, smtpMissing: true, devLog: text }
  }

  try {
    const info = await getTransporter().sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html,
    })
    return { sent: true, via: 'smtp', messageId: info.messageId }
  } catch (smtpErr) {
    // SMTP không kết nối được (chặn cổng) hoặc lỗi khác → thử REST API Mailjet qua 443
    try {
      const messageId = await sendViaMailjetApi({ to, subject, text, html })
      console.log(`[Email] SMTP lỗi (${smtpErr.message}) → đã gửi qua Mailjet REST API`)
      return { sent: true, via: 'api', messageId }
    } catch (apiErr) {
      console.error('[Email] SMTP + REST API đều lỗi:', smtpErr.message, '|', apiErr.message)
      throw apiErr
    }
  }
}

export default { isEmailConfigured, sendEmail }