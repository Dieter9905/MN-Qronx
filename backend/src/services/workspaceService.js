// ─── Not gian làm việc (Workspace) ─────────────────────────────────────
// 1 tài khoản có thể nằm nhiều không gian cùng lúc:
//   - PERSONAL: mặc định. Luôn tự tạo 1 dòng khi list nếu thiếu (lazy) để
//     UI sidebar có gì hiển thị ngay; Task cũ (taskWorkspaceId = null) vẫn
//     được quét chung vào đây nên không phải di chuyển dữ liệu cũ.
//   - STUDENT: Lớp học (Phase 2 sẽ cắm SchoolLink + lưới TKB).
//   - TEAM: Nhóm làm việc phân công kiểu Jira (Phase 3).
//
// Gói hiệu lực theo NGỮ CẢNH (chốt thiết kế): Task Cá nhân dùng gói user,
// Task trong STUDENT/TEAM dùng gói của OWNER không gian → `workspacePlan()`.

import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { getUserPlan } from '../utils/planLimits.js'

// Tham số giới hạn theo gói, tách khỏi planLimits PLANS để không đụng catalog
// doanh thu hiện có; khi Phase 2/3 bế tắc thì nhập vào PLANS sau.
export const WORKSPACE_LIMITS = {
  FREE:   { studentWorkspaces: 1, teamWorkspaces: 0, membersPerWorkspace: 0 },
  PLUS:   { studentWorkspaces: 2, teamWorkspaces: 0, membersPerWorkspace: 0 },
  PRO:    { studentWorkspaces: 10, teamWorkspaces: 1, membersPerWorkspace: 4 },
  // BUSINESS giữ đúng thông điệp hiện tại: 1 gói dùng chung cho tối đa 10 tài khoản
  BUSINESS: { studentWorkspaces: Infinity, teamWorkspaces: Infinity, membersPerWorkspace: 9 },
}

function limitOf(plan, key) {
  return WORKSPACE_LIMITS[plan]?.[key] ?? 0
}

/**
 * Gói hiệu lực trong một không gian (chốt thiết kế): STUDENT/TEAM → gói Owner;
 * hoặc personal → gói của chính người dùng (truyền fallbackUserId).
 */
export async function workspacePlan(workspace, fallbackUserId = null) {
  if (!workspace || workspace.type === 'PERSONAL') {
    if (fallbackUserId != null) return getUserPlan(fallbackUserId)
    return getUserPlan(workspace?.ownerId)
  }
  return getUserPlan(workspace.ownerId)
}

/** Đảm bảo mỗi user luôn có đúng 1 Workspace PERSONAL mặc định (lazy). */
export async function ensureDefaultWorkspace(userId) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { user: { userId }, isDefault: true, workspace: { type: 'PERSONAL' } },
    include: { workspace: true },
  })
  if (existing) {
    return { workspace: existing.workspace, member: existing }
  }

  // Personal mặc định chưa có → tạo (trường hợp user cũ trước khi có Workspace)
  const user = await prisma.user.findUnique({ where: { userId }, select: { fullName: true } })
  return prisma.$transaction(async (tx) => {
    const name = `Cá nhân — ${user?.fullName || 'Không gian của tôi'}`
    const ws = await tx.workspace.create({
      data: { type: 'PERSONAL', name, ownerId: userId },
    })
    const member = await tx.workspaceMember.create({
      data: { workspaceId: ws.workspaceId, userId, role: 'OWNER', isDefault: true },
    })
    return { workspace: ws, member }
  })
}

const OWNER_SELECT = { userId: true, fullName: true, avatarUrl: true }

/** Danh sách không gian của user (personal luôn có mặt sau lazy-create). */
export async function listMine(userId) {
  const ensured = await ensureDefaultWorkspace(userId)
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: [{ workspace: { type: 'asc' } }, { workspaceMemberId: 'asc' }],
    include: {
      workspace: {
        select: {
          workspaceId: true,
          type: true,
          name: true,
          ownerId: true,
          inviteCode: true,
          owner: { select: OWNER_SELECT },
          _count: { select: { members: true, tasks: true } },
        },
      },
    },
  })
  if (!memberships.some((m) => m.workspace.workspaceId === ensured.workspace.workspaceId)) {
    // Tranh chấp hiếm: personal mặc định vừa tạo — đẩy lên đầu danh sách
    memberships.unshift({
      workspaceMemberId: ensured.member.workspaceMemberId,
      workspaceId: ensured.workspace.workspaceId,
      role: ensured.member.role,
      isDefault: ensured.member.isDefault,
      workspace: {
        workspaceId: ensured.workspace.workspaceId,
        type: ensured.workspace.type,
        name: ensured.workspace.name,
        ownerId: ensured.workspace.ownerId,
        inviteCode: null,
        owner: (await prisma.user.findUnique({ where: { userId }, select: OWNER_SELECT })),
        _count: { members: 1, tasks: 0 },
      },
    })
  }
  return memberships
}

function generateWorkspaceCode() {
  // Mã mời dạng MN-XXXXXX (chống collide bằng vòng thử — xác suất đụng thấp)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'MN-' + Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

/** Tạo không gian STUDENT/TEAM theo hạn mức của gói CÁ NHÂN của người tạo. */
export async function create(userId, { type, name }) {
  if (type !== 'STUDENT' && type !== 'TEAM') {
    throw ApiError.badRequest('Chỉ tạo được không gian Lớp học (STUDENT) hoặc Nhóm (TEAM)')
  }
  if (!name?.trim()) throw ApiError.badRequest('Tên không gian trống')

  const plan = await getUserPlan(userId)
  // DÙNG WORKSPACE_LIMITS riêng — planLimit() đọc PLANS gốc (không có key này,
  // mặc định Infinity) nên miễn phí tạo cả TEAM là sai.
  const limit = limitOf(plan, type === 'STUDENT' ? 'studentWorkspaces' : 'teamWorkspaces')
  if (limit <= 0) {
    throw ApiError.badRequest(
      type === 'STUDENT'
        ? 'Chế độ Lớp học cần gói Plus trở lên (gói miễn phí giữ 1 lớp duy nhất).'
        : 'Chế độ Nhóm làm việc cần gói Pro (Pro/Business) — nâng cấp để phân công việc cho thành viên.'
    )
  }
  const owned = await prisma.workspace.count({ where: { ownerId: userId, type } })
  if (owned >= limit) {
    throw ApiError.badRequest(
      `Gói hiện tại chỉ tạo tối đa ${limit} không gian ${type === 'STUDENT' ? 'Lớp học' : 'Nhóm'} — bạn đã đủ.`
    )
  }

  // Personal mặc định luôn tồn tại trước các không gian mới
  const ensured = await ensureDefaultWorkspace(userId)

  return prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        type,
        name: name.trim(),
        ownerId: userId,
        inviteCode: type === 'TEAM' ? generateWorkspaceCode() : null,
      },
    })
    const member = await tx.workspaceMember.create({
      data: {
        workspaceId: ws.workspaceId,
        userId,
        role: type === 'TEAM' ? 'OWNER' : 'OWNER',
        isDefault: false,
      },
    })
    return { workspace: ws, member, personalWorkspaceId: ensured.workspace.workspaceId }
  })
}

/** Đặt không gian mặc định khi không gửi X-Workspace. */
export async function setDefault(userId, workspaceId) {
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  })
  if (!member) throw ApiError.notFound('Không tìm thấy không gian hoặc bạn không là thành viên')

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    await tx.workspaceMember.update({ where: { workspaceMemberId: member.workspaceMemberId }, data: { isDefault: true } })
  })
  return { workspaceId, isDefault: true }
}

/** Đổi tên — chỉ Owner của không gian. */
export async function rename(userId, workspaceId, name) {
  if (!name?.trim()) throw ApiError.badRequest('Tên không gian trống')
  const ws = await prisma.workspace.findFirst({ where: { workspaceId, ownerId: userId } })
  if (!ws) throw ApiError.forbidden('Chỉ chủ không gian mới đổi được tên')
  return prisma.workspace.update({ where: { workspaceId }, data: { name: name.trim() } })
}

