import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// Cô lập khỏi DB: chỉ giả lập đúng 2 hàm repo mà forgotPassword dùng.
vi.mock('../src/repositories/authRepo.js', () => ({
  default: {
    findByEmail: vi.fn(async () => ({ userId: 7, email: 'nguoidung@example.com' })),
    createPasswordResetRequest: vi.fn(async () => ({ resetRequestId: 1 })),
  },
}))

vi.mock('../src/services/rewardService.js', () => ({
  ensureInviteCode: vi.fn(async () => 'ABC123'),
  creditDailyLogin: vi.fn(async () => ({})),
  activateInvitation: vi.fn(async () => ({})),
}))

import authRepo from '../src/repositories/authRepo.js'
import config from '../src/config/index.js'
import { forgotPassword } from '../src/services/authService.js'

const ORIGINAL_KEY = config.resend.apiKey
const ORIGINAL_ENV = process.env.NODE_ENV
const ORIGINAL_TRANSPORT = config.mail.transport

const okResponse = () => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: 'msg-1' }) })

beforeEach(() => {
  config.resend.apiKey = 're_test_key'
  // vitest.config.js ép MAIL_TRANSPORT=api; thư đặt lại mật khẩu ở đây đi đường Resend
  config.mail.transport = 'resend'
  authRepo.findByEmail.mockResolvedValue({ userId: 7, email: 'nguoidung@example.com' })
  vi.stubGlobal('fetch', vi.fn(async () => okResponse()))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  config.resend.apiKey = ORIGINAL_KEY
  config.mail.transport = ORIGINAL_TRANSPORT
  process.env.NODE_ENV = ORIGINAL_ENV
})

describe('forgotPassword — gửi thư đặt lại mật khẩu thật', () => {
  it('gửi email chứa liên kết đặt lại mật khẩu', async () => {
    await forgotPassword('nguoidung@example.com')

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toContain('api.resend.com')
    const body = JSON.parse(opts.body)
    expect(body.to).toEqual(['nguoidung@example.com'])
    expect(body.subject).toMatch(/Đặt lại mật khẩu/)
    expect(body.text).toContain('/reset-password?token=')
    expect(body.html).toContain('/reset-password?token=')
  })

  it('lưu yêu cầu đặt lại vào DB', async () => {
    await forgotPassword('nguoidung@example.com')
    expect(authRepo.createPasswordResetRequest).toHaveBeenCalledTimes(1)
    const [, token, expiresAt] = authRepo.createPasswordResetRequest.mock.calls[0]
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('production: KHÔNG trả resetToken khi gửi email thất bại (tránh chiếm tài khoản)', async () => {
    process.env.NODE_ENV = 'production'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('mạng lỗi')
      })
    )

    const res = await forgotPassword('nguoidung@example.com')

    expect(res.resetToken).toBeUndefined()
    expect(res.message).toMatch(/Nếu email tồn tại/)
  })

  it('dev: trả resetToken để test cục bộ khi không gửi được email', async () => {
    process.env.NODE_ENV = 'development'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('mạng lỗi')
      })
    )

    const res = await forgotPassword('nguoidung@example.com')
    expect(res.resetToken).toBeTruthy()
  })

  it('email không tồn tại → không tiết lộ, vẫn trả thông báo chung', async () => {
    authRepo.findByEmail.mockResolvedValue(null)

    const res = await forgotPassword('khongco@example.com')

    expect(res.message).toMatch(/Nếu email tồn tại/)
    expect(res.resetToken).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })
})
