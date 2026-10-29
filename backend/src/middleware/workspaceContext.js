// ─── Middleware X-Workspace: ngữ cảnh không gian làm việc ─────────────
// Trục để 3 chế độ (Cá nhân / Lớp học / Nhóm) sống chung trong 1 tài khoản:
// - Client gửi `X-Workspace: <id>` → verify membership rồi gắn req.workspace
//   = { workspaceId, type, name, role, ownerId }.
// - KHÔNG gửi header (web cũ, extension, app Android, script…) → req.workspace
//   = null, nghĩa là "ngữ cảnh Cá nhân mặc định": Task cũ (task_workspace_id
//   = null) hiển thị y như trước, không một dòng API cũ nào phải phá.
// - Service chỉ cần thêm 1 filter theo req.workspace — không cần if mode nào.

import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'

export async function workspaceContext(req, res, next) {
  const header = req.headers['x-workspace']
  const raw = Array.isArray(header) ? header[0] : header

  // Middleware này gắn TRƯỚC từng nhóm route (trong đó mới gắn auth), nên khi
  // req.user chưa tồn tại phải nhường đường: auth phía sau sẽ 401 nếu chưa
  // đăng nhập. Không được đọc req.user.id ở đây.
  if (!req.user) {
    req.workspace = null
    return next()
  }

  // Không header → ngữ cảnh cá nhân truyền thống, không tốn 1 lần query nào.
  if (!raw) {
    req.workspace = null
    return next()
  }

  const workspaceId = parseInt(raw, 10)
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return next(ApiError.badRequest('X-Workspace phải là mã không gian hợp lệ'))
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: req.user.id },
    include: {
      workspace: { select: { workspaceId: true, type: true, name: true, ownerId: true } },
    },
  })

  if (!member) {
    return next(ApiError.forbidden('Bạn không phải thành viên của không gian này'))
  }

  req.workspace = {
    workspaceId: member.workspace.workspaceId,
    type: member.workspace.type,
    name: member.workspace.name,
    ownerId: member.workspace.ownerId,
    role: member.role,
  }
  next()
}

export default workspaceContext
