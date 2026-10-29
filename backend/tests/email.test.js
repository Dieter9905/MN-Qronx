import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import config from '../src/config/index.js'
import { parseAddress, normalizeRecipients, resolveTransport, isResendConfigured, isSmtpConfigured, sendEmail } from '../src/services/emailService.js'

// Giả lập nodemailer để test đường SMTP mà không mở kết nối thật.
const sendMail = vi.fn(async () => ({ messageId: 'smtp-message-1' }))
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}))

const ORIGINAL = {
  transport: config.mail.transport,
  resendKey: config.resend.apiKey,
  smtpHost: config.smtp.host,
  smtpUser: config.smtp.user,
  smtpPass: config.smtp.pass,
}

beforeEach(() => {
  sendMail.mockClear()
  config.resend.apiKey = ''
  config.smtp.host = ''
  config.smtp.user = ''
  config.smtp.pass = ''
  config.mail.transport = 'auto'
})

afterEach(() => {
  config.mail.transport = ORIGINAL.transport
  config.resend.apiKey = ORIGINAL.resendKey
  config.smtp.host = ORIGINAL.smtpHost
  config.smtp.user = ORIGINAL.smtpUser
  config.smtp.pass = ORIGINAL.smtpPass
  vi.unstubAllGlobals()
})

const withSmtp = () => {
  config.smtp.host = 'smtp.example.com'
  config.smtp.port = 465
  config.smtp.secure = true
  config.smtp.user = 'no-reply@mn-qronx.id.vn'
  config.smtp.pass = 'secret'
}

describe('parseAddress', () => {
  it('tách tên và email từ chuỗi có ngoặc nhọn', () => {
    expect(parseAddress('MN-Qronx <no-reply@mn-qronx.id.vn>')).toEqual({
      Name: 'MN-Qronx',
      Email: 'no-reply@mn-qronx.id.vn',
    })
  })

  it('nhận chuỗi chỉ có email', () => {
    expect(parseAddress('  someone@example.com ')).toEqual({ Email: 'someone@example.com' })
  })
})

describe('normalizeRecipients', () => {
  it('nhận chuỗi phân tách bằng dấu phẩy', () => {
    expect(normalizeRecipients('a@example.com, B <b@example.com>')).toEqual([
      { Email: 'a@example.com' },
      { Name: 'B', Email: 'b@example.com' },
    ])
  })

  it('bỏ qua phần tử rỗng', () => {
    expect(normalizeRecipients(['', 'a@example.com'])).toEqual([{ Email: 'a@example.com' }])
  })
})

describe('chọn đường gửi (chỉ còn Resend và SMTP)', () => {
  it('chưa cấu hình gì → none', () => {
    expect(isResendConfigured()).toBe(false)
    expect(isSmtpConfigured()).toBe(false)
    expect(resolveTransport()).toBe('none')
  })

  it('chỉ có SMTP → smtp', () => {
    withSmtp()
    expect(resolveTransport()).toBe('smtp')
  })

  it('có cả hai ở chế độ auto → ưu tiên Resend', () => {
    withSmtp()
    config.resend.apiKey = 're_test_key'
    expect(resolveTransport()).toBe('resend')
  })

  it('MAIL_TRANSPORT=smtp buộc đi SMTP dù có key Resend', () => {
    withSmtp()
    config.resend.apiKey = 're_test_key'
    config.mail.transport = 'smtp'
    expect(resolveTransport()).toBe('smtp')
  })

  it('MAIL_TRANSPORT=resend nhưng chưa có key → none', () => {
    withSmtp()
    config.mail.transport = 'resend'
    expect(resolveTransport()).toBe('none')
  })
})

describe('sendEmail qua SMTP', () => {
  it('gửi thành công và trả về via/messageId', async () => {
    withSmtp()

    const result = await sendEmail({
      to: 'nguoinhan@example.com',
      subject: 'Mã xác nhận',
      text: 'Mã của bạn là 123456',
      html: '<b>123456</b>',
    })

    expect(result).toMatchObject({ sent: true, via: 'smtp', messageId: 'smtp-message-1' })
    expect(sendMail).toHaveBeenCalledTimes(1)

    const arg = sendMail.mock.calls[0][0]
    expect(arg.to).toBe('nguoinhan@example.com')
    expect(arg.subject).toBe('Mã xác nhận')
    expect(arg.text).toBe('Mã của bạn là 123456')
    expect(arg.html).toBe('<b>123456</b>')
    // Reply-To mặc định trùng tài khoản gửi để thư hệ thống không bị coi là bulk
    expect(arg.replyTo).toBe('no-reply@mn-qronx.id.vn')
  })

  it('gộp mảng người nhận thành chuỗi và giữ cc/bcc', async () => {
    withSmtp()

    await sendEmail({
      to: ['a@example.com', 'b@example.com'],
      cc: ['cc@example.com'],
      bcc: 'bcc@example.com',
      subject: 's',
      text: 't',
    })

    const arg = sendMail.mock.calls[0][0]
    expect(arg.to).toBe('a@example.com, b@example.com')
    expect(arg.cc).toBe('cc@example.com')
    expect(arg.bcc).toBe('bcc@example.com')
  })
})

describe('sendEmail khi chưa cấu hình', () => {
  it('trả sent:false kèm nội dung để phía gọi hiển thị mã xác nhận', async () => {
    const result = await sendEmail({ to: 'a@example.com', subject: 's', text: 'Mã: 123456' })

    expect(result.sent).toBe(false)
    expect(result.smtpMissing).toBe(true)
    expect(result.devLog).toBe('Mã: 123456')
    expect(sendMail).not.toHaveBeenCalled()
  })
})
