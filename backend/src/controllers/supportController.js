import catchAsync from '../utils/catchAsync.js'
import * as supportService from '../services/supportService.js'
import { success } from '../dto/response/apiResponse.js'

// ─── Người dùng ──────────────────────────────────────────

export const getMyConversation = catchAsync(async (req, res) => {
  const data = await supportService.getMyConversation(req.user.id)
  success(res, 200, 'Lấy hội thoại hỗ trợ thành công', data)
})

export const getMyMessages = catchAsync(async (req, res) => {
  const data = await supportService.listMyMessages(req.user.id, req.query)
  success(res, 200, 'Lấy tin nhắn hỗ trợ thành công', data)
})

export const sendMessage = catchAsync(async (req, res) => {
  const message = await supportService.sendUserMessage(req.user.id, req.body)
  success(res, 201, 'Đã gửi tin nhắn', message)
})

export const markRead = catchAsync(async (req, res) => {
  const data = await supportService.markMyConversationRead(req.user.id)
  success(res, 200, 'Đã đánh dấu là đã đọc', data)
})

export const getUnread = catchAsync(async (req, res) => {
  const unread = await supportService.getUnreadForUser(req.user.id)
  success(res, 200, 'Thao tác thành công', { unread })
})

export const getAttachment = catchAsync(async (req, res) => {
  const { attachmentId } = req.params
  const attachment = await supportService.getAttachmentFor(
    req.user.id,
    req.user.role,
    parseInt(attachmentId, 10)
  )
  // Ảnh trả về dạng nhị phân (không bọc trong envelope JSON) — client tự tạo blob URL
  res.setHeader('Content-Type', attachment.mimeType)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('Content-Length', attachment.data.length)
  res.send(Buffer.from(attachment.data))
})

// ─── Admin ───────────────────────────────────────────────

export const adminListConversations = catchAsync(async (req, res) => {
  const data = await supportService.listConversationsForAdmin(req.query)
  success(res, 200, 'Lấy danh sách hội thoại hỗ trợ thành công', data)
})

export const adminGetConversation = catchAsync(async (req, res) => {
  const { conversationId } = req.params
  const data = await supportService.getConversationForAdmin(parseInt(conversationId, 10))
  success(res, 200, 'Lấy hội thoại hỗ trợ thành công', data)
})

export const adminReply = catchAsync(async (req, res) => {
  const { conversationId } = req.params
  const message = await supportService.sendAdminMessage(
    req.user.id,
    parseInt(conversationId, 10),
    req.body
  )
  success(res, 201, 'Đã gửi phản hồi', message)
})

export const adminMarkRead = catchAsync(async (req, res) => {
  const { conversationId } = req.params
  const data = await supportService.markConversationReadForAdmin(parseInt(conversationId, 10))
  success(res, 200, 'Đã đánh dấu là đã đọc', data)
})

export const adminSetStatus = catchAsync(async (req, res) => {
  const { conversationId } = req.params
  const data = await supportService.setConversationStatus(
    parseInt(conversationId, 10),
    req.body.status
  )
  success(res, 200, 'Đã cập nhật trạng thái hội thoại', data)
})

export const adminUnread = catchAsync(async (req, res) => {
  const unread = await supportService.getUnreadForAdmin()
  success(res, 200, 'Thao tác thành công', { unread })
})
