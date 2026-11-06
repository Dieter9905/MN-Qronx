import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UsersThree,
  Copy,
  Check,
  ArrowsClockwise,
  UserPlus,
  Trash,
  Crown,
  ListChecks,
  Warning,
} from '@phosphor-icons/react'
import {
  getMembers,
  joinWorkspace,
  regenerateInvite,
  removeMember,
} from '../../services/workspaceService'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import Avatar from '../../components/common/Avatar'
import { RoomButton, RoomCard, RoomEmpty, RoomField, RoomInput, RoomSkeleton } from '../../components/common/RoomUI'

// ─── Nhóm làm việc (chế độ TEAM) ─────────────────────────────────────────
//
// Trang này trả lời đúng một câu hỏi của chủ nhóm: "ai đang ở trong nhóm, và
// làm sao kéo thêm người vào?". Việc phân công nằm ở trang Công việc (tạo việc
// trong chế độ này là chọn được người phụ trách) — cố ý không dựng thêm một
// bảng kanban nữa để nhóm không phải học hai chỗ nhập việc.
//
// Mời bằng MÃ (MN-XXXXXX) chứ không phải email từng người: đồng nghiệp có thể
// chưa có tài khoản, và chủ nhóm không phải nhớ email của cả nhóm.

function RoleBadge({ role }) {
  if (role === 'OWNER') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-room-bell/25 px-2 py-0.5 text-[11px] font-extrabold text-room-ink/75 ring-1 ring-inset ring-room-bell/40">
        <Crown size={12} weight="fill" className="text-room-bell" /> Chủ nhóm
      </span>
    )
  }
  if (role === 'ADMIN') {
    return (
      <span className="rounded-full bg-room-oat/60 px-2 py-0.5 text-[11px] font-extrabold text-room-ink/60">
        Quản trị
      </span>
    )
  }
  return (
    <span className="rounded-full bg-room-oat/40 px-2 py-0.5 text-[11px] font-bold text-room-ink/50">
      Thành viên
    </span>
  )
}

