import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { parsePagination, paginationMeta } from '../utils/pagination.js'

/**
 * CSKH trong app: mỗi người dùng có MỘT hội thoại hỗ trợ liên tục với admin
 * (giống hộp thư hỗ trợ của ứng dụng lớn). Tin nhắn hai chiều, có trạng thái
 * Chờ xử lý / Đã xong, đếm số chưa đọc cho từng phía để hiện huy hiệu.
 *
 * Ảnh đính kèm lưu thẳng trong DB (xem model SupportAttachment) để không phụ
 * thuộc dịch vụ lưu file ngoài; client đã nén ảnh trước khi gửi nhưng server
 * vẫn kiểm tra lại loại file và dung lượng.
 */

const MAX_ATTACHMENTS = 3
const MAX_ATTACHMENT_BYTES = 1_400_000 // ~1,4 MB/ảnh sau khi nén
const MAX_ATTACHMENT_TOTAL_BYTES = 3_500_000
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BODY = 4000
const PREVIEW_LEN = 140
const MESSAGE_PAGE = 60

const CONVERSATION_STATUSES = ['OPEN', 'RESOLVED']

// Thông tin khách hàng admin cần thấy khi trả lời (không lộ mật khẩu/điện thoại dư thừa)
const CUSTOMER_SELECT = {
  userId: true,
  fullName: true,
  email: true,
  plan: true,
  avatarUrl: true,
  planExpiresAt: true,
  createdAt: true,
}

const MESSAGE_INCLUDE = {
  attachments: {
    select: { supportAttachmentId: true, mimeType: true, sizeBytes: true },
  },
  author: {
    select: { fullName: true, role: { select: { roleName: true } } },
  },
}

function previewOf(body, attachments = []) {
  const text = String(body || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text) return text.length > PREVIEW_LEN ? `${text.slice(0, PREVIEW_LEN - 1)}…` : text
  return attachments.length ? `[${attachments.length} ảnh]` : ''
}

/** Giải mã ảnh base64 client gửi lên, kiểm tra loại + dung lượng từng ảnh và tổng. */
function decodeAttachments(list) {
  if (!Array.isArray(list) || list.length === 0) return []
  if (list.length > MAX_ATTACHMENTS) {
    throw ApiError.badRequest(`Mỗi tin nhắn chỉ gửi được tối đa ${MAX_ATTACHMENTS} ảnh`)
  }

  let total = 0
  return list.map((item) => {
    const mimeType = String(item?.mimeType || '').toLowerCase()
    if (!ALLOWED_MIME.has(mimeType)) {
      throw ApiError.badRequest('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF')
    }
    const raw = String(item?.dataBase64 || '').replace(/^data:[^,]+,/, '')
    if (!raw) throw ApiError.badRequest('Ảnh gửi lên không hợp lệ')

    const data = Buffer.from(raw, 'base64')
    if (!data.length) throw ApiError.badRequest('Ảnh gửi lên không hợp lệ')
    if (data.length > MAX_ATTACHMENT_BYTES) {
      throw ApiError.badRequest('Mỗi ảnh tối đa khoảng 1,4 MB — bạn thử ảnh nhỏ hơn nhé')
    }
    total += data.length
    if (total > MAX_ATTACHMENT_TOTAL_BYTES) {
      throw ApiError.badRequest('Tổng dung lượng ảnh quá lớn, bạn gửi bớt ảnh nhé')
    }
    return { mimeType, sizeBytes: data.length, data }
  })
}

/** `viewerRole` để biết tin nào là của người đang xem (hiển thị bên phải). */
function mapMessage(m, viewerRole) {
  return {
    id: m.supportMessageId,
    senderRole: m.senderRole,
    mine: m.senderRole === viewerRole,
    authorName: m.author?.fullName || null,
    authorIsAdmin: m.senderRole === 'ADMIN' || m.author?.role?.roleName === 'ADMIN',
    body: m.body,
    createdAt: m.createdAt,
    attachments: (m.attachments || []).map((a) => ({
      id: a.supportAttachmentId,
      mimeType: a.mimeType,
      size: a.sizeBytes,
    })),
  }
}