/**
 * Rời / xoá không gian:
 * - Owner: xoá sạch không gian (chỉ khi không còn task nào trong đó).
 * - Thành viên: rời nhóm.
 */
export async function leaveOrDelete(userId, workspaceId) {
  const ws = await prisma.workspace.findUnique({
    where: { workspaceId },
    include: { _count: { select: { tasks: true, members: true } } },
  })
  if (!ws) throw ApiError.notFound('Không tìm thấy không gian')

  if (ws.ownerId === userId) {
    if (ws._count.tasks > 0) {
      throw ApiError.badRequest(
        `Không gian còn ${ws._count.tasks} công việc — chuyển hoặc xoá hết trước khi bỏ không gian.`
      )
    }
    await prisma.workspace.delete({ where: { workspaceId } })
    return { deleted: true }
  }

  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId } })
  if (!member) throw ApiError.notFound('Bạn không là thành viên của không gian này')
  await prisma.workspaceMember.delete({ where: { workspaceMemberId: member.workspaceMemberId } })
  return { left: true }
}

// ─── Thành viên nhóm (chế độ Nhóm làm việc) ────────────────────────
// Nhóm chỉ sống được khi có người thứ hai: chủ nhóm lấy mã mời (MN-XXXXXX) đưa
// cho đồng nghiệp, họ nhập mã là vào cùng không gian — không phải mời qua email
// từng người như gói Doanh nghiệp gia đình.

const MEMBER_SELECT = {
  workspaceMemberId: true,
  role: true,
  isDefault: true,
  createdAt: true,
  user: { select: { userId: true, fullName: true, email: true, avatarUrl: true, plan: true } },
}

/** Thành viên của một không gian — mọi thành viên xem được (để biết giao việc cho ai). */
export async function listMembers(userId, workspaceId) {
  const me = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    include: { workspace: { select: { workspaceId: true, type: true, name: true, ownerId: true, inviteCode: true } } },
  })
  if (!me) throw ApiError.forbidden('Bạn không phải thành viên của không gian này')

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: [{ role: 'asc' }, { workspaceMemberId: 'asc' }],
    select: MEMBER_SELECT,
  })

  // Số việc đang mở của từng người TRONG không gian này — bảng "ai đang làm gì"
  // chỉ có nghĩa khi biết ai đang quá tải, không chỉ ai có mặt.
  const openCounts = await prisma.task.groupBy({
    by: ['userId'],
    where: { taskWorkspaceId: workspaceId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] } },
    _count: { _all: true },
  })
  const byUser = new Map(openCounts.map((r) => [r.userId, r._count._all]))

  return {
    workspace: me.workspace,
    myRole: me.role,
    members: members.map((m) => ({
      ...m,
      openTasks: byUser.get(m.user.userId) || 0,
    })),
  }
}

/** Tham gia một nhóm bằng mã mời (chủ nhóm chia sẻ mã này). */
export async function joinByCode(userId, code) {
  const clean = String(code || '').trim().toUpperCase()
  if (!clean) throw ApiError.badRequest('Nhập mã mời nhóm (dạng MN-XXXXXX)')

  const ws = await prisma.workspace.findUnique({
    where: { inviteCode: clean },
    include: { _count: { select: { members: true } } },
  })
  if (!ws) throw ApiError.notFound('Mã mời không đúng hoặc đã bị đổi. Hỏi lại chủ nhóm nhé.')
  if (ws.type !== 'TEAM') throw ApiError.badRequest('Mã này không phải mã mời nhóm làm việc')
  if (ws.ownerId === userId) throw ApiError.badRequest('Bạn là chủ nhóm này rồi')

  const existing = await prisma.workspaceMember.findFirst({ where: { workspaceId: ws.workspaceId, userId } })
  if (existing) throw ApiError.badRequest('Bạn đã ở trong nhóm này rồi')

  // Hạn mức chỗ ngồi theo gói của CHỦ nhóm (chốt thiết kế: gói theo ngữ cảnh)
  const ownerPlan = await getUserPlan(ws.ownerId)
  const maxMembers = limitOf(ownerPlan, 'membersPerWorkspace')
  if (ws._count.members >= maxMembers) {
    throw ApiError.badRequest(
      `Nhóm đã đủ ${maxMembers + 1} thành viên theo gói của chủ nhóm. Nhờ chủ nhóm nâng cấp gói để thêm người.`
    )
  }

  const member = await prisma.workspaceMember.create({
    data: { workspaceId: ws.workspaceId, userId, role: 'MEMBER' },
    select: MEMBER_SELECT,
  })
  return { workspace: ws, member }
}

