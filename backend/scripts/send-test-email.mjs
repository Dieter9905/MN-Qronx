/**
 * Gửi 1 email thử qua đường gửi đang cấu hình (Resend hoặc SMTP).
 *
 * Dùng:
 *   node scripts/send-test-email.mjs ban@example.com
 *   node scripts/send-test-email.mjs ban@example.com --cc=other@example.com
 *
 * Cấu hình nằm trong backend/.env: MAIL_TRANSPORT (auto | resend | smtp),
 * RESEND_API_KEY / RESEND_FROM hoặc SMTP_HOST + SMTP_USER + SMTP_PASS + EMAIL_FROM.
 */
const args = process.argv.slice(2)
const ccArg = args.find((a) => a.startsWith('--cc='))
const to = args.find((a) => a.includes('@'))

if (!to) {
  console.error('Thiếu email nhận. Dùng: node scripts/send-test-email.mjs ban@example.com [--cc=...]')
  process.exit(1)
}

const { default: config } = await import('../src/config/index.js')
const { getMailStatus, sendEmail, ResendSendError } = await import('../src/services/emailService.js')

const status = getMailStatus()
console.log('Cấu hình gửi thư:')
console.log(`  Đường gửi      : ${status.transport}${status.requested === 'auto' ? ' (auto)' : ` (MAIL_TRANSPORT=${status.requested})`}`)
console.log(`  Resend API key : ${status.resendConfigured ? 'đã có' : 'CHƯA CÓ'}`)
console.log(`  SMTP           : ${status.smtpConfigured ? `${config.smtp.host}:${config.smtp.port}` : 'CHƯA CÓ'}`)
console.log(`  From           : ${status.from}`)
console.log(`  Gửi tới        : ${to}${ccArg ? ` (cc: ${ccArg.split('=')[1]})` : ''}\n`)

try {
  const r = await sendEmail({
    to,
    ...(ccArg ? { cc: ccArg.split('=')[1] } : {}),
    subject: 'MN-Qronx — email kiểm tra cấu hình',
    text: 'Nếu bạn nhận được thư này, cấu hình email đã hoạt động.',
    html: '<p>Nếu bạn nhận được thư này, cấu hình email đã <strong>hoạt động</strong>.</p>',
  })
  if (r.sent === false) {
    console.error('\u26a0\ufe0f  KHÔNG gửi thật được — chưa cấu hình đường gửi nào.')
    console.error('   Điền RESEND_API_KEY (hoặc SMTP_HOST/SMTP_USER/SMTP_PASS) trong backend/.env rồi chạy lại.')
    process.exit(1)
  }
  console.log(`\u2705 Đã gửi qua ${r.via} — messageId: ${r.messageId || '(không có)'}`)
} catch (err) {
  if (err instanceof ResendSendError) {
    console.error(`\u274c Gửi thất bại — HTTP ${err.status}${err.code ? ` · ${err.code}` : ''}`)
    console.error(`   ${err.message}`)
    if (err.hint) console.error(`   \u2192 ${err.hint}`)
  } else {
    console.error(`\u274c Gửi thất bại: ${err.message}`)
  }
  console.error('   Chi tiết cách xử lý: docs/email-domain-setup.md')
  process.exit(1)
}
