import api from './apiClient'

// ─── Gói Pro Gia đình ────────────────────────────────────────
// Một khách trả tiền cho tới 4 tài khoản cùng dùng quyền lợi Pro.
// Cả chủ gói lẫn người trong nhà gọi cùng một đường GET /me/family rồi tự phân
// vai ở giao diện — như vậy hai phía không bao giờ nói hai chuyện khác nhau.

/** Trạng thái gói gia đình của người gọi. */
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

/** Rời nhà người khác (người trong nhà) — để tự mua gói riêng nếu muốn. */
export async function leaveFamily() {
  return api('POST', '/me/family/leave')
}
