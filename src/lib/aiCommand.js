/**
 * Câu lệnh cho trợ lý AI: ngoài việc TẠO công việc, người dùng còn nói kiểu
 * "đánh dấu hoàn thành việc họp team", "xóa việc đi siêu thị", "hoàn thành cái
 * vừa tạo", "mark Buy milk as done".
 *
 * Trước đây chat chỉ biết tạo, nên mọi câu lệnh đều thành một công việc mới tên
 * "Đánh dấu hoàn thành việc họp team". Module này tách phần "ý định" (hoàn
 * thành / xóa) khỏi phần "đối tượng" (tên công việc) rồi khớp mờ với danh sách
 * công việc thật của người dùng.
 *
 * Quy ước `status` của backend: COMPLETED | CANCELLED | (còn lại là chưa xong).
 */

export const TASK_COMMAND = {
  COMPLETE: 'COMPLETE',
  DELETE: 'DELETE',
}

// Bỏ dấu tiếng Việt để so khớp không phân biệt dấu ("hoa don" khớp "Hóa đơn")
export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Chuẩn hoá kèm "bản đồ vị trí": map[i] là vị trí của ký tự chuẩn hoá thứ i
 * trong chuỗi gốc — nhờ đó tách được phần tên việc mà vẫn giữ nguyên dấu để
 * hiển thị lại cho người dùng ("Đi siêu thị", không phải "di sieu thi").
 */
function normalizeWithMap(input) {
  const s = String(input || '')
  let norm = ''
  const map = []
  for (let i = 0; i < s.length; i++) {
    const piece = s[i]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    for (const ch of piece) {
      if (ch === ' ' && (norm === '' || norm.endsWith(' '))) continue
      norm += ch
      map.push(i)
    }
  }
  let end = norm.length
  while (end > 0 && norm[end - 1] === ' ') end -= 1
  return { norm: norm.slice(0, end), map: map.slice(0, end) }
}

function tokens(s) {
  return normalizeText(s).split(' ').filter((w) => w.length > 0)
}

// Lời mời lịch sự ở đầu câu, không mang nghĩa
const POLITE_HEAD = /^(?:(?:hay|hãy|giúp tôi|giup toi|giúp mình|giup minh|làm ơn|lam on|cho tôi|cho toi|please)\s+)+/
// Từ nối giữa động từ và tên việc
const CONNECTOR = /^(?:(?:cái|cai|việc|viec|công việc|cong viec|task|todo|item)\s+)+/
// Lời kết thúc lịch sự ở cuối câu
// (chuỗi đã bỏ dấu nên phải là "di", không phải "đi")
const POLITE_TAIL = /(?:\s+(?:nhé|nhe|nha|di|giúp mình|giup minh|giùm|gium|dùm|dum|hộ|ho|please))+$/

const COMPLETE_TRIGGERS = [
  /^(?:đánh dấu|danh dau)\s+(?:là\s+|la\s+)?(?:hoàn thành|hoan thanh|hoàn tất|hoan tat|đã xong|da xong|xong|done|complete|completed)\b/,
  /^(?:hoàn thành|hoan thanh|hoàn tất|hoan tat|làm xong|lam xong|xong việc|xong viec|đã xong|da xong|kết thúc|ket thuc|done|complete|completed|finished|finish)\b/,
  /^(?:mark|set)\s+(?:it\s+|this\s+|that\s+|the\s+task\s+)?(?:as\s+)?(?:done|complete|completed)\b/,
]
const DELETE_TRIGGERS = [
  /^(?:xóa|xoá|xoa|delete|remove|hủy|huỷ|huy|bỏ|bo)\b/,
]

// "việc đó / cái này / việc vừa tạo" — trỏ vào công việc vừa nhắc trong chat
const DEICTIC =
  /^(?:đó|do|đấy|day|này|nay|kia|vừa nãy|vua nay|vừa tạo|vua tao|mới tạo|moi tao|vừa rồi|vua roi|nó|no|that|this|it)$/

// Nếu trong câu có giờ/ngày thì nhiều khả năng người dùng đang TẠO việc
// ("hoàn thành báo cáo mai 5h" hiếm khi là lệnh) → để luồng tạo xử lý.
const SCHEDULE_RX =
  /(\d{1,2}\s*(?:h|giờ|gio|:|g)\s*\d{0,2})|(\b\d{1,2}\s*\/\s*\d{1,2}\b)|(\b(?:hôm nay|hom nay|ngày mai|ngay mai|sáng mai|sang mai|tối nay|toi nay|hàng ngày|hang ngay|hàng tuần|hang tuan|mỗi tuần|moi tuan|every day|every week|tomorrow|today)\b)/i

/**
 * Tách câu lệnh khỏi câu văn.
 * @returns {null | { intent: 'COMPLETE'|'DELETE', target: string, rawTarget: string, deictic: boolean }}
 *   `target` là tên việc đã bỏ dấu (dùng để so khớp), `rawTarget` giữ nguyên
 *   dấu (dùng để hiển thị). Rỗng nghĩa là người dùng chỉ nói "việc đó".
 */