export default function TeamPage() {
  const { user } = useAuth()
  const { active, reload: reloadWorkspaces } = useWorkspace()
  const toast = useToast()
  const myId = user?.id ?? user?.userId
  const workspace = active?.workspace || null
  const isTeam = workspace?.type === 'TEAM'

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    if (!workspace?.workspaceId || !isTeam) {
      setLoading(false)
      return
    }
    const res = await getMembers(workspace.workspaceId)
    if (!res.success) {
      toast.error(res.message)
      setLoading(false)
      return
    }
    setData(res.data)
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.workspaceId, isTeam])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <RoomSkeleton className="h-8 w-64" />
            <RoomSkeleton className="h-5 w-80" />
          </div>
          <RoomSkeleton className="h-10 w-44 rounded-full" />
        </div>
        <RoomSkeleton className="h-36" />
        <RoomSkeleton className="h-24" />
      </div>
    )
  }

  // Đang ở chế độ Cá nhân/Lớp học: nhóm làm việc chỉ có trong không gian TEAM
  if (!isTeam) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-room-ink">
            <UsersThree size={26} weight="duotone" className="text-room-acorn" />
            Nhóm làm việc
          </h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/50">
            Chọn hoặc tạo một nhóm ở khối “Chế độ làm việc” bên trái để quản lý thành viên và giao việc.
          </p>
        </div>
        <RoomCard className="p-6">
          <RoomEmpty
            icon={UsersThree}
            title="Bạn đang ở chế độ khác"
            description="Nhóm làm việc là một chế độ riêng: mỗi nhóm có thành viên, mã mời và công việc của riêng nó."
            className="py-10"
          />
        </RoomCard>
      </div>
    )
  }

  const members = data?.members || []
  const inviteCode = data?.workspace?.inviteCode || ''
  const myRole = data?.myRole
  const isOwner = workspace?.ownerId === myId || myRole === 'OWNER'

  const copyCode = async () => {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Trình duyệt không cho chép — bạn chép tay mã này nhé')
    }
  }

  const onRegenerate = async () => {
    if (!window.confirm('Tạo mã mời mới? Mã cũ sẽ hết hiệu lực ngay.')) return
    setBusy(true)
    const res = await regenerateInvite(workspace.workspaceId)
    setBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    load()
  }

  const onJoin = async (e) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setBusy(true)
    const res = await joinWorkspace(joinCode.trim().toUpperCase())
    setBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    setJoinCode('')
    // Về lại không gian mới tham gia rồi tải danh sách thành viên
    const list = await reloadWorkspaces()
    const joined = list.find((w) => w.workspace.workspaceId === res.data?.workspace?.workspaceId)
    if (joined) {
      setLoading(true)
      setTimeout(load, 0)
    }
  }

  const onRemove = async (member) => {
    const name = member.user?.fullName || 'thành viên này'
    if (!window.confirm(`Gỡ ${name} khỏi nhóm? Việc đang giao cho họ sẽ không còn ở trang Việc được giao của họ.`)) return
    setBusy(true)
    const res = await removeMember(workspace.workspaceId, member.user.userId)
    setBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    load()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-room-ink">
            <UsersThree size={26} weight="duotone" className="text-room-acorn" />
            {workspace.name}
          </h1>
          <p className="mt-1 text-sm font-semibold text-room-ink/50">
            {members.length} thành viên · mọi người trong nhóm cùng thấy công việc của nhóm và
            nhận chuông nhắc việc được giao cho mình.
          </p>
        </div>
        <Link to="/app/tasks">
          <RoomButton variant="secondary" icon={ListChecks}>
            Công việc của nhóm
          </RoomButton>
        </Link>
      </div>

      {/* Mã mời: đường duy nhất để thêm người vào nhóm */}
      <RoomCard className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-room-ink/50">Mã mời nhóm</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="select-all font-mono text-3xl font-extrabold tracking-[0.18em] text-room-ink">
            {inviteCode || '—'}
          </span>
          {inviteCode && (
            <button
              type="button"
              onClick={copyCode}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-room-ink/75 ring-1 ring-inset transition ${
                copied ? 'bg-room-sage/45 ring-room-acorn/25' : 'bg-room-oat/60 ring-room-acorn/25 hover:bg-room-oat/75'
              }`}
            >
              {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
              {copied ? 'Đã chép' : 'Chép mã'}
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-room-oat/45 px-3 py-1.5 text-xs font-bold text-room-ink/70 ring-1 ring-inset ring-room-acorn/15 transition hover:bg-room-oat/60 disabled:opacity-60"
            >
              <ArrowsClockwise size={14} weight="bold" /> Tạo mã mới
            </button>
          )}
        </div>
        <p className="mt-3 text-xs font-semibold text-room-ink/55">
          Gửi mã này cho đồng nghiệp — họ bấm “Tham gia nhóm bằng mã” bên dưới là vào cùng không
          gian, thấy chung công việc của nhóm.
        </p>
      </RoomCard>

      {/* Tham gia nhóm khác bằng mã (ai cũng dùng được) */}
      <form onSubmit={onJoin} className="rounded-2xl bg-room-paper p-4 ring-1 ring-room-acorn/25">
        <RoomField label="Tham gia nhóm bằng mã" hint="Nhập mã MN-XXXXXX mà chủ nhóm gửi cho bạn">
          <div className="flex gap-2">
            <RoomInput
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="MN-XXXXXX"
              className="font-mono uppercase tracking-widest"
              maxLength={16}
            />
            <RoomButton type="submit" icon={UserPlus} loading={busy} disabled={!joinCode.trim()} className="shrink-0">
              Vào nhóm
            </RoomButton>
          </div>
        </RoomField>
      </form>

      {/* Thành viên */}
      <RoomCard className="p-4">
        <p className="mb-3 font-display text-sm font-bold text-room-ink">Thành viên nhóm</p>
        <ul className="divide-y divide-room-acorn/15">
          {members.map((m) => {
            const isMe = Number(m.user.userId) === Number(myId)
            return (
              <li key={m.workspaceMemberId} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.user.fullName} src={m.user.avatarUrl} size="sm" skin="room" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-room-ink/90">
                    {m.user.fullName}
                    {isMe && <span className="ml-1.5 text-xs font-bold text-room-ink/40">(bạn)</span>}
                  </p>
                  <p className="truncate text-xs font-semibold text-room-ink/45">{m.user.email}</p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-room-oat/50 px-2 py-0.5 text-[11px] font-bold text-room-ink/55 sm:inline">
                  {m.openTasks} việc đang mở
                </span>
                <RoleBadge role={m.role} />
                {isOwner && !isMe && m.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() => onRemove(m)}
                    disabled={busy}
                    title={`Gỡ ${m.user.fullName} khỏi nhóm`}
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-room-ink/35 transition hover:bg-room-rain/40 hover:text-room-ink disabled:opacity-50"
                  >
                    <Trash size={16} weight="bold" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {!inviteCode && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-room-bell/25 p-2.5 text-xs font-semibold text-room-ink/80 ring-1 ring-inset ring-room-bell/40">
            <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-room-bell" />
            Nhóm chưa có mã mời — bấm “Tạo mã mới” để mời người khác vào.
          </p>
        )}
      </RoomCard>

      <p className="text-center text-xs font-semibold text-room-ink/40">
        Giao việc: ở chế độ này, khi tạo công việc bạn chọn được người phụ trách trong nhóm. Việc
        của nhóm hiện ở trang Công việc; người được giao thấy nó ở mục Việc được giao.
      </p>
    </div>
  )
}
