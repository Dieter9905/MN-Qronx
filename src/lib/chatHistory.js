import { sessionUser } from '../services/session'

/**
 * Lịch sử trò chuyện với Trợ lý AI, lưu theo TÀI KHOẢN để F5 / đổi trang /
 * quay lại sau vẫn còn hội thoại (trước đây chat giữ trong state nên mất sạch).
 *
 * Quy ước khoá giống cache dữ liệu: `mnq:chat:ai:<userId>` — hai tài khoản trên
 * cùng máy không lẫn hội thoại của nhau, và `clearChatMessages()` được gọi khi
 * đăng xuất (máy dùng chung).
 *
 * An toàn: thẻ xác nhận của lệnh phá huỷ (xoá việc) KHÔNG sống qua lần tải lại
 * trang — dữ liệu khi đó đã cũ, bấm nhầm có thể tác động sai việc. Khi lưu, các
 * thẻ đó được đánh dấu `expired` để UI hiện "hết hiệu lực" thay vì nút bấm.
 */
const CHAT_PREFIX = 'mnq:chat:ai:'
const MAX_MESSAGES = 40
const MAX_TEXT = 2000

function storageKey() {
  const uid = sessionUser()?.id ?? 'guest'
  return `${CHAT_PREFIX}${uid}`
}

function trimText(text) {
  return typeof text === 'string' && text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text
}

function sanitize(messages) {
  return messages.slice(-MAX_MESSAGES).map((m) => {
    const copy = { ...m, text: trimText(m.text) }
    if (copy.command && !copy.command.resolved) {
      copy.command = { ...copy.command, expired: true, candidates: copy.command.candidates || [] }
    }
    return copy
  })
}

/** Lịch sử đã lưu, hoặc `fallback` (danh sách lời chào) nếu chưa có gì. */
export function loadChatMessages(fallback) {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return fallback
    return parsed
  } catch {
    return fallback
  }
}

export function saveChatMessages(messages) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(sanitize(messages)))
  } catch {
    /* hết dung lượng / chế độ riêng tư — bỏ qua, chỉ là lịch sử chat */
  }
}

/** Xoá hội thoại của tài khoản hiện tại (và mọi tài khoản khác trên cùng máy). */
export function clearChatMessages() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CHAT_PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    /* bỏ qua */
  }
}

/**
 * Việc "vừa được nhắc" để hiểu câu lệnh đại từ ("hoàn thành việc đó") sau khi
 * tải lại trang: lấy từ thẻ lệnh gần nhất còn trong lịch sử.
 */
export function lastMentionedFrom(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const cmd = messages[i].command
    if (cmd?.candidates?.length) return cmd.candidates[0].task
  }
  return null
}
