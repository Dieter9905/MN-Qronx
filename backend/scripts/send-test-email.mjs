/**
 * Gửi 1 email thử để kiểm tra cấu hình SMTP/Mailjet.
 *
 * Dùng: node scripts/send-test-email.mjs <email-nhận>
 */
import config from '../src/config/index.js'
import { isEmailConfigured, sendEmail } from '../src/services/emailService.js'

const to = process.argv[2]
if (!to || !to.includes('@')) {
  console.error('Thiếu email nhận. Dùng: node scripts/send-test-email.mjs ban@example.com')
  process.exit(1)
}

if (!isEmailConfigured()) {
  console.error('\u274c Chưa cấu hình SMTP (cần SMTP_HOST + SMTP_USER + SMTP_PASS trong backend/.env)')
  process.exit(1)
}

console.log(`\u2139\ufe0f  From: ${config.smtp.from}`)
console.log(`\u2139\ufe0f  Host: ${config.smtp.host}:${config.smtp.port} (secure=${config.smtp.secure})`)
console.log(`\u2139\ufe0f  Gửi tới: ${to} …\n`)

try {
  const r = await sendEmail({
    to,
    subject: 'MN-Qronx — email kiểm tra cấu hình',
    text: 'Nếu bạn nhận được thư này, cấu hình email đã hoạt động.',
    html: '<p>Nếu bạn nhận được thư này, cấu hình email đã <strong>hoạt động</strong>.</p>',
  })
  console.log(`\u2705 Đã gửi qua ${r.via} — messageId: ${r.messageId}`)
} catch (err) {
  console.error(`\u274c Gửi thất bại: ${err.message}`)
  console.error('   Nếu lỗi nói "sender ... not validated" \u2192 làm theo docs/email-domain-setup.md')
  process.exit(1)
}
