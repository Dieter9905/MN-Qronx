import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import config from '../src/config/index.js'
import {
  buildResendPayload,
  formatResendAddress,
  sendEmail,
  resolveTransport,
  isResendConfigured,
  getMailStatus,
  ResendSendError,
} from '../src/services/emailService.js'

// Cấu hình Resend được đọc lúc nạp module, nên trong test ta chỉnh trực tiếp
// đối tượng config — không cần file .env có RESEND_API_KEY.
const ORIGINAL_KEY = config.resend.apiKey
const ORIGINAL_FROM = config.resend.from
const ORIGINAL_TRANSPORT = config.mail.transport
const ORIGINAL_MAILJET_KEY = config.mail.apiKey
const ORIGINAL_HOURLY_LIMIT = config.mail.hourlyLimit
const ORIGINAL_DAILY_LIMIT = config.mail.dailyLimit

// Giả lập phản hồi thành công của Resend: POST /emails → { id }
const okResponse = (id = '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794') => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ id }),
})

const errorResponse = (status, name, message) => ({
  ok: false,
  status,
  text: async () => JSON.stringify({ statusCode: status, name, message }),
})

beforeEach(() => {
  config.resend.apiKey = 're_test_key'
  // vitest.config.js ép MAIL_TRANSPORT=api cho mọi file test (để kiểm tra nhánh
  // Mailjet), nên ở đây phải trả về 'auto' mới thấy được thứ tự ưu tiên thật.
  config.mail.transport = 'auto'
  // Môi trường test tắt sẵn hạn mức; từng test bật lại khi cần kiểm tra.
  config.mail.hourlyLimit = 0
  config.mail.dailyLimit = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
  config.resend.apiKey = ORIGINAL_KEY
  config.resend.from = ORIGINAL_FROM
  config.mail.transport = ORIGINAL_TRANSPORT
  config.mail.apiKey = ORIGINAL_MAILJET_KEY
  config.mail.hourlyLimit = ORIGINAL_HOURLY_LIMIT
  config.mail.dailyLimit = ORIGINAL_DAILY_LIMIT
})

describe('formatResendAddress', () => {
  it('giữ tên hiển thị khi có', () => {
    expect(formatResendAddress('MN-Qronx <no-reply@mn-qronx.id.vn>')).toBe('MN-Qronx <no-reply@mn-qronx.id.vn>')
  })

  it('chỉ trả email khi không có tên', () => {
    expect(formatResendAddress(' a@example.com ')).toBe('a@example.com')
  })
})

describe('buildResendPayload', () => {
  const base = { to: 'nguoinhan@example.com', subject: 'Xin chào', text: 'Nội dung', html: '<p>Nội dung</p>' }

  it('dựng đúng from/to/subject/text/html theo Send Email API', () => {
    const payload = buildResendPayload(base)
    expect(payload.from).toMatch(/<no-reply@mn-qronx\.id\.vn>|onboarding@resend\.dev/)
    expect(payload.to).toEqual(['nguoinhan@example.com'])
    expect(payload.subject).toBe('Xin chào')
    expect(payload.text).toBe('Nội dung')
    expect(payload.html).toBe('<p>Nội dung</p>')
  })

  it('thêm cc/bcc/reply_to khi được truyền', () => {
    const payload = buildResendPayload({
      ...base,
      cc: 'cc@example.com',
      bcc: 'B <bcc@example.com>',
      replyTo: 'hoi@example.com',
    })
    expect(payload.cc).toEqual(['cc@example.com'])
    expect(payload.bcc).toEqual(['B <bcc@example.com>'])
    expect(payload.reply_to).toBe('hoi@example.com')
  })

  it('không đặt cc/bcc khi rỗng', () => {
    const payload = buildResendPayload(base)
    expect(payload.cc).toBeUndefined()
    expect(payload.bcc).toBeUndefined()
  })

  it('dùng RESEND_FROM khi được đặt', () => {
    config.resend.from = 'Resend Test <test@resend.dev>'
    expect(buildResendPayload(base).from).toBe('Resend Test <test@resend.dev>')
  })
})

