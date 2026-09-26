import api from './apiClient'

// ─── Bảng giá (công khai, không cần đăng nhập) ──────────────
export async function getProducts() {
  return api('GET', '/billing/products')
}

// ─── Gói hiện tại, hạn mức AI, lịch sử đơn ──────────────────
export async function getMyBilling() {
  return api('GET', '/billing/me')
}

// ─── Tạo đơn mua gói → trả về mã đơn + thông tin chuyển khoản ─
export async function createOrder({ plan, cycle = 'MONTHLY' }) {
  return api('POST', '/billing/orders', { body: { plan, cycle } })
}

// ─── Trạng thái một đơn (giao diện hỏi lại mỗi vài giây) ─────
export async function getOrder(orderCode) {
  return api('GET', `/billing/orders/${orderCode}`)
}

export async function cancelOrder(orderCode) {
  return api('POST', `/billing/orders/${orderCode}/cancel`)
}

// ─── Dùng thử Pro (mỗi tài khoản một lần) ───────────────────
export async function startTrial() {
  return api('POST', '/billing/trial')
}

// ─── Quản trị: đối soát đơn ─────────────────────────────────
export async function adminListOrders({ status, keyword, page = 1, pageSize = 20 } = {}) {
  return api('GET', '/admin/orders', { query: { status, keyword, page, pageSize } })
}

export async function adminConfirmOrder(orderCode, body = {}) {
  return api('POST', `/admin/orders/${orderCode}/confirm`, { body })
}

export async function adminCancelOrder(orderCode, body = {}) {
  return api('POST', `/admin/orders/${orderCode}/cancel`, { body })
}

// Gán tay một giao dịch ngân hàng đã vào tài khoản nhưng chưa khớp đơn nào
// (khách ghi sai nội dung, chuyển thiếu…) vào một đơn đang chờ → kích hoạt gói.
export async function adminAttachTransfer(eventId, body) {
  return api('POST', `/admin/billing/transfers/${eventId}/attach`, { body })
}

// ─── Quản trị: cài đặt tài khoản nhận tiền (ACB…) ────────────
// Đặt trong app nên đổi ngân hàng / số tài khoản là ăn liền,
// không phải sửa biến môi trường rồi deploy lại.
export async function adminGetBillingSetup() {
  return api('GET', '/admin/billing/settings')
}

export async function adminSaveBillingSettings(body) {
  return api('PUT', '/admin/billing/settings', { body })
}

export async function adminRotateWebhookSecret() {
  return api('POST', '/admin/billing/settings/rotate-secret')
}

// ─── Quản trị: API ngân hàng (hệ thống tự kéo giao dịch về) ──
// Khác với webhook (ngân hàng/SePay đẩy về), đây là hệ thống CHỦ ĐỘNG gọi API
// ngân hàng nên tiền vào là gói tự bật, không cần ai xem sao kê.
export async function adminTestBankConnection() {
  return api('POST', '/admin/billing/test-connection')
}

export async function adminSyncBankNow() {
  return api('POST', '/admin/billing/sync')
}
