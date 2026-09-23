import config from '../config/index.js'

// AI riêng của MN-Qronx (self-hosted, xem thư mục `ai/` ở root repo).
// Backend chỉ làm proxy mỏng: gửi text → POST {inferUrl}/parse → sanitize output.
// Không còn phụ thuộc gateway AI thuê ngoài.
const parseUrl = () => `${config.ai.inferUrl}/parse`

const VALID_PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const VALID_REPEAT = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']

/**
 * Gửi văn bản tự nhiên tới AI riêng → danh sách công việc đã sanitize.
 * @param {string} text
 * @returns {Promise<Array>} tasks
 */
export async function parseTasks(text) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  let res
  try {
    res = await fetch(parseUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.ai.apiKey ? { Authorization: `Bearer ${config.ai.apiKey}` } : {}),
      },
      body: JSON.stringify({ text: String(text).slice(0, 2000) }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('AI phản hồi quá chậm, vui lòng thử lại')
      e.code = 'AI_TIMEOUT'
      throw e
    }
    const e = new Error('Không kết nối được AI riêng (kiểm tra AI_INFER_URL)')
    e.code = 'AI_NETWORK'
    throw e
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const e = new Error(`AI riêng lỗi (${res.status})`)
    e.code = 'AI_HTTP'
    e.detail = body.slice(0, 300)
    throw e
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    const e = new Error('AI riêng trả dữ liệu không hợp lệ')
    e.code = 'AI_BAD_RESPONSE'
    throw e
  }

  const list = Array.isArray(data?.tasks) ? data.tasks : []
  const tasks = sanitizeTasks(list)
  if (!tasks.length) {
    const e = new Error('AI không nhận diện được công việc nào')
    e.code = 'AI_EMPTY'
    throw e
  }
  return tasks
}

/**
 * Làm sạch mảng công việc từ AI riêng theo đúng cấu trúc form tạo việc:
 * title*, description, dueAt*, priority, repeatType + repeatDays,
 * reminders (≤ thời hạn, tối đa 5), categoryName.
 */
function sanitizeTasks(list) {
  return list
    .map((t) => {
      if (!t || typeof t !== 'object') return null
      const title = String(t.title || '').trim()
      if (!title) return null

      const dueAt = validDate(t.dueAt) ? new Date(t.dueAt).toISOString() : null

      const priority = VALID_PRIORITY.includes(String(t.priority || '').toUpperCase())
        ? String(t.priority).toUpperCase()
        : 'MEDIUM'

      let repeatType = VALID_REPEAT.includes(String(t.repeatType || '').toUpperCase())
        ? String(t.repeatType).toUpperCase()
        : 'NONE'

      let repeatDays = []
      if (repeatType === 'WEEKLY') {
        repeatDays = (Array.isArray(t.repeatDays) ? t.repeatDays : [])
          .map((d) => parseInt(d, 10))
          .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
        repeatDays = [...new Set(repeatDays)].sort((a, b) => a - b)
        if (!repeatDays.length) repeatType = 'NONE'
      }

      const reminders = (Array.isArray(t.reminders) ? t.reminders : [])
        .map((r) => (r && validDate(r.remindAt) ? new Date(r.remindAt).toISOString() : null))
        .filter((iso) => iso !== null)
        .filter((iso) => !dueAt || new Date(iso) <= new Date(dueAt)) // nhắc nhở ≤ thời hạn
        .map((iso) => ({ remindAt: iso }))
        .slice(0, 5)

      return {
        title,
        description: String(t.description || '').trim(),
        dueAt,
        priority,
        repeatType,
        repeatDays,
        reminders,
        categoryName: t.categoryName ? String(t.categoryName).trim() : null,
      }
    })
    .filter(Boolean)
    .slice(0, 20) // an toàn: tối đa 20 công việc / lần
}

function validDate(v) {
  if (!v) return false
  const d = new Date(v)
  return !Number.isNaN(d.getTime())
}

export default { parseTasks }