describe('chọn đường gửi khi có Resend', () => {
  it('auto: ưu tiên Resend khi đã có RESEND_API_KEY', () => {
    expect(isResendConfigured()).toBe(true)
    expect(resolveTransport()).toBe('resend')
  })

  it('MAIL_TRANSPORT=resend nhưng chưa có key → không gửi được (none)', () => {
    config.resend.apiKey = ''
    config.mail.transport = 'resend'
    expect(resolveTransport()).toBe('none')
  })

  it('MAIL_TRANSPORT=api vẫn ép đi Mailjet dù có key Resend', () => {
    config.mail.transport = 'api'
    config.mail.apiKey = 'key'
    expect(resolveTransport()).toBe('api')
  })

  it('getMailStatus phản ánh địa chỉ gửi của đường đang dùng', () => {
    config.resend.from = 'Resend Test <test@resend.dev>'
    expect(getMailStatus().from).toBe('Resend Test <test@resend.dev>')
  })
})

describe('sendEmail qua Resend', () => {
  it('gửi thành công và trả về id của Resend', async () => {
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail({
      to: 'nguoinhan@example.com',
      subject: 'Mã xác nhận',
      text: 'Mã của bạn là 123456',
      html: '<b>123456</b>',
    })

    expect(result).toMatchObject({ sent: true, via: 'resend', messageId: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794', accepted: 1 })

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer re_test_key')
    const body = JSON.parse(opts.body)
    expect(body.to).toEqual(['nguoinhan@example.com'])
    expect(body.subject).toBe('Mã xác nhận')
  })

  it('tên miền chưa xác thực (403) → ném lỗi kèm gợi ý xử lý', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        errorResponse(403, 'validation_error', 'The mn-qronx.id.vn domain is not verified. Please, add and verify your domain on https://resend.com/domains')
      )
    )

    await expect(sendEmail({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toBeInstanceOf(ResendSendError)

    await sendEmail({ to: 'a@example.com', subject: 's', text: 't' }).catch((err) => {
      expect(err.status).toBe(403)
      expect(err.hint).toMatch(/xác thực/i)
    })
  })

  it('API key sai (401) → ném lỗi nói rõ key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => errorResponse(401, 'validation_error', 'API key is invalid')))

    await sendEmail({ to: 'a@example.com', subject: 's', text: 't' }).catch((err) => {
      expect(err).toBeInstanceOf(ResendSendError)
      expect(err.hint).toMatch(/RESEND_API_KEY/)
    })
  })

  it('lỗi mạng → ném lỗi có thông báo tiếng Việt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND')
      })
    )

    await sendEmail({ to: 'a@example.com', subject: 's', text: 't' }).catch((err) => {
      expect(err).toBeInstanceOf(ResendSendError)
      expect(err.message).toMatch(/Không kết nối được Resend API/)
    })
  })
})

// Phản hồi giả của GET /v3/REST/statcounters (Mailjet đã gửi `sent` thư trong cửa sổ)
const statsResponse = (sent) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ Count: 1, Total: 1, Data: [{ MessageSentCount: sent, Total: sent }] }),
})

describe('hạn mức Mailjet và đường Resend', () => {
  it('hết hạn mức Mailjet nhưng đi Resend → vẫn gửi được, không hỏi Mailjet', async () => {
    config.mail.hourlyLimit = 5
    config.mail.dailyLimit = 5
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail({ to: 'a@example.com', subject: 's', text: 't' })

    expect(result).toMatchObject({ sent: true, via: 'resend' })
    // Chỉ có 1 request duy nhất: không được gọi statcounters của Mailjet
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['https://api.resend.com/emails'])
  })

  it('đi đường Mailjet API thì hạn mức vẫn chặn TRƯỚC khi gửi', async () => {
    config.mail.transport = 'api'
    config.mail.hourlyLimit = 5
    config.mail.dailyLimit = 5
    const fetchMock = vi.fn(async () => statsResponse(10))
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendEmail({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toMatchObject({
      name: 'MailjetQuotaError',
    })

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every((u) => u.includes('/statcounters'))).toBe(true)
    expect(urls.some((u) => u.includes('api.mailjet.com/v3.1/send'))).toBe(false)
  })
})
