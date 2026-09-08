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
  })
  return transporter
}

/**
 * Gửi email. Khi SMTP chưa cấu hình:
 * - dev: log nội dung ra console (để test luồng)
 * - production: ném lỗi để API báo rõ ràng
 *
 * @param {object} opts { to, subject, text, html }
 * @returns {Promise<{sent: boolean, devLog?: string}>}
 */
export async function sendEmail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    if (config.nodeEnv === 'production') {
      const err = new Error('SMTP chưa được cấu hình trên máy chủ')
      err.code = 'SMTP_NOT_CONFIGURED'
      throw err
    }
    console.log(`\n[Email DEV] → ${to}\n  Chủ đề: ${subject}\n  ${text}\n`)
    return { sent: false, devLog: text }
  }

  const info = await getTransporter().sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html,
  })
  return { sent: true, messageId: info.messageId }
}

export default { isEmailConfigured, sendEmail }