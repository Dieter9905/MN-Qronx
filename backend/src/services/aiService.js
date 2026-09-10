import config from '../config/index.js'

// 9Router – OpenAI-compatible gateway (chat completions)
const aiUrl = () => `${String(config.ai.baseUrl).replace(/\/+$/, '')}/chat/completions`

// Ngày hiện tại theo giờ Việt Nam (UTC+7) — đưa cho AI để nó tính đúng ngày
function vnNow() {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
}

const SYSTEM_PROMPT = `Bạn là trợ lý AI của app quản lý công việc MN-Qronx (tiếng Việt).

NHIỆM VỤ: Đọc đoạn văn người dùng nhập và trích xuất ra DANH SÁCH công việc.
Người dùng có thể nhập NHIỀU công việc trong một đoạn (tách bằng dấu chấm/xuống dòng),
ví dụ: "Trưa nay ăn trưa lúc 11h. Chiều có cuộc họp lúc 2h. Tối ăn tối lúc 6h.
Đi ngủ lúc 12h. Hãy nhắc tôi trước 5 phút mỗi cái."
→ 4 công việc riêng biệt, mỗi cái kèm nhắc nhở trước 5 phút.

QUY TẮC THỜI GIAN (múi giờ Việt Nam, UTC+7 — NGÀY HÔM NAY LÀ ${vnNow()}):
- "lúc 2h" kèm "chiều/tối" → 14h/20h. "chiều 5h" → 17h. "sáng 7h" → 7h.
- "Đi ngủ lúc 12h" → 00:00 ngày hôm sau. "ngủ lúc 11h" → 23h.
- "ngày mai" → ngày hôm sau. "thứ 6" → thứ 6 TUẦN TỚI (dựa vào hôm nay là ngày gì). "hôm nay/trưa nay" → hôm nay.
- Không có giờ → để null; có ngày không có giờ → 18:00.
- Trả dueAt/remindAt dạng ISO 8601 KÈM MÚI GIỜ +07:00 (vd "2026-09-12T14:00:00+07:00").
- Nhắc nhở: phải TRƯỚC thời hạn; cụm "nhắc trước X phút/tiếng mỗi cái" áp cho mọi việc.

PRIORITY: chỉ dùng LOW | MEDIUM | HIGH | URGENT (mặc định MEDIUM).
REPEAT: NONE | DAILY | WEEKLY | MONTHLY ("hàng ngày"→DAILY, "hàng tuần"→WEEKLY…).
WEEKLY thì kèm repeatDays mảng 1..7 (1=Thứ 2 … 7=Chủ nhật), ngược lại để [].
Nếu WEEKLY có thứ cụ thể (monday/thứ 2/...) → VẪN phải trả dueAt = ngày tới gần nhất của thứ đó (giờ như đã cho), KHÔNG được để null.
CATEGORY: trả categoryName (vd "Học tập", "Công việc") nếu đoán được, không thì null.

TRẢ VỀ ĐÚNG JSON (không markdown, không giải thích):
{"tasks":[{"title":"...","description":"...","dueAt":"...hoặc null","priority":"MEDIUM","repeatType":"NONE","repeatDays":[],"reminders":[{"remindAt":"..."}],"categoryName":"..."}]}
Tiêu đề: ngắn gọn, bỏ chủ ngữ ("tôi đi ăn trưa" → "Đi ăn trưa"), bỏ HOÀN TOÀN giờ/buổi/thứ/ngày
khỏi title ("Sáng 7h tập gym" → "Tập gym"; "Weekly meeting every Monday at 9am" → "Weekly meeting"),
nhưng giữ nghĩa bữa ăn ("ăn trưa/ăn tối").`

// Danh sách model dự phòng khi model chính bị lỗi provider (403/429/timeout…)
// — nên dùng model có sẵn trên 9Router server (OpenCode Free không cần tài khoản)
const FALLBACK_MODELS = [
  'kr/claude-sonnet-4.5',
  'oc/nemotron-3-ultra-free',
  'oc/mimo-v2.5-free',
  'oc/ling-3.0-flash-fin-free',
]

/**
 * Gọi 9Router (OpenAI-compatible) để phân tích văn bản → danh sách công việc (JSON chuẩn hoá).
 * @param {string} text
 * @returns {Promise<Array>} tasks đã sanitize
 */
export async function parseTasks(text) {
  if (!config.ai.apiKey) {
    const err = new Error('AI chưa được cấu hình (thiếu AI_API_KEY)')
    err.code = 'AI_NOT_CONFIGURED'
    throw err
  }

  // Model chính + các model dự phòng (bỏ trùng)
  const models = [...new Set([config.ai.model, ...FALLBACK_MODELS])]
  let lastErr = null

  for (const model of models) {
    try {
      return await callModel(model, text)
    } catch (err) {
      lastErr = err
      // Lỗi cấu hình (thiếu key…) thì không thử nữa
      if (err.code === 'AI_NOT_CONFIGURED') throw err
    }
  }
  throw lastErr
}

/**
 * Gọi một model qua 9Router (OpenAI-compatible) và trả về tasks đã sanitize.
 */
async function callModel(model, text) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  let res
  try {
    res = await fetch(aiUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ai.apiKey}`,
        'Content-Type': 'application/json',
        // Tắt token-saver của 9Router (RTK/Ponytail/Caveman) — prompt hệ thống
        // của app phải được giữ nguyên, nếu không model có thể bị bơm prompt lạ
        'X-9Router-Token-Saver': 'off',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: String(text).slice(0, 2000) },
        ],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('AI phản hồi quá chậm, vui lòng thử lại')
      e.code = 'AI_TIMEOUT'
      throw e
    }
    const e = new Error('Không kết nối được dịch vụ AI')
    e.code = 'AI_NETWORK'
    throw e
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const e = new Error(`Dịch vụ AI lỗi (${res.status})`)
    e.code = 'AI_HTTP'
    e.detail = body.slice(0, 300)
    throw e
  }

  // 9Router đôi khi trả kèm đuôi SSE (`data: [DONE]`) sau body JSON → đọc text
  // rồi quét cân bằng ngoặc thay vì res.json() (vốn fail khi có chữ thừa)
  const bodyText = await res.text()
  const data = tryParseBalanced(bodyText)
  if (!data) {
    const e = new Error('Phản hồi AI không hợp lệ')
    e.code = 'AI_BAD_RESPONSE'
    e.detail = bodyText.slice(0, 300)
    throw e
  }
  const raw = data?.choices?.[0]?.message?.content || ''
  const tasks = extractTasks(raw)
  if (!tasks.length) {
    const e = new Error('AI không nhận diện được công việc nào')
    e.code = 'AI_EMPTY'
    throw e
  }
  return tasks
}

/**
 * Thử parse JSON object `{...}` từ text — chịu được chữ thừa trước/sau,
 * fence markdown, JSON bị cắt cụt. Quét cân bằng ngoặc có ý thức chuỗi.
 * @returns {object|null}
 */
function tryParseBalanced(text) {
  if (!text) return null
  const start = text.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const candidate = text.slice(start, i + 1)
        try {
          const obj = JSON.parse(candidate)
          if (obj && typeof obj === 'object') return obj
        } catch {
          /* thử điểm đóng ngoặc tiếp theo */
        }
      }
    }
  }
  return null
}

/**
 * Tương tự tryParseBalanced nhưng cho mảng JSON `[...]` (model trả thẳng list).
 * @returns {Array|null}
 */
function tryParseBalancedArray(text) {
  if (!text) return null
  const start = text.indexOf('[')
  if (start < 0) return null

  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        try {
          const arr = JSON.parse(text.slice(start, i + 1))
          if (Array.isArray(arr)) return arr
        } catch {
          /* tiếp tục */
        }
      }
    }
  }
  return null
}

/**
 * Trích + làm sạch mảng công việc từ JSON text của model.
 * Chống được: markdown fence, chữ mở đầu, chữ giải thích sau JSON,
 * JSON bị cắt cụt — bằng cách quét cân bằng ngoặc `{...}` và thử parse
 * từng điểm đóng ngoặc hợp lệ.
 */
function extractTasks(raw) {
  let json = String(raw || '').trim()
  // Bỏ ```json ... ``` nếu model vẫn trả kèm fence
  json = json.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')

  let parsed = tryParseBalanced(json)
  if (!parsed && json.startsWith('[')) {
    parsed = tryParseBalancedArray(json)
  }
  if (!parsed) return []

  const list = Array.isArray(parsed?.tasks) ? parsed.tasks : Array.isArray(parsed) ? parsed : []

  // Danh sách trống nhưng model trả thêm text sau JSON → không có gì để dùng
  if (!list.length) return []
  const VALID_PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
  const VALID_REPEAT = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']
  const now = Date.now()

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