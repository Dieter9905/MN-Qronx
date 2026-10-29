import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  UsersThree,
  CaretLeft,
  CaretRight,
  Check,
  MagnifyingGlass,
  UserPlus,
  Warning,
} from '@phosphor-icons/react'
import { getAllTasks, setTaskStatus, setTaskAssignee } from '../../services/taskService'
import { getMembers } from '../../services/workspaceService'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { PageLoader, EmptyState } from '../../components/common/Feedback'
import Avatar from '../../components/common/Avatar'
import { PRIORITY } from '../../lib/constants'
import { formatRelativeDay } from '../../lib/format'

// ─── Bảng công việc của Nhóm (Jira-lite) ────────────────────────────────
//
// Ba cột Cần làm / Đang làm / Hoàn thành, kéo thẻ là đổi trạng thái — đúng thao
// tác quen thuộc của Jira nên cả nhóm không phải học chỗ mới. Khác trang
// "Công việc" (danh sách lọc/sắp xếp): bảng này trả lời "cả nhóm đang ở đâu",
// nên nó chỉ có trong không gian TEAM và luôn hiện việc của MỌI người.
//
// Người phụ trách chọn ngay trên thẻ (một người, như Jira): chủ việc giao, ai
// vào xem cũng thấy mình đang bị chờ. Việc chưa giao nằm ở cột trái để thành
// viên tự nhận — bấm "Nhận việc" là gán cho chính mình.

const COLUMNS = [
  {
    key: 'TODO',
    label: 'Cần làm',
    accent: 'border-t-slate-400 dark:border-t-slate-500',
    dot: 'bg-slate-400',
  },
  {
    key: 'IN_PROGRESS',
    label: 'Đang làm',
    accent: 'border-t-blue-500',
    dot: 'bg-blue-500',
  },
  {
    key: 'COMPLETED',
    label: 'Hoàn thành',
    accent: 'border-t-emerald-500',
    dot: 'bg-emerald-500',
  },
]

const SCOPES = [
  { key: 'all', label: 'Cả nhóm' },
  { key: 'mine', label: 'Của tôi' },
  { key: 'unassigned', label: 'Chưa giao' },
]

function assigneeOf(task) {
  return task.assignees?.[0]?.assignee || null
}

function cardTotal(list) {
  return list.length
}

/** Hình minh hoạ nhỏ cho cột trống — cột trống không nên là một ô trắng câm. */
function EmptyColumnArt({ tone = 'slate' }) {
  const tones = {
    slate: '#cbd5e1',
    blue: '#93c5fd',
    emerald: '#6ee7b7',
  }
  const color = tones[tone] || tones.slate
  return (
    <svg viewBox="0 0 96 56" className="h-14 w-24 opacity-80" aria-hidden="true">
      <ellipse cx="48" cy="50" rx="30" ry="3.5" fill={color} opacity="0.25" />
      <rect x="14" y="24" width="20" height="24" rx="4" fill={color} opacity="0.35" />
      <rect x="38" y="14" width="20" height="34" rx="4" fill={color} opacity="0.55" />
      <rect x="62" y="20" width="20" height="28" rx="4" fill={color} opacity="0.35" />
      <rect x="18" y="28" width="12" height="2.5" rx="1.25" fill="#fff" opacity="0.9" />
      <rect x="42" y="18" width="12" height="2.5" rx="1.25" fill="#fff" opacity="0.9" />
      <rect x="42" y="24" width="8" height="2.5" rx="1.25" fill="#fff" opacity="0.6" />
      <rect x="66" y="24" width="12" height="2.5" rx="1.25" fill="#fff" opacity="0.9" />
    </svg>
  )
}