export function detectTaskCommand(raw) {
  const text = String(raw || '').trim()
  if (!text) return null

  const { norm, map } = normalizeWithMap(text)
  if (!norm) return null

  let start = 0
  let end = norm.length
  const work = () => norm.slice(start, end)
  // Cắt khoảng trắng ở hai đầu — nếu không, sau khi bỏ động từ ("xóa việc …")
  // phần còn lại bắt đầu bằng dấu cách nên các mẫu neo bằng ^ sẽ không khớp.
  const trim = () => {
    while (start < end && norm[start] === ' ') start += 1
    while (end > start && norm[end - 1] === ' ') end -= 1
  }
  const stripHead = (rx) => {
    trim()
    const before = work()
    const after = before.replace(rx, '')
    if (after === before) return false
    start += before.length - after.length
    return true
  }
  const stripTail = (rx) => {
    trim()
    const before = work()
    const after = before.replace(rx, '')
    if (after === before) return false
    end -= before.length - after.length
    return true
  }

  stripHead(POLITE_HEAD)

  // "mark Buy milk as done" — tên việc nằm GIỮA động từ và "done"
  const enWrap = text.match(/^\s*(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:done|complete|completed)\s*$/i)
  if (enWrap) {
    const t = normalizeText(enWrap[1])
      .replace(/^the\s+/, '')
      .replace(CONNECTOR, '')
      .replace(/^(?:cua)\s+/, '')
      .trim()
    return { intent: TASK_COMMAND.COMPLETE, target: t, rawTarget: enWrap[1].trim(), deictic: false }
  }

  let intent = null
  for (const rx of COMPLETE_TRIGGERS) {
    if (stripHead(rx)) {
      intent = TASK_COMMAND.COMPLETE
      break
    }
  }
  if (!intent) {
    for (const rx of DELETE_TRIGGERS) {
      if (stripHead(rx)) {
        intent = TASK_COMMAND.DELETE
        break
      }
    }
  }
  if (!intent) return null

  stripHead(CONNECTOR)
  stripHead(/^(?:của|cua)\s+/)
  stripTail(POLITE_TAIL)
  trim()

  const target = norm.slice(start, end)
  const rawTarget = target ? text.slice(map[start], map[end - 1] + 1).trim() : ''
  const deictic = !target || DEICTIC.test(target)

  // Câu có giờ/ngày và không phải đại từ → trả về cho luồng tạo việc
  if (target && !deictic && SCHEDULE_RX.test(text)) return null

  return { intent, target: deictic ? '' : target, rawTarget: deictic ? '' : rawTarget, deictic }
}

/**
 * Điểm khớp giữa tên người dùng gõ và tiêu đề công việc (0..100).
 * Khớp càng cụ thể càng cao; chỉ trùng một phần từ thì điểm thấp.
 */
export function scoreTaskMatch(target, title) {
  const a = normalizeText(target)
  const b = normalizeText(title)
  if (!a || !b) return 0
  if (a === b) return 100
  if (b.startsWith(a)) return 85
  if (b.includes(a)) return 75

  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.length || !tb.length) return 0

  const hit = ta.filter((w) => tb.includes(w)).length
  if (!hit) return 0

  // Tỉ lệ phủ của phía ngắn hơn: "họp team" khớp trọn "Họp team dự án"
  const ratio = hit / Math.min(ta.length, tb.length)
  if (ta.length === 1) return hit === 1 ? 55 : 0
  return Math.round(Math.min(ratio, 1) * 60)
}

const MATCH_FLOOR = 55

/**
 * Tìm công việc người dùng nhắc tới.
 * @param {string} target tên đã bỏ dấu, hoặc '' nếu dùng đại từ
 * @param {object[]} tasks danh sách công việc của người dùng
 * @param {object} [opts] `openOnly` (chỉ việc chưa xong), `lastTask` (việc vừa nhắc)
 */
export function findTaskMatches(target, tasks, opts = {}) {
  const { openOnly = false, lastTask = null } = opts
  const pool = (tasks || []).filter((t) => {
    if (!t) return false
    if (openOnly) return t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    return true
  })

  if (!target) {
    return lastTask && pool.some((t) => t.id === lastTask.id)
      ? { candidates: [{ task: lastTask, score: 100 }], confident: true }
      : { candidates: [], confident: false }
  }

  const scored = pool
    .map((task) => ({ task, score: scoreTaskMatch(target, task.title) }))
    .filter((m) => m.score >= MATCH_FLOOR)
    .sort(
      (a, b) =>
        b.score - a.score || new Date(a.task.dueAt).getTime() - new Date(b.task.dueAt).getTime()
    )

  const best = scored[0]
  const second = scored[1]
  // Nhiều việc cùng điểm cao (vd "họp" khớp cả "Họp team" lẫn "Họp khách") thì
  // không tự đoán — để người dùng chọn, tránh xóa/hoàn thành nhầm việc.
  const unique = !second || second.score < best.score
  const confident = Boolean(best) && unique && (best.score >= 75 || best.score - (second?.score ?? 0) >= 15)

  return { candidates: scored.slice(0, 5), confident }
}

/** Câu trả lời khi không tìm thấy việc nào khớp. */
export function noMatchMessage(intent, shown) {
  const name = shown ? `“${shown}”` : 'việc bạn vừa nhắc'
  const verb = intent === TASK_COMMAND.DELETE ? 'xóa' : 'đánh dấu hoàn thành'
  return `Tôi không tìm thấy công việc nào khớp với ${name} để ${verb}. Bạn thử gõ sát tên hơn, ví dụ “xóa việc Đi siêu thị”.`
}

/** Câu xác nhận sau khi đã thực hiện xong. */
export function doneMessage(intent, task) {
  return intent === TASK_COMMAND.DELETE
    ? `Đã xóa công việc “${task.title}”.`
    : `Đã đánh dấu hoàn thành “${task.title}” ✅`
}

export default {
  TASK_COMMAND,
  detectTaskCommand,
  findTaskMatches,
  scoreTaskMatch,
  doneMessage,
  noMatchMessage,
}