/** Tạo lại mã mời (chủ nhóm) — mã cũ hết hiệu lực ngay. */
export async function regenerateInvite(userId, workspaceId) {
  const ws = await prisma.workspace.findUnique({ where: { workspaceId } })
  if (!ws) throw ApiError.notFound('Không tìm thấy không gian')
  if (ws.ownerId !== userId) throw ApiError.forbidden('Chỉ chủ nhóm mới tạo lại được mã mời')
  if (ws.type !== 'TEAM') throw ApiError.badRequest('Chỉ nhóm làm việc mới có mã mời')

  // Vòng thử chống đụng mã (xác suất thấp nhưng phải chắc chắn)
  for (let i = 0; i < 5; i += 1) {
    const code = generateWorkspaceCode()
    const taken = await prisma.workspace.findUnique({ where: { inviteCode: code } })
    if (taken) continue
    return prisma.workspace.update({ where: { workspaceId }, data: { inviteCode: code } })
  }
  throw ApiError.badRequest('Không tạo được mã mời mới, thử lại sau')
}

/** Gỡ một thành viên khỏi nhóm (chủ nhóm). */
export async function removeMember(userId, workspaceId, memberUserId) {
  const ws = await prisma.workspace.findUnique({ where: { workspaceId } })
  if (!ws) throw ApiError.notFound('Không tìm thấy không gian')
  if (ws.ownerId !== userId) throw ApiError.forbidden('Chỉ chủ nhóm mới gỡ được thành viên')
  if (Number(memberUserId) === ws.ownerId) {
    throw ApiError.badRequest('Không gỡ được chủ nhóm — hãy xoá cả không gian nếu muốn đóng nhóm')
  }

  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId: Number(memberUserId) } })
  if (!member) throw ApiError.notFound('Người này không ở trong nhóm')

  // Việc đang giao cho người bị gỡ vẫn nằm trong nhóm (để chủ nhóm giao lại),
  // nhưng lời giao cũ không còn ý nghĩa → gỡ luôn lượt giao của họ trong nhóm này.
  await prisma.$transaction(async (tx) => {
    const taskIds = (
      await tx.task.findMany({ where: { taskWorkspaceId: workspaceId }, select: { taskId: true } })
    ).map((t) => t.taskId)
    if (taskIds.length) {
      await tx.taskShare.deleteMany({ where: { assigneeId: Number(memberUserId), taskId: { in: taskIds } } })
    }
    await tx.workspaceMember.delete({ where: { workspaceMemberId: member.workspaceMemberId } })
  })
  return { removed: Number(memberUserId) }
}

/** ID không gian user có quyền tiếp cận — dùng cho lọc API cũ (Task, lịch…). */
export async function accessibleWorkspaceIds(userId) {
  const rows = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  })
  return rows.map((r) => r.workspaceId)
}

export default {
  WORKSPACE_LIMITS,
  workspacePlan,
  ensureDefaultWorkspace,
  listMine,
  create,
  setDefault,
  rename,
  leaveOrDelete,
  listMembers,
  joinByCode,
  regenerateInvite,
  removeMember,
  accessibleWorkspaceIds,
}
