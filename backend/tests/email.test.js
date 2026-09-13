import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildApiMessage,
  parseAddress,
  normalizeRecipients,
  sendEmail,
  MailjetSendError,
  resolveTransport,
  isApiConfigured,
} from '../src/services/emailService.js'

// Giả lập phản hồi của Mailjet Send API v3.1
const okResponse = (overrides = {}) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      Messages: [
        {
          Status: 'success',
          To: [{ Email: 'a@example.com', MessageUUID: 'uuid-1', MessageID: 456, MessageHref: 'https://api.mailjet.com/v3/message/456' }],
          ...overrides,
        },
      ],
    }),
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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

describe('buildApiMessage', () => {
  const base = { to: 'nguoinhan@example.com', subject: 'Xin chào', text: 'Nội dung', html: '<p>Nội dung</p>' }

  it('có đủ From/To/Subject/TextPart/HTMLPart theo tài liệu v3.1', () => {
    const msg = buildApiMessage(base)
    expect(msg.To).toEqual([{ Email: 'nguoinhan@example.com' }])
    expect(msg.Subject).toBe('Xin chào')
    expect(msg.TextPart).toBe('Nội dung')
    expect(msg.HTMLPart).toBe('<p>Nội dung</p>')
    expect(msg.From.Email).toBeTruthy()
  })

  it('thêm Cc/Bcc/ReplyTo khi được truyền', () => {
    const msg = buildApiMessage({ ...base, cc: 'cc@example.com', bcc: 'bcc@example.com', replyTo: 'hoi@example.com' })
    expect(msg.Cc).toEqual([{ Email: 'cc@example.com' }])
    expect(msg.Bcc).toEqual([{ Email: 'bcc@example.com' }])
    expect(msg.ReplyTo).toEqual({ Email: 'hoi@example.com' })
  })

  it('dùng TemplateID thì KHÔNG kèm TextPart/HTMLPart', () => {
    const msg = buildApiMessage({ ...base, templateId: '1234', templateVariables: { name: 'Minh' } })
    expect(msg.TemplateID).toBe(1234)
    expect(msg.Variables).toEqual({ name: 'Minh' })
    expect(msg.TextPart).toBeUndefined()
    expect(msg.HTMLPart).toBeUndefined()
  })
})

describe('sendEmail qua Mailjet Send API v3.1', () => {
  it('gửi thành công và trả về messageId trong response', async () => {
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail({
      to: 'nguoinhan@example.com',
      subject: 'Mã xác nhận',
      text: 'Mã của bạn là 123456',
      html: '<b>123456</b>',
    })

    expect(result).toMatchObject({ sent: true, via: 'api', messageId: '456', accepted: 1 })

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('/v3.1/send')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toMatch(/^Basic /)
    const body = JSON.parse(opts.body)
    expect(body.Messages[0].To).toEqual([{ Email: 'nguoinhan@example.com' }])
    expect(body.Messages[0].Subject).toBe('Mã xác nhận')
  })

  it('tài khoản bị khoá (401 mj-0001) → ném lỗi có mã và gợi ý xử lý', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            ErrorIdentifier: 'x',
            ErrorCode: 'mj-0001',
            StatusCode: 401,
            ErrorMessage: 'Your account has been temporarily blocked.',
          }),
      })),
    )

    await expect(sendEmail({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toBeInstanceOf(MailjetSendError)

    await sendEmail({ to: 'a@example.com', subject: 's', text: 't' }).catch((err) => {
      expect(err.code).toBe('mj-0001')
      expect(err.hint).toMatch(/tạm khoá/i)
    })
  })

  it('Mailjet trả Status khác success → ném lỗi', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Messages: [{ Status: 'error', Errors: ['From không hợp lệ'] }] }),
      })),
    )

    await expect(sendEmail({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toBeInstanceOf(MailjetSendError)
  })
})

describe('chọn đường gửi', () => {
  it('ưu tiên API khi đã có API key (mặc định MAIL_TRANSPORT=auto)', () => {
    expect(isApiConfigured()).toBe(true)
    expect(resolveTransport()).toBe('api')
  })
})
