/**
 * Gửi 1 email thử theo Mailjet Send API v3.1.
 *
 * Dùng:
 *   node scripts/send-test-email.mjs ban@example.com
 *   node scripts/send-test-email.mjs ban@example.com --sandbox
 *   node scripts/send-test-email.mjs ban@example.com --cc=other@example.com
 *
 * --sandbox: gửi ở chế độ thử (Mailjet kiểm tra payload nhưng KHÔNG gửi thật,
 *            rất hợp để kiểm tra cấu hình mà không làm phiền hộp thư người nhận).
 */
const args = process.argv.slice(2)
const sandbox = args.includes('--sandbox')
const ccArg = args.find((a) => a.startsWith('--cc='))
const to = args.find((a) => a.includes('@'))

if (sandbox) process.env.MAILJET_SANDBOX = 'true'

if (!to) {
  console.error('Thiếu email nhận. Dùng: node scripts/send-test-email.mjs ban@example.com [--sandbox] [--cc=...]')
  process.exit(1)
}

// Import động SAU khi đã đặt biến môi trường, vì config đọc process.env lúc nạp module
const { default: config } = await import('../src/config/index.js')
const { getMailStatus, sendEmail, MailjetSendError } = await import('../src/services/emailService.js')

const status = getMailStatus()
console.log('Cấu hình gửi thư:')
console.log(`  Đường gửi      : ${status.transport}${status.requested === 'auto' ? ' (auto)' : ` (MAIL_TRANSPORT=${status.requested})`}`)
console.log(`  Mailjet API key: ${status.apiConfigured ? 'đã có' : 'CHƯA CÓ'}`)
console.log(`  SMTP           : ${status.smtpConfigured ? `${config.smtp.host}:${config.smtp.port}` : 'CHƯA CÓ'}`)
console.log(`  From           : ${status.from}`)
console.log(`  Sandbox        : ${status.sandbox ? 'BẬT (không gửi thật)' : 'tắt'}`)
console.log(`  Gửi tới        : ${to}${ccArg ? ` (cc: ${ccArg.split('=')[1]})` : ''}\n`)

try {
  const r = await sendEmail({
    to,
    ...(ccArg ? { cc: ccArg.split('=')[1] } : {}),
    subject: 'MN-Qronx — email kiểm tra cấu hình',
    text: 'Nếu bạn nhận được thư này, cấu hình email đã hoạt động.',
    html: '<p>Nếu bạn nhận được thư này, cấu hình email đã <strong>hoạt động</strong>.</p>',
  })
  console.log(`\u2705 Đã gửi qua ${r.via} — messageId: ${r.messageId || '(không có)'}`)
  if (r.messageUuid) console.log(`   MessageUUID: ${r.messageUuid}`)
  if (r.accepted) console.log(`   Số người nhận Mailjet đã nhận: ${r.accepted}`)
} catch (err) {
  if (err instanceof MailjetSendError) {
    console.error(`\u274c Gửi thất bại — HTTP ${err.status}${err.code ? ` · ${err.code}` : ''}`)
    console.error(`   ${err.message}`)
  } else {
    console.error(`\u274c Gửi thất bại: ${err.message}`)
  }
  console.error('   Chi tiết cách xử lý: docs/email-domain-setup.md')
  process.exit(1)
}
