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
import { PageLoader, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import Avatar from '../../components/common/Avatar'
import { Field, Input } from '../../components/common/Inputs'

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
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800">
        <Crown size={12} weight="fill" /> Chủ nhóm
      </span>
    )
  }
  if (role === 'ADMIN') {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-extrabold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        Quản trị
      </span>
    )
  }
  return (
    <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-bold text-navy-500 dark:bg-slate-700 dark:text-slate-300">
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

  if (loading) return <PageLoader />

  // Đang ở chế độ Cá nhân/Lớp học: nhóm làm việc chỉ có trong không gian TEAM
  if (!isTeam) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-navy-900 dark:text-white">
            <UsersThree size={24} weight="fill" className="text-violet-600 dark:text-violet-400" />
            Nhóm làm việc
          </h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-slate-400">
            Chọn hoặc tạo một nhóm ở khối “Chế độ làm việc” bên trái để quản lý thành viên và giao việc.
          </p>
        </div>
        <EmptyState
          icon={UsersThree}
          title="Bạn đang ở chế độ khác"
          description="Nhóm làm việc là một chế độ riêng: mỗi nhóm có thành viên, mã mời và công việc của riêng nó."
          className="py-14"
        />
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
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-navy-900 dark:text-white">
            <UsersThree size={24} weight="fill" className="text-violet-600 dark:text-violet-400" />
            {workspace.name}
          </h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-slate-400">
            {members.length} thành viên · mọi người trong nhóm cùng thấy công việc của nhóm và
            nhận chuông nhắc việc được giao cho mình.
          </p>
        </div>
        <Link to="/app/tasks">
          <Button variant="secondary" icon={ListChecks}>
            Công việc của nhóm
          </Button>
        </Link>
      </div>

      {/* Mã mời: đường duy nhất để thêm người vào nhóm */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-5 text-white shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Mã mời nhóm</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="select-all font-mono text-3xl font-extrabold tracking-[0.18em]">
            {inviteCode || '—'}
          </span>
          {inviteCode && (
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-inset ring-white/25 transition hover:bg-white/25"
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-inset ring-white/20 transition hover:bg-white/20 disabled:opacity-60"
            >
              <ArrowsClockwise size={14} weight="bold" /> Tạo mã mới
            </button>
          )}
        </div>
        <p className="mt-3 text-xs font-semibold text-white/80">
          Gửi mã này cho đồng nghiệp — họ bấm “Tham gia nhóm bằng mã” bên dưới là vào cùng không
          gian, thấy chung công việc của nhóm.
        </p>
      </div>

      {/* Tham gia nhóm khác bằng mã (ai cũng dùng được) */}
      <form onSubmit={onJoin} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
        <Field label="Tham gia nhóm bằng mã" hint="Nhập mã MN-XXXXXX mà chủ nhóm gửi cho bạn">
          <div className="flex gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="MN-XXXXXX"
              className="font-mono uppercase tracking-widest"
              maxLength={16}
            />
            <Button type="submit" icon={UserPlus} loading={busy} disabled={!joinCode.trim()}>
              Vào nhóm
            </Button>
          </div>
        </Field>
      </form>

      {/* Thành viên */}
      <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
        <p className="mb-3 text-sm font-extrabold text-navy-900 dark:text-white">Thành viên nhóm</p>
        <ul className="divide-y divide-navy-100 dark:divide-slate-700">
          {members.map((m) => {
            const isMe = Number(m.user.userId) === Number(myId)
            return (
              <li key={m.workspaceMemberId} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.user.fullName} src={m.user.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy-900 dark:text-white">
                    {m.user.fullName}
                    {isMe && <span className="ml-1.5 text-xs font-bold text-navy-400 dark:text-slate-500">(bạn)</span>}
                  </p>
                  <p className="truncate text-xs text-navy-500 dark:text-slate-400">{m.user.email}</p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-bold text-navy-500 sm:inline dark:bg-slate-700 dark:text-slate-300">
                  {m.openTasks} việc đang mở
                </span>
                <RoleBadge role={m.role} />
                {isOwner && !isMe && m.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() => onRemove(m)}
                    disabled={busy}
                    title={`Gỡ ${m.user.fullName} khỏi nhóm`}
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/30"
                  >
                    <Trash size={16} weight="bold" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {!inviteCode && (
          <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Warning size={14} weight="fill" className="mt-0.5 shrink-0" />
            Nhóm chưa có mã mời — bấm “Tạo mã mới” để mời người khác vào.
          </p>
        )}
      </div>

      <p className="text-center text-xs text-navy-400 dark:text-slate-500">
        Giao việc: ở chế độ này, khi tạo công việc bạn chọn được người phụ trách trong nhóm. Việc
        của nhóm hiện ở trang Công việc; người được giao thấy nó ở mục Việc được giao.
      </p>
    </div>
  )
}
