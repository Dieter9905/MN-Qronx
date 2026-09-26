import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import config from '../src/config/index.js'
import { parseTasks } from '../src/services/aiService.js'

/**
 * Backend chỉ là proxy mỏng tới AI tự host (xem thư mục ai/):
 * POST {AI_INFER_URL}/parse {text} → {tasks} rồi sanitize theo đúng cấu trúc form
 * tạo việc. Test ở đây giả lập fetch nên KHÔNG cần service AI chạy, không tốn mạng.
 */

const ORIGINAL_URL = config.ai.inferUrl
const ORIGINAL_KEY = config.ai.apiKey

/** Phản hồi giả của POST /parse */
const okResponse = (tasks) => ({
  ok: true,
  status: 200,
  json: async () => ({ tasks, model: 'test' }),
})

const errorResponse = (status, body = 'lỗi') => ({
  ok: false,
  status,
  text: async () => body,
})

const baseTask = (over = {}) => ({
  title: 'Họp team',
  description: '',
  dueAt: '2099-12-31T20:00:00.000+07:00',
  priority: 'HIGH',
  repeatType: 'NONE',
  repeatDays: [],
  reminders: [],
  categoryName: 'Công việc',
  ...over,
})

beforeEach(() => {
  config.ai.inferUrl = 'http://ai.test'
  config.ai.apiKey = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
  config.ai.inferUrl = ORIGINAL_URL
  config.ai.apiKey = ORIGINAL_KEY
})

describe('parseTasks — gọi AI tự host', () => {
  it('gửi đúng URL, method POST và cắt văn bản ở 2000 ký tự', async () => {
    const fetchMock = vi.fn(async () => okResponse([baseTask()]))
    vi.stubGlobal('fetch', fetchMock)

    await parseTasks('x'.repeat(5000))

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://ai.test/parse')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body).text).toHaveLength(2000)
  })

  it('ghép URL không bị "//parse" (config đã bỏ dấu "/" cuối của AI_INFER_URL)', async () => {
    const fetchMock = vi.fn(async () => okResponse([baseTask()]))
    vi.stubGlobal('fetch', fetchMock)

    await parseTasks('họp team 14h')
    const url = fetchMock.mock.calls[0][0]
    expect(url.endsWith('/parse')).toBe(true)
    expect(url).not.toMatch(/\/\/parse$/)
  })

  it('gửi Authorization khi có AI_API_KEY', async () => {
    config.ai.apiKey = 'secret'
    const fetchMock = vi.fn(async () => okResponse([baseTask()]))
    vi.stubGlobal('fetch', fetchMock)

    await parseTasks('họp team 14h')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secret')
  })
})

describe('parseTasks — làm sạch dữ liệu AI trả về', () => {
  it('loại việc thiếu tiêu đề, đổi giá trị lạ về mặc định', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        okResponse([
          { title: '   ' },
          null,
          baseTask({ title: '  Đọc sách  ', priority: 'KHẨN', repeatType: 'HẰNG NGÀY', dueAt: 'không-phải-ngày' }),
        ])
      )
    )

    const tasks = await parseTasks('đọc sách')
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ title: 'Đọc sách', priority: 'MEDIUM', repeatType: 'NONE', dueAt: null })
  })

  it('repeatType WEEKLY: chỉ nhận repeatDays 1–7, sắp xếp và bỏ trùng; rỗng → NONE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        okResponse([
          baseTask({ repeatType: 'WEEKLY', repeatDays: [3, 1, 3, 9, 0, '2'] }),
          baseTask({ title: 'Việc sai', repeatType: 'WEEKLY', repeatDays: [] }),
        ])
      )
    )

    const [a, b] = await parseTasks('việc lặp tuần')
    expect(a.repeatType).toBe('WEEKLY')
    expect(a.repeatDays).toEqual([1, 2, 3])
    expect(b.repeatType).toBe('NONE')
  })

  it('nhắc nhở: bỏ mốc SAU thời hạn, tối đa 5 mốc', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        okResponse([
          baseTask({
            dueAt: '2099-12-31T20:00:00.000+07:00',
            reminders: [
              { remindAt: '2099-12-31T19:50:00.000+07:00' }, // trước hạn → giữ
              { remindAt: '2099-12-31T21:00:00.000+07:00' }, // SAU hạn → bỏ
              { remindAt: 'không-hợp-lệ' }, // bỏ
              { remindAt: '2099-12-31T19:40:00.000+07:00' },
              { remindAt: '2099-12-31T19:30:00.000+07:00' },
              { remindAt: '2099-12-31T19:20:00.000+07:00' },
              { remindAt: '2099-12-31T19:10:00.000+07:00' },
              { remindAt: '2099-12-31T19:00:00.000+07:00' },
            ],
          }),
        ])
      )
    )

    const [t] = await parseTasks('việc có nhiều nhắc nhở')
    expect(t.reminders).toHaveLength(5)
    for (const r of t.reminders) {
      expect(new Date(r.remindAt) <= new Date(t.dueAt)).toBe(true)
    }
  })

  it('giới hạn 20 công việc mỗi lần', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse(Array.from({ length: 25 }, (_, i) => baseTask({ title: `Việc ${i}` }))))
    )

    const tasks = await parseTasks('nhiều việc')
    expect(tasks).toHaveLength(20)
    expect(tasks[0].title).toBe('Việc 0')
  })
})

describe('parseTasks — báo lỗi rõ ràng cho app', () => {
  it('không kết nối được service → AI_NETWORK (kèm tên biến cần sửa)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      })
    )

    await expect(parseTasks('họp team')).rejects.toMatchObject({
      code: 'AI_NETWORK',
      message: expect.stringContaining('AI_INFER_URL'),
    })
  })

  it('service treo quá lâu → AI_TIMEOUT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        throw err
      })
    )

    await expect(parseTasks('họp team')).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
      message: expect.stringContaining('quá chậm'),
    })
  })

  it('service trả HTTP lỗi → AI_HTTP kèm mã và đoạn chi tiết', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => errorResponse(500, 'model đang nạp')))

    await expect(parseTasks('họp team')).rejects.toMatchObject({
      code: 'AI_HTTP',
      message: expect.stringContaining('500'),
      detail: 'model đang nạp',
    })
  })

  it('trả về JSON hỏng → AI_BAD_RESPONSE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      }))
    )

    await expect(parseTasks('họp team')).rejects.toMatchObject({ code: 'AI_BAD_RESPONSE' })
  })

  it('không nhận diện được việc nào → AI_EMPTY', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse([])))

    await expect(parseTasks('   ')).rejects.toMatchObject({ code: 'AI_EMPTY' })
  })

  it('AI trả về toàn việc không hợp lệ → AI_EMPTY (không trả mảng rỗng im lặng)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse([{ title: '' }, null])))

    await expect(parseTasks('...')).rejects.toMatchObject({ code: 'AI_EMPTY' })
  })
})
