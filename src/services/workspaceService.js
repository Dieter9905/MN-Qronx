// ─── Không gian làm việc (Cá nhân / Lớp học / Nhóm) ───────────────────────
// Một tài khoản có nhiều không gian; đổi chế độ = đổi không gian đang chọn,
// mọi request sau đó mang header X-Workspace để backend lọc đúng dữ liệu.
import api from './apiClient'

export async function listWorkspaces() {
  return api('GET', '/workspaces')
}

// STUDENT = Lớp học (1 trường, có TKB), TEAM = Nhóm làm việc (Jira-lite)
export async function createWorkspace(type, name) {
  return api('POST', '/workspaces', { body: { type, name } })
}

export async function renameWorkspace(workspaceId, name) {
  return api('PUT', `/workspaces/${workspaceId}`, { body: { name } })
}

export async function leaveWorkspace(workspaceId) {
  return api('DELETE', `/workspaces/${workspaceId}`)
}

// ─── Thành viên nhóm (chế độ Nhóm làm việc) ─────────────────────────────

/** Danh sách thành viên + số việc đang mở của từng người trong nhóm. */
export async function getMembers(workspaceId) {
  return api('GET', `/workspaces/${workspaceId}/members`)
}

/** Vào nhóm bằng mã mời MN-XXXXXX mà chủ nhóm chia sẻ. */
export async function joinWorkspace(code) {
  return api('POST', '/workspaces/join', { body: { code } })
}

/** Chủ nhóm tạo lại mã mời — mã cũ hết hiệu lực ngay. */
export async function regenerateInvite(workspaceId) {
  return api('POST', `/workspaces/${workspaceId}/invite`)
}

/** Chủ nhóm gỡ một thành viên khỏi nhóm. */
export async function removeMember(workspaceId, memberUserId) {
  return api('DELETE', `/workspaces/${workspaceId}/members/${memberUserId}`)
}
