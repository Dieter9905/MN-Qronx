import api, { apiBlob } from './apiClient'

/**
 * CSKH trong app – phía người dùng.
 * Backend: xem backend/src/services/supportService.js
 */

// Toàn bộ hội thoại (kèm 60 tin gần nhất) — gọi khi mở trang
export async function getMyConversation() {
  return api('GET', '/support/conversation')
}

// Chỉ lấy tin mới hơn id `since` — dùng cho vòng làm mới nhanh kiểu chat trực tiếp
export async function getNewSupportMessages(since) {
  return api('GET', '/support/messages', since ? { query: { since } } : {})
}

export async function sendSupportMessage({ body, attachments }) {
  return api('POST', '/support/messages', { body: { body, attachments } })
}

/** Báo cho huy hiệu trên menu biết vừa đọc xong (xem useUnreadBadge). */
function notifyRead() {
  try {
    window.dispatchEvent(new Event('mnq:support-read'))
  } catch {
    /* môi trường không có window (test) — bỏ qua */
  }
}

export async function markSupportRead() {
  const res = await api('POST', '/support/read')
  notifyRead()
  return res
}

export async function getSupportUnread() {
  return api('GET', '/support/unread')
}

// ─── Phía admin ──────────────────────────────────────────

export async function getAdminConversations({ keyword, status, unread, page = 1, pageSize = 10 } = {}) {
  return api('GET', '/admin/support/conversations', {
    query: { keyword, status, unread, page, pageSize },
  })
}

export async function getAdminConversation(conversationId) {
  return api('GET', `/admin/support/conversations/${conversationId}`)
}

export async function replyAsAdmin(conversationId, { body, attachments }) {
  return api('POST', `/admin/support/conversations/${conversationId}/messages`, {
    body: { body, attachments },
  })
}

export async function markAdminConversationRead(conversationId) {
  const res = await api('POST', `/admin/support/conversations/${conversationId}/read`)
  notifyRead()
  return res
}

export async function setAdminConversationStatus(conversationId, status) {
  return api('PUT', `/admin/support/conversations/${conversationId}/status`, { body: { status } })
}

export async function getAdminSupportUnread() {
  return api('GET', '/admin/support/unread')
}

// Ảnh đính kèm cần token nên phải tải qua fetch rồi tạo blob URL cho <img>
const blobCache = new Map()

export async function getAttachmentBlobUrl(attachmentId) {
  if (blobCache.has(attachmentId)) return blobCache.get(attachmentId)
  const blob = await apiBlob(`/support/attachments/${attachmentId}`)
  const url = URL.createObjectURL(blob)
  blobCache.set(attachmentId, url)
  return url
}

/** Xoá cache blob khi đăng xuất (tránh giữ ảnh của tài khoản cũ trên máy dùng chung). */
export function clearAttachmentCache() {
  for (const url of blobCache.values()) URL.revokeObjectURL(url)
  blobCache.clear()
}
