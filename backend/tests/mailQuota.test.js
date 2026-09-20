import { describe, it, expect, vi, afterEach } from 'vitest'
import config from '../src/config/index.js'
import {
  MailjetQuotaError,
  assertQuotaAvailable,
  getQuotaStatus,
  isQuotaEnforced,
  nextResetAt,
  recordSend,
  startOfDay,
  startOfHour,
} from '../src/services/mailQuota.js'

/** Phản hồi giả của GET /v3/REST/statcounters */
const statsResponse = (sent) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ Count: 1, Total: 1, Data: [{ MessageSentCount: sent, Total: sent }] }),
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Môi trường test đặt cả hai hạn mức = 0 — trả lại trạng thái đó sau mỗi test
  config.mail.hourlyLimit = 0
  config.mail.dailyLimit = 0
})

describe('mốc thời gian theo múi giờ', () => {
  it('00:00 giờ Việt Nam là 17:00 UTC của ngày hôm trước', () => {
    const now = new Date('2026-09-20T10:30:00Z') // 17:30 giờ VN
    expect(startOfDay(now, 'Asia/Ho_Chi_Minh').toISOString()).toBe('2026-09-19T17:00:00.000Z')
  })

  it('đầu giờ tính theo giờ địa phương (17:30 VN → 17:00 VN)', () => {
    const now = new Date('2026-09-20T10:30:00Z')
    expect(startOfHour(now, 'Asia/Ho_Chi_Minh').toISOString()).toBe('2026-09-20T10:00:00.000Z')
  })

  it('hạn mức ngày làm mới vào 00:00 ngày kế tiếp', () => {
    const now = new Date('2026-09-20T10:30:00Z')
    expect(nextResetAt(now, 'Asia/Ho_Chi_Minh').toISOString()).toBe('2026-09-20T17:00:00.000Z')
  })

  it('đúng cả khi đã sang ngày mới ở Việt Nam', () => {
    const now = new Date('2026-09-20T18:05:00Z') // 01:05 ngày 21/09 giờ VN
    expect(startOfDay(now, 'Asia/Ho_Chi_Minh').toISOString()).toBe('2026-09-20T17:00:00.000Z')
    expect(nextResetAt(now, 'Asia/Ho_Chi_Minh').toISOString()).toBe('2026-09-21T17:00:00.000Z')
  })
})

describe('hạn mức gửi', () => {
  it('tắt cả hai cửa sổ → không kiểm tra, không gọi Mailjet', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(isQuotaEnforced()).toBe(false)
    await expect(assertQuotaAvailable()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('còn hạn mức ngày → cho gửi, trả về số thư còn lại', async () => {
    config.mail.dailyLimit = 10
    vi.stubGlobal('fetch', vi.fn(async () => statsResponse(3)))

    const status = await assertQuotaAvailable()
    expect(status.binding).toMatchObject({ key: 'day', limit: 10, sent: 3, remaining: 7 })
    expect(status.hourly.enforced).toBe(false)
  })

  it('đã đủ hạn mức ngày → ném MailjetQuotaError (HTTP 429)', async () => {
    config.mail.dailyLimit = 10
    vi.stubGlobal('fetch', vi.fn(async () => statsResponse(10)))

    await expect(assertQuotaAvailable()).rejects.toBeInstanceOf(MailjetQuotaError)
    await assertQuotaAvailable().catch((err) => {
      expect(err.status).toBe(429)
      expect(err.code).toBe('quota-exceeded')
      expect(err.limit).toBe(10)
      expect(err.message).toMatch(/ngày/)
      expect(err.hint).toMatch(/duyệt tạm/i)
    })
  })

  it('chặn theo hạn mức GIỜ dù còn hạn mức ngày (banner Mailjet: 10 thư/giờ)', async () => {
    config.mail.hourlyLimit = 10
    config.mail.dailyLimit = 100
    vi.stubGlobal('fetch', vi.fn(async () => statsResponse(10)))

    await assertQuotaAvailable().catch((err) => {
      expect(err).toBeInstanceOf(MailjetQuotaError)
      expect(err.message).toMatch(/giờ/)
      expect(err.resetAt.getTime() - startOfHour(err.resetAt).getTime()).toBe(0)
    })
  })

  it('không đọc được thống kê Mailjet → vẫn cho gửi (fail open)', async () => {
    config.mail.dailyLimit = 10
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    const status = await assertQuotaAvailable()
    expect(status.daily.countedFrom).toBe('local')
    expect(status.daily.error).toMatch(/network down/i)
  })

  it('ghi nhận thư vừa gửi để bù cho thống kê cập nhật trễ', async () => {
    config.mail.dailyLimit = 10
    vi.stubGlobal('fetch', vi.fn(async () => statsResponse(0)))

    recordSend(2)
    const status = await getQuotaStatus()
    expect(status.daily.sent).toBe(2)
    expect(status.daily.remaining).toBe(8)
  })
})