export default function BoardPage() {
  const { user } = useAuth()
  const { active } = useWorkspace()
  const toast = useToast()
  const workspace = active?.workspace || null
  const isTeam = workspace?.type === 'TEAM'
  const myId = Number(user?.id ?? user?.userId)

  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [scope, setScope] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  const workspaceId = workspace?.workspaceId ?? null

  const refresh = async () => {
    if (!isTeam || !workspaceId) return
    const [taskRes, memberRes] = await Promise.all([
      getAllTasks({ sort: 'dueAsc' }),
      getMembers(workspaceId),
    ])
    if (!taskRes.success) toast.error(taskRes.message)
    else setTasks((taskRes.data?.items || []).filter((t) => t.status !== 'CANCELLED'))
    if (memberRes.success) setMembers(memberRes.data?.members || [])
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!isTeam || !workspaceId) {
        setLoading(false)
        return
      }
      setLoading(true)
      await refresh()
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeam, workspaceId])

  // Gán / đổi người phụ trách — cập nhật tại chỗ trước cho thẻ không nhảy,
  // rồi đồng bộ lại theo máy chủ; lỗi thì trả về trạng thái cũ.
  const onAssign = async (task, memberUserId) => {
    setBusyId(task.id)
    const previous = task.assignees
    const member = members.find((m) => Number(m.user?.userId) === Number(memberUserId))
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              assignees: member
                ? [{ assignee: { id: memberUserId, fullName: member.user.fullName, avatarUrl: member.user.avatarUrl || null } }]
                : [],
            }
          : t,
      ),
    )
    const res = await setTaskAssignee(task.id, memberUserId || null)
    setBusyId(null)
    if (!res.success) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, assignees: previous } : t)))
      toast.error(res.message)
      return
    }
    toast.success(memberUserId ? `Đã giao cho ${member?.user?.fullName || 'thành viên'}` : 'Đã bỏ người phụ trách')
  }

  // Đổi cột. Hoàn thành đi qua đúng luồng complete() của máy chủ để việc lặp
  // sinh kỳ kế tiếp và nhắc nhở cũ được huỷ — không tự set status ở trình duyệt.
  const onMove = async (task, nextStatus) => {
    if (task.status === nextStatus) return
    setBusyId(task.id)
    const previous = task.status
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nextStatus,
              completedAt: nextStatus === 'COMPLETED' ? new Date().toISOString() : null,
            }
          : t,
      ),
    )
    const res = await setTaskStatus(task.id, nextStatus)
    setBusyId(null)
    if (!res.success) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: previous } : t)))
      toast.error(res.message)
      return
    }
    if (res.data?.nextTask || (nextStatus === 'COMPLETED' && previous !== 'COMPLETED')) {
      // Việc lặp sinh kỳ kế tiếp ở máy chủ → tải lại để kỳ mới có mặt ngay trên
      // bảng, không bắt người dùng F5 mới thấy.
      await refresh()
      toast.success('Đã hoàn thành')
      return
    }
    toast.success(
      nextStatus === 'COMPLETED'
        ? 'Đã hoàn thành'
        : nextStatus === 'IN_PROGRESS'
          ? 'Đã chuyển sang Đang làm'
          : 'Đã trả về Cần làm',
    )
  }

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return tasks.filter((t) => {
      if (kw && !t.title.toLowerCase().includes(kw)) return false
      const assignee = assigneeOf(t)
      if (scope === 'mine') return Number(assignee?.id) === myId
      if (scope === 'unassigned') return !assignee
      return true
    })
  }, [tasks, keyword, scope, myId])

  const byColumn = useMemo(() => {
    const map = { TODO: [], IN_PROGRESS: [], COMPLETED: [] }
    for (const t of filtered) {
      if (map[t.status]) map[t.status].push(t)
    }
    // Hoàn thành: mới xong lên đầu — việc cũ đã xong không cần chiếm chỗ.
    map.COMPLETED.sort((a, b) => new Date(b.completedAt || b.dueAt) - new Date(a.completedAt || a.dueAt))
    return map
  }, [filtered])

  if (loading) return <PageLoader />

  if (!isTeam) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-navy-900 dark:text-white">
            <UsersThree size={24} weight="fill" className="text-violet-600 dark:text-violet-400" />
            Bảng công việc
          </h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-slate-400">
            Bảng kéo-thả là nơi làm việc của cả nhóm — chỉ mở trong chế độ Nhóm làm việc.
          </p>
        </div>
        <EmptyState
          icon={UsersThree}
          title="Đang ở chế độ khác"
          description="Chọn một nhóm ở khối “Chế độ làm việc” bên trái, hoặc tạo nhóm mới, để dùng bảng công việc."
          className="py-14"
        />
      </div>
    )
  }

  const openCount = tasks.filter((t) => t.status !== 'COMPLETED').length
  const overdueCount = tasks.filter((t) => t.status !== 'COMPLETED' && t.overdue).length

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Khối đầu trang: nền chuyển sắc + số liệu nhanh của nhóm. Bảng công việc
          là nơi cả nhóm nhìn chung, nên câu trả lời "hôm nay nhóm đang ở đâu"
          phải thấy ngay trước khi kéo thẻ. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-5 text-white shadow-glow-purple">
        <span className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/20 blur-2xl" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-cyan-300/25 blur-2xl" aria-hidden="true" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Nhóm làm việc</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <UsersThree size={24} weight="fill" className="text-cyan-200" />
              {workspace.name}
            </h1>
            <p className="mt-1 max-w-xl text-sm font-medium text-white/85">
              Bảng công việc — kéo thẻ đổi cột, chọn người phụ trách ngay trên thẻ.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-inset ring-white/25">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-200" aria-hidden="true" />
                {byColumn.TODO.length} cần làm
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-inset ring-white/25">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" aria-hidden="true" />
                {byColumn.IN_PROGRESS.length} đang làm
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-inset ring-white/25">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                {byColumn.COMPLETED.length} xong
              </span>
              {overdueCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/90 px-3 py-1 text-xs font-bold ring-1 ring-inset ring-white/30">
                  <Warning size={12} weight="fill" />
                  {overdueCount} quá hạn
                </span>
              )}
              <span className="text-xs font-semibold text-white/70">· {openCount} việc đang mở</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Ai đang ở trong nhóm — nhìn là biết còn ai rảnh để giao */}
            <div className="hidden items-center -space-x-2 sm:flex">
              {members.slice(0, 5).map((m) => (
                <Avatar
                  key={m.user?.userId}
                  name={m.user?.fullName}
                  src={m.user?.avatarUrl || ''}
                  size="sm"
                  className="ring-2 ring-white/90"
                />
              ))}
              {members.length > 5 && (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold text-white ring-2 ring-white/80">
                  +{members.length - 5}
                </span>
              )}
            </div>
            <Link
              to="/app/tasks/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Plus size={16} weight="bold" />
              Tạo việc
            </Link>
          </div>
        </div>
      </div>

      {/* Lọc theo người + tìm nhanh — không đổi trang, chỉ thu hẹp thẻ trên bảng */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-navy-50 p-1 ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={[
                'cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition',
                scope === s.key
                  ? 'bg-white text-navy-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-navy-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-white',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 dark:text-slate-500"
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm việc trong nhóm…"
            className="w-full rounded-xl border border-navy-100 bg-white py-2 pl-9 pr-3 text-sm text-navy-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-900/40"
          />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = byColumn[col.key] || []
          const isOver = dragOverColumn === col.key
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragOverColumn !== col.key) setDragOverColumn(col.key)
              }}
              onDragLeave={() => setDragOverColumn((prev) => (prev === col.key ? null : prev))}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverColumn(null)
                const id = Number(e.dataTransfer.getData('text/plain') || draggingId)
                const task = tasks.find((t) => Number(t.id) === id)
                setDraggingId(null)
                if (task) onMove(task, col.key)
              }}
              className={[
                'flex min-h-[26rem] flex-col rounded-2xl border-t-4 bg-navy-50/60 p-3 ring-1 transition dark:bg-slate-800/40',
                col.accent,
                isOver
                  ? 'ring-2 ring-blue-400 dark:ring-blue-500'
                  : 'ring-navy-100 dark:ring-slate-700',
              ].join(' ')}
              aria-label={`Cột ${col.label}`}
            >
              <header className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} aria-hidden="true" />
                  <h2 className="text-sm font-extrabold text-navy-800 dark:text-slate-100">{col.label}</h2>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-navy-500 ring-1 ring-navy-100 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600">
                  {cardTotal(list)}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {list.map((task) => {
                  const assignee = assigneeOf(task)
                  const priority = PRIORITY[task.priority] || PRIORITY.MEDIUM
                  const overdue = task.overdue && task.status !== 'COMPLETED'
                  const columnIndex = COLUMNS.findIndex((c) => c.key === col.key)
                  const prev = COLUMNS[columnIndex - 1]
                  const next = COLUMNS[columnIndex + 1]
                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(task.id))
                        e.dataTransfer.effectAllowed = 'move'
                        setDraggingId(task.id)
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={[
                        'group cursor-grab rounded-xl bg-white p-3 shadow-sm ring-1 ring-navy-100 transition active:cursor-grabbing dark:bg-slate-900 dark:ring-slate-700',
                        draggingId === task.id ? 'opacity-50' : 'hover:-translate-y-0.5 hover:shadow-md',
                        busyId === task.id ? 'animate-pulse' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/app/tasks/${task.id}`}
                          className="line-clamp-2 text-sm font-bold text-navy-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                        >
                          {task.title}
                        </Link>
                        {assignee ? (
                          <Avatar
                            name={assignee.fullName}
                            src={assignee.avatarUrl || ''}
                            size="sm"
                            className="!h-6 !w-6 text-[10px]"
                          />
                        ) : (
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy-100 text-navy-400 dark:bg-slate-700 dark:text-slate-400"
                            title="Chưa giao cho ai"
                          >
                            <UserPlus size={13} />
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold text-navy-600 ring-1 ring-navy-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                          <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} aria-hidden="true" />
                          {priority.label}
                        </span>
                        {task.dueAt && (
                          <span
                            className={[
                              'rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1',
                              overdue
                                ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800'
                                : 'bg-white text-navy-500 ring-navy-100 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
                            ].join(' ')}
                          >
                            {formatRelativeDay(task.dueAt)}
                          </span>
                        )}
                      </div>

                      {/* Chọn người phụ trách ngay trên thẻ (một người, như Jira) */}
                      <div className="mt-2 flex items-center gap-1">
                        <select
                          value={assignee ? Number(assignee.id) : ''}
                          disabled={busyId === task.id}
                          onChange={(e) => onAssign(task, e.target.value ? Number(e.target.value) : null)}
                          onDragStart={(e) => e.preventDefault()}
                          className="min-w-0 flex-1 cursor-pointer truncate rounded-lg border border-transparent bg-transparent px-1 py-1 text-[11px] font-semibold text-navy-500 outline-none transition hover:border-navy-200 hover:bg-navy-50 focus:border-blue-300 focus:bg-white dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
                          aria-label={`Người phụ trách của ${task.title}`}
                        >
                          <option value="">Chưa giao — ai nhận cũng được</option>
                          {members.map((m) => (
                            <option key={m.user?.userId} value={m.user?.userId}>
                              {m.user?.fullName}
                              {Number(m.user?.userId) === myId ? ' (tôi)' : ''}
                            </option>
                          ))}
                        </select>

                        {/* Nút chuyển cột cho thiết bị cảm ứng / bàn phím: kéo-thả không
                            dùng được trên điện thoại, đừng bắt người dùng chờ máy tính. */}
                        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          {prev && (
                            <button
                              type="button"
                              onClick={() => onMove(task, prev.key)}
                              disabled={busyId === task.id}
                              title={`Chuyển về ${prev.label}`}
                              className="cursor-pointer rounded-md p-1 text-navy-400 hover:bg-navy-100 hover:text-navy-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-white"
                            >
                              <CaretLeft size={12} weight="bold" />
                            </button>
                          )}
                          {next && (
                            <button
                              type="button"
                              onClick={() => onMove(task, next.key)}
                              disabled={busyId === task.id}
                              title={next.key === 'COMPLETED' ? 'Đánh dấu hoàn thành' : `Chuyển sang ${next.label}`}
                              className="cursor-pointer rounded-md p-1 text-navy-400 hover:bg-navy-100 hover:text-navy-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-white"
                            >
                              {next.key === 'COMPLETED' ? (
                                <Check size={12} weight="bold" />
                              ) : (
                                <CaretRight size={12} weight="bold" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}

                {!list.length && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-navy-200 px-3 py-6 text-center dark:border-slate-600">
                    {col.key === 'COMPLETED' ? (
                      <EmptyColumnArt tone="emerald" />
                    ) : col.key === 'IN_PROGRESS' ? (
                      <EmptyColumnArt tone="blue" />
                    ) : (
                      <EmptyColumnArt tone="slate" />
                    )}
                    <p className="text-xs font-semibold text-navy-400 dark:text-slate-500">
                      {scope === 'mine'
                        ? 'Chưa có việc nào giao cho bạn ở cột này'
                        : scope === 'unassigned'
                          ? 'Mọi việc ở cột này đều đã có người phụ trách'
                          : 'Chưa có việc nào — kéo thẻ sang đây hoặc tạo việc mới'}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