function mapConversation(c) {
  return {
    id: c.supportConversationId,
    status: c.status,
    unread: c.unreadForAdmin,
    lastMessagePreview: c.lastMessagePreview || '',
    lastMessageAt: c.lastMessageAt,
    customer: c.user
      ? {
          id: c.user.userId,
          fullName: c.user.fullName,
          email: c.user.email,
          plan: c.user.plan,
          avatarUrl: c.user.avatarUrl || null,
        }
      : null,
  }
}

/** Bọc chung phần ghi tin nhắn: kiểm tra nội dung, tạo tin, cập nhật hội thoại. */
async function insertMessage({ conversationId, senderRole, authorId, body, attachments }) {
  const decoded = decodeAttachments(attachments)
  const text = String(body || '').trim()
  if (!text && decoded.length === 0) {
    throw ApiError.badRequest('Bạn chưa nhập nội dung')
  }
  if (text.length > MAX_BODY) {
    throw ApiError.badRequest(`Nội dung tối đa ${MAX_BODY} ký tự`)
  }

  const now = new Date()
  const created = await prisma.supportMessage.create({
    data: {
      conversationId,
      senderRole,
      authorId: authorId ?? null,
      body: text,
      ...(decoded.length ? { attachments: { create: decoded } } : {}),
    },
    include: MESSAGE_INCLUDE,
  })

  await prisma.supportConversation.update({
    where: { supportConversationId: conversationId },
    data: {
      lastMessageAt: now,
      lastMessagePreview: previewOf(text, decoded),
      // Hai bên nhắn lại thì hội thoại sống lại (không cần tạo yêu cầu mới)
      status: 'OPEN',
      ...(senderRole === 'USER'
        ? { unreadForAdmin: { increment: 1 } }
        : { unreadForUser: { increment: 1 } }),
    },
  })

  return created
}

async function conversationOfUser(userId) {
  return prisma.supportConversation.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

// ─── Phía người dùng ─────────────────────────────────────

/** Toàn bộ hội thoại của tôi (tạo hội thoại trống nếu chưa từng liên hệ). */
export async function getMyConversation(userId) {
  const conversation = await conversationOfUser(userId)
  const messages = await prisma.supportMessage.findMany({
    where: { conversationId: conversation.supportConversationId },
    include: MESSAGE_INCLUDE,
    orderBy: { supportMessageId: 'desc' },
    take: MESSAGE_PAGE,
  })

  return {
    id: conversation.supportConversationId,
    status: conversation.status,
    unread: conversation.unreadForUser,
    lastMessageAt: conversation.lastMessageAt,
    messages: messages.reverse().map((m) => mapMessage(m, 'USER')),
  }
}

/** Chỉ lấy tin mới hơn `since` — dùng cho vòng làm mới nhanh (chat trực tiếp). */
export async function listMyMessages(userId, { since } = {}) {
  const conversation = await prisma.supportConversation.findUnique({ where: { userId } })
  if (!conversation) {
    return { messages: [], unread: 0, status: 'OPEN' }
  }

  const where = { conversationId: conversation.supportConversationId }
  const sinceId = Number(since)
  if (Number.isInteger(sinceId) && sinceId > 0) {
    where.supportMessageId = { gt: sinceId }
  }

  const messages = await prisma.supportMessage.findMany({
    where,
    include: MESSAGE_INCLUDE,
    orderBy: { supportMessageId: 'asc' },
    take: MESSAGE_PAGE,
  })

  return {
    messages: messages.map((m) => mapMessage(m, 'USER')),
    unread: conversation.unreadForUser,
    status: conversation.status,
  }
}

export async function sendUserMessage(userId, payload = {}) {
  const conversation = await conversationOfUser(userId)
  const message = await insertMessage({
    conversationId: conversation.supportConversationId,
    senderRole: 'USER',
    authorId: userId,
    body: payload.body,
    attachments: payload.attachments,
  })
  return mapMessage(message, 'USER')
}

/** Người dùng đã đọc tin của admin. */
export async function markMyConversationRead(userId) {
  const conversation = await prisma.supportConversation.findUnique({ where: { userId } })
  if (!conversation) return { unread: 0 }

  const now = new Date()
  await prisma.supportMessage.updateMany({
    where: {
      conversationId: conversation.supportConversationId,
      senderRole: 'ADMIN',
      readByUserAt: null,
    },
    data: { readByUserAt: now },
  })
  await prisma.supportConversation.update({
    where: { userId },
    data: { unreadForUser: 0 },
  })
  return { unread: 0 }
}

export async function getUnreadForUser(userId) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { userId },
    select: { unreadForUser: true },
  })
  return conversation?.unreadForUser ?? 0
}

