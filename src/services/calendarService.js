import api from './apiClient'

// ─── Đồng bộ lịch .ics (một chiều: app → Google Calendar/Outlook) ───
// URL chứa khoá riêng của người dùng nên app lịch đọc được mà không cần đăng nhập.

// GET /api/v1/me/ics – lấy (tự sinh) URL lịch của mình
export async function getMyIcsUrl() {
  return api('GET', '/me/ics')
}

// POST /api/v1/me/ics/rotate – tạo khoá mới, URL cũ ngừng hoạt động ngay
export async function rotateIcsUrl() {
  return api('POST', '/me/ics/rotate')
}
