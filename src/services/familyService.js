import api from './apiClient'

// ─── Gói Pro Doanh nghiệp ────────────────────────────────────────
// Một khách trả tiền cho tới 4 tài khoản cùng dùng quyền lợi Pro.
// Cả chủ gói lẫn người trong nhóm gọi cùng một đường GET /me/family rồi tự phân
// vai ở giao diện — như vậy hai phía không bao giờ nói hai chuyện khác nhau.

/** Trạng thái gói doanh nghiệp của người gọi. */
export async function getFamily() {
  return api('GET', '/me/family')
}

/** Mời một người vào nhà theo email (chủ gói). */
export async function inviteMember({ email, note } = {}) {
  return api('POST', '/me/family/members', { body: { email, note } })
}

/** Gỡ một thành viên (chủ gói) — người đó mất quyền Pro ngay. */
export async function removeMember(memberId) {
  return api('DELETE', `/me/family/members/${memberId}`)
}

/** Rời nhà người khác (người trong nhóm) — để tự mua gói riêng nếu muốn. */
export async function leaveFamily() {
  return api('POST', '/me/family/leave')
}

/**
 * Bảng "Cả nhóm hôm nay" — CHỈ chủ gói gọi được (các vai khác nhận lỗi và bỏ qua).
 * Trả số liệu từng người, tổng cả nhóm, và tên vài việc quá hạn lâu nhất.
 */
export async function getFamilyBoard() {
  return api('GET', '/me/family/board')
}

/** Người trong nhóm bật/tắt việc cho chủ gói xem tiến độ của mình. */
export async function setProgressSharing(shared) {
  return api('PUT', '/me/family/progress', { body: { shared } })
}