// ─── Phía admin ──────────────────────────────────────────

export async function getUnreadForAdmin() {
  const agg = await prisma.supportConversation.aggregate({ _sum: { unreadForAdmin: true } })
  return agg._sum.unreadForAdmin ?? 0
}

export async function listConversationsForAdmin(query = {}) {
  const { page, pageSize } = parsePagination(query)
  const where = {}

  if (CONVERSATION_STATUSES.includes(query.status)) where.status = query.status
  if (query.unread === 'true' || query.unread === true) where.unreadForAdmin = { gt: 0 }
  if (query.keyword) {
    where.OR = [
      { user: { fullName: { contains: query.keyword, mode: 'insensitive' } } },
      { user: { email: { contains: query.keyword, mode: 'insensitive' } } },
      { lastMessagePreview: { contains: query.keyword, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.supportConversation.findMany({
      where,
      // Việc chờ trả lời lên trước, rồi mới tới tin mới nhất
      orderBy: [{ unreadForAdmin: 'desc' }, { lastMessageAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: CUSTOMER_SELECT } },
    }),
    prisma.supportConversation.count({ where }),
  ])

  return { items: items.map(mapConversation), pagination: paginationMeta(total, page, pageSize) }
}

export async function getConversationForAdmin(conversationId) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { supportConversationId: conversationId },
    include: {
      user: { select: CUSTOMER_SELECT },
      messages: {
        include: MESSAGE_INCLUDE,
        orderBy: { supportMessageId: 'desc' },
        take: MESSAGE_PAGE,
      },
    },
  })
  if (!conversation) throw ApiError.notFound('Không tìm thấy hội thoại hỗ trợ')

  return {
    ...mapConversation(conversation),
    messages: conversation.messages.reverse().map((m) => mapMessage(m, 'ADMIN')),
  }
}

export async function sendAdminMessage(adminId, conversationId, payload = {}) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { supportConversationId: conversationId },
    select: { supportConversationId: true },
  })
  if (!conversation) throw ApiError.notFound('Không tìm thấy hội thoại hỗ trợ')

  const message = await insertMessage({
    conversationId,
    senderRole: 'ADMIN',
    authorId: adminId,
    body: payload.body,
    attachments: payload.attachments,
  })
  return mapMessage(message, 'ADMIN')
}

export async function markConversationReadForAdmin(conversationId) {
  const now = new Date()
  await prisma.supportMessage.updateMany({
    where: { conversationId, senderRole: 'USER', readByAdminAt: null },
    data: { readByAdminAt: now },
  })
  await prisma.supportConversation.update({
    where: { supportConversationId: conversationId },
    data: { unreadForAdmin: 0 },
  })
  return { unread: 0 }
}

export async function setConversationStatus(conversationId, status) {
  if (!CONVERSATION_STATUSES.includes(status)) {
    throw ApiError.badRequest('Trạng thái chỉ có thể là OPEN hoặc RESOLVED')
  }
  const conversation = await prisma.supportConversation.findUnique({
    where: { supportConversationId: conversationId },
    select: { supportConversationId: true },
  })
  if (!conversation) throw ApiError.notFound('Không tìm thấy hội thoại hỗ trợ')

  const updated = await prisma.supportConversation.update({
    where: { supportConversationId: conversationId },
    data: { status },
    include: { user: { select: CUSTOMER_SELECT } },
  })
  return mapConversation(updated)
}

/** Ảnh trong hội thoại: chỉ chủ hội thoại hoặc admin xem được. */
export async function getAttachmentFor(userId, role, attachmentId) {
  const attachment = await prisma.supportAttachment.findUnique({
    where: { supportAttachmentId: attachmentId },
    select: {
      supportAttachmentId: true,
      mimeType: true,
      sizeBytes: true,
      data: true,
      message: { select: { conversation: { select: { userId: true } } } },
    },
  })
  if (!attachment) throw ApiError.notFound('Không tìm thấy ảnh')

  const ownerId = attachment.message?.conversation?.userId
  if (role !== 'ADMIN' && ownerId !== userId) {
    throw ApiError.forbidden('Bạn không có quyền xem ảnh này')
  }
  return attachment
}

export const SUPPORT_LIMITS = {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_BODY,
}
