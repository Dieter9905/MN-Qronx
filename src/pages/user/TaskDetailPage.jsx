import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  DotsThree,
  PencilSimple,
  Trash,
  Prohibit,
  Check,
  CheckCircle,
  Clock,
  Bell,
  Plus,
  Repeat,
  X,
  CalendarCheck,
  ListChecks,
  Alarm,
  Users,
  LockSimple,
  PaperPlaneTilt,
  SealCheck,
  ArrowsClockwise,
  CircleNotch,
} from '@phosphor-icons/react'
import {
  getTask,
  completeTask,
  reopenTask,
  cancelTask,
  deleteTask,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  shareTask,
  revokeTaskShare,
  setTaskRotation,
} from '../../services/taskService'
import { useAuth } from '../../context/AuthContext'
import { addReminder, removeReminder } from '../../services/reminderService'
import { useToast } from '../../components/common/Toast'
import { RoomButton, RoomCard, RoomInput, RoomSelect, RoomToggle, RoomEmpty } from '../../components/common/RoomUI'
import { TASK_STATUS, OVERDUE_STATUS, PRIORITY, repeatSummary, isProPlan } from '../../lib/constants'
import { formatDateTime, formatRelativeDay, effectiveStatus, isOverdue } from '../../lib/format'
import { ConfirmDialog } from '../../components/common/Modal'

export default function TaskDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // { type, title, message, action }
  const [busy, setBusy] = useState(false)
  const [subtaskInput, setSubtaskInput] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  // Giao việc cho người khác (gói Pro)
  const { user } = useAuth()
  const isPro = isProPlan(user?.plan)
  const [shareEmail, setShareEmail] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [shareHint, setShareHint] = useState(null)
  const [rotationBusy, setRotationBusy] = useState(false)

  const load = async () => {
    const res = await getTask(id)
    if (!res.success) {
      toast.error(res.message)
      navigate('/app/tasks', { replace: true })
      return
    }
    setTask(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <span role="status" aria-label="Đang tải">
          <CircleNotch size={28} className="animate-spin text-room-acorn" weight="bold" />
        </span>
        <p className="text-sm font-semibold text-room-ink/60">Đang tải chi tiết công việc…</p>
      </div>
    )
  }
  if (!task) return null

  const status = effectiveStatus(task)
  const closed = task.status === 'COMPLETED' || task.status === 'CANCELLED'
  const completedSub = task.subtasks.filter((s) => s.isCompleted).length
  const late = status === 'OVERDUE'
  const statusInfo = late ? OVERDUE_STATUS : TASK_STATUS[task.status]
  const priorityInfo = PRIORITY[task.priority]

  const handleComplete = async () => {
    setBusy(true)
    const res = await completeTask(task.id)
    setBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.data.nextTask ? 'Đã hoàn thành – hệ thống đã tạo lần lặp kế tiếp' : 'Đã hoàn thành công việc')
    load()
  }

  const handleReopen = async () => {
    setBusy(true)
    const res = await reopenTask(task.id)
    setBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã mở lại công việc')
    load()
  }

  const runAction = async () => {
    if (!confirm) return
    setBusy(true)
    let res
    if (confirm.type === 'cancel') res = await cancelTask(task.id)
    else res = await deleteTask(task.id)
    setBusy(false)
    if (!res.success) {
      toast.error(res.message)
      setConfirm(null)
      return
    }
    toast.success(res.message)
    setConfirm(null)
    navigate('/app/tasks')
  }

  const onAddSubtask = async (e) => {
    e.preventDefault()
    if (!subtaskInput.trim()) return
    const res = await addSubtask(task.id, subtaskInput)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setSubtaskInput('')
    load()
  }

  const onToggleSub = async (sub) => {
    const res = await toggleSubtask(task.id, sub.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    load()
  }

  const onDeleteSub = async (sub) => {
    const res = await deleteSubtask(task.id, sub.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã xóa việc con')
    load()
  }

  const onAddReminder = async () => {
    if (!reminderTime) {
      toast.error('Vui lòng chọn thời điểm nhắc nhở')
      return
    }
    const remindAt = new Date(reminderTime).toISOString()
    const res = await addReminder(task.id, remindAt)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã thêm nhắc nhở')
    setReminderTime('')
    load()
  }

  const onDeleteReminder = async (reminder) => {
    const res = await removeReminder(task.id, reminder.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã xóa nhắc nhở')
    load()
  }

  // ── Giao việc cho người khác (Pro) ────────────────────────
  // Danh sách người được giao nằm ngay trong task (task.assignees) nên sau mỗi lần
  // giao/thu hồi chỉ cần load() lại — không có hai nguồn dữ liệu để lệch nhau.
  const assignees = task.assignees || []
  const doneCount = assignees.filter((s) => s.doneAt).length

  // ── Luân phiên người làm (Pro) ─────────────────────────────
  // Thứ tự lượt lấy từ máy chủ (order), KHÔNG sắp lại ở trình duyệt.
  const rotation = task.rotation || { enabled: false, turnAssigneeId: null, order: [] }
  const orderIds = rotation.order.length ? rotation.order : assignees.map((s) => s.assignee?.id)
  const turnName = assignees.find((s) => s.assignee?.id === rotation.turnAssigneeId)?.assignee?.fullName
  const turnIndex = orderIds.indexOf(rotation.turnAssigneeId)
  const nextTurnId =
    orderIds.length > 1 && turnIndex >= 0 ? orderIds[(turnIndex + 1) % orderIds.length] : null
  const nextTurnName = assignees.find((s) => s.assignee?.id === nextTurnId)?.assignee?.fullName

  const onShare = async (e) => {
    e.preventDefault()
    const email = shareEmail.trim()
    if (!email) {
      toast.error('Nhập email người bạn muốn nhờ')
      return
    }
    setShareBusy(true)
    const res = await shareTask(task.id, { email, note: shareNote.trim() || undefined })
    setShareBusy(false)
    if (!res.success) {
      // Chưa có tài khoản: giữ nguyên email đã gõ và nói rõ bước tiếp theo, thay vì
      // chỉ báo lỗi rồi bắt khách gõ lại từ đầu.
      if (res.errors?.needInvite) setShareHint(res.message)
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    setShareEmail('')
    setShareNote('')
    setShareHint(null)
    load()
  }

  const onRevokeShare = async (share) => {
    setShareBusy(true)
    const res = await revokeTaskShare(task.id, share.shareId)
    setShareBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã thu hồi việc đã giao')
    load()
  }

  // Bật/tắt luân phiên hoặc đổi người của kỳ này — cùng một đường API, và cả ba
  // việc đều phải vẽ lại từ dữ liệu máy chủ (nên luôn load() lại).
  const onRotation = async (payload) => {
    setRotationBusy(true)
    const res = await setTaskRotation(task.id, payload)
    setRotationBusy(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    load()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <Link to="/app/tasks" className="inline-flex items-center gap-1.5 text-sm font-bold text-room-ink/60 transition hover:text-room-acorn">
        <ArrowLeft size={16} weight="bold" /> Quay lại danh sách
      </Link>

      {/* Header */}
      <RoomCard className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* Da phòng: nhãn trạng thái/ưu tiên trên thẻ giấy — Blush cho đến hạn,
                  Rain chỉ là trung tính, Sage khi xong (mục đích cá nhân giữ đúng
                  dữ liệu TASK_STATUS/PRIORITY, không đụng điệu navy dùng chỗ khác) */}
              {late ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-room-blush/45 px-2.5 py-0.5 text-xs font-extrabold on-blush ring-1 ring-room-acorn/20 dark:bg-room-blush/30">
                  <Alarm size={12} weight="bold" /> {statusInfo.label}
                </span>
              ) : statusInfo && !closed ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold text-room-ink/45 bg-room-oat/60">
                  {statusInfo.label}
                </span>
              ) : task.status === 'COMPLETED' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-room-sage/45 px-2.5 py-0.5 text-xs font-extrabold text-room-ink">
                  <Check size={12} weight="bold" /> {statusInfo.label}
                </span>
              ) : null}
              {priorityInfo && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold text-room-ink/55 bg-room-oat/60">
                  <span className={`h-1.5 w-1.5 rounded-full ${priorityInfo.dot}`} aria-hidden="true" />
                  {priorityInfo.label}
                </span>
              )}
              {task.category && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-room-oat/60 px-2.5 py-0.5 text-xs font-bold text-room-ink/70">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.category.color }} aria-hidden="true" />
                  {task.category.name}
                </span>
              )}
            </div>
            <h1 className={`mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${task.status === 'COMPLETED' ? 'text-room-ink/45 line-through' : 'text-room-ink'}`}>
              {task.title}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-room-ink/60">
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck size={16} weight="bold" className="text-room-acorn" />
                {formatRelativeDay(task.dueAt)} · {formatDateTime(task.dueAt)}
              </span>
              {task.repeatType !== 'NONE' && (
                <span className="inline-flex items-center gap-1.5 text-room-ink/50">
                  <Repeat size={16} weight="bold" /> Lặp lại: {repeatSummary(task.repeatType, task.repeatDays)}
                </span>
              )}
              {task.nagEveryMinutes ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-room-bell">
                  <Alarm size={16} weight="bold" /> Nhắc dai mỗi {task.nagEveryMinutes} phút tới khi xong
                </span>
              ) : null}
            </p>
            {isOverdue(task) && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-room-blush/45 px-3 py-1 text-xs font-extrabold on-blush ring-1 ring-room-acorn/20 dark:bg-room-blush/30">
                <Clock size={13} weight="bold" /> Công việc đã quá hạn
              </p>
            )}
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Hành động công việc"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-room-ink/55 transition hover:bg-room-oat/70"
            >
              <DotsThree size={24} weight="bold" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl bg-room-paper py-1.5 ring-1 ring-room-acorn/25 animate-scale-in">
                <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); navigate(`/app/tasks/${task.id}/edit`) }} className="menu-item">
                  <PencilSimple size={17} weight="bold" /> Sửa công việc
                </button>
                {!closed && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => { setMenuOpen(false); setConfirm({ type: 'cancel', title: 'Hủy công việc', message: `Hủy công việc “${task.title}”? Các nhắc nhở chưa kích hoạt sẽ bị hủy.` }) }}
                    className="menu-item text-room-ink/80 hover:!text-room-bell"
                  >
                    <Prohibit size={17} weight="bold" /> Hủy công việc
                  </button>
                )}
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => { setMenuOpen(false); setConfirm({ type: 'delete', title: 'Xóa công việc', message: `Xóa công việc “${task.title}”? Hành động này không thể hoàn tác.`, danger: true }) }}
                  className="menu-item text-room-ink/80 hover:!text-room-acorn"
                >
                  <Trash size={17} weight="bold" /> Xóa công việc
                </button>
              </div>
            )}
          </div>
        </div>

        {task.description && (
          <div className="mt-5 rounded-xl bg-room-oat/45 p-4">
            <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-room-ink/85">{task.description}</p>
          </div>
        )}

        {/* Nút hoàn thành */}
        <div className="mt-6">
          {closed ? (
            <RoomButton variant="secondary" fullWidth size="lg" icon={Repeat} onClick={handleReopen} loading={busy}>
              Mở lại công việc
            </RoomButton>
          ) : (
            <RoomButton fullWidth size="lg" icon={CheckCircle} onClick={handleComplete} loading={busy}>
              Đánh dấu hoàn thành
            </RoomButton>
          )}
        </div>
      </RoomCard>

      {/* Việc con */}
      <RoomCard className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
          <ListChecks size={19} weight="fill" className="text-room-acorn" />
          Việc con
          {task.subtasks.length > 0 && (
            <span className="rounded-full bg-room-oat/70 px-2 py-0.5 text-xs font-bold text-room-ink/60">
              {completedSub}/{task.subtasks.length}
            </span>
          )}
        </h2>
        {task.subtasks.length > 0 && (
          <div className="mb-3 mt-1 h-1.5 overflow-hidden rounded-full bg-room-oat">
            <div
              className="h-full rounded-full bg-room-acorn transition-all duration-300"
              style={{ width: `${(completedSub / task.subtasks.length) * 100}%` }}
            />
          </div>
        )}
        <ul className="mt-3 space-y-1.5">
          {task.subtasks.map((sub) => (
            <li key={sub.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-room-oat/50">
              <button
                type="button"
                onClick={() => onToggleSub(sub)}
                aria-label={sub.isCompleted ? `Mở lại: ${sub.content}` : `Hoàn thành: ${sub.content}`}
                className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition ${
                  sub.isCompleted
                    ? 'border-room-sage bg-room-sage text-room-paper'
                    : 'border-room-acorn/50 text-transparent hover:border-room-acorn'
                }`}
              >
                <Check size={11} weight="bold" />
              </button>
              <p className={`flex-1 text-sm font-semibold ${sub.isCompleted ? 'text-room-ink/40 line-through' : 'text-room-ink/85'}`}>{sub.content}</p>
              <button
                type="button"
                onClick={() => onDeleteSub(sub)}
                aria-label={`Xóa việc con: ${sub.content}`}
                className="cursor-pointer rounded-md p-1.5 text-room-ink/30 opacity-0 transition hover:bg-room-oat/70 hover:text-room-acorn focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X size={15} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
        {!closed && (
          <form onSubmit={onAddSubtask} className="mt-3 flex gap-2">
            <RoomInput
              type="text"
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              placeholder="Thêm việc con, nhấn Enter…"
              aria-label="Thêm việc con"
              className="h-11 flex-1"
            />
            <RoomButton type="submit" variant="secondary" icon={Plus} size="icon" aria-label="Thêm việc con" />
          </form>
        )}
        {task.subtasks.length === 0 && !closed && (
          <p className="mt-2 text-xs font-semibold text-room-ink/50">Chia nhỏ công việc thành các bước để dễ hoàn thành hơn.</p>
        )}
      </RoomCard>

      {/* Nhắc nhở */}
      <RoomCard className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
          <Bell size={19} weight="fill" className="text-room-bell" />
          Nhắc nhở
          <span className="rounded-full bg-room-oat/70 px-2 py-0.5 text-xs font-bold text-room-ink/60">
            {task.reminders.filter((r) => r.status === 'SCHEDULED').length}/5
          </span>
        </h2>
        {task.reminders.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {task.reminders.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-room-oat/50 px-3.5 py-2.5">
                <Clock size={17} weight="bold" className="shrink-0 text-room-bell" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-room-ink/85">{formatDateTime(r.remindAt)}</p>
                  <p className="text-xs font-semibold text-room-ink/50">
                    {r.status === 'SCHEDULED' ? 'Sẽ báo thức đúng giờ' : r.status === 'CANCELLED' ? 'Đã bị hủy' : r.status === 'DISMISSED' ? 'Đã tắt' : 'Đã kích hoạt'}
                    {r.nagCount > 0 ? ` · đã nhắc lại ${r.nagCount} lần vì việc chưa xong` : ''}
                    {r.snoozeCount > 0 && ` · Đã hoãn ${r.snoozeCount} lần`}
                  </p>
                </div>
                {r.status === 'SCHEDULED' && (
                  <button
                    type="button"
                    onClick={() => onDeleteReminder(r)}
                    aria-label="Xóa nhắc nhở"
                    className="cursor-pointer rounded-md p-1.5 text-room-ink/30 transition hover:bg-room-oat/70 hover:text-room-acorn"
                  >
                    <Trash size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <RoomEmpty
            icon={Bell}
            title="Chưa có nhắc nhở"
            description="Thêm nhắc nhở để MN-Qronx báo thức bạn đúng giờ."
            className="py-8"
          />
        )}
        {!closed && task.reminders.filter((r) => r.status === 'SCHEDULED').length < 5 && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <RoomInput
              type="datetime-local"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              aria-label="Chọn thời điểm nhắc nhở"
              className="h-11 flex-1"
            />
            <RoomButton variant="secondary" icon={Plus} onClick={onAddReminder}>
              Thêm nhắc nhở
            </RoomButton>
          </div>
        )}
        {closed && <p className="mt-3 text-xs font-semibold text-room-ink/50">Công việc đã đóng – không thể thêm nhắc nhở mới.</p>}
      </RoomCard>

      {/* Nhờ người khác làm (Pro) */}
      <RoomCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <Users size={19} weight="fill" className="text-room-acorn" />
            Nhờ người khác làm
          </h2>
          <span className="rounded-full bg-room-oat/70 px-2 py-0.5 text-[11px] font-bold text-room-ink/70 ring-1 ring-room-acorn/30">
            PRO
          </span>
          {assignees.length > 0 && (
            <span className="rounded-full bg-room-oat/70 px-2 py-0.5 text-xs font-bold text-room-ink/60">
              {doneCount}/{assignees.length} đã xong
            </span>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold text-room-ink/55">
          Người bạn nhờ <strong>không cần trả phí</strong>. Họ vẫn nhận chuông nhắc như việc của
          chính mình, còn bạn nhận thông báo ngay khi họ báo xong.
        </p>

        {!isPro ? (
          <div className="mt-3 rounded-xl bg-room-oat/45 p-3 ring-1 ring-inset ring-room-acorn/15">
            <p className="flex items-start gap-2 text-xs font-semibold text-room-ink/70">
              <LockSimple size={15} className="mt-0.5 shrink-0" />
              <span>
                Gói hiện tại chỉ làm được việc của một mình bạn. Nâng cấp Pro để nhờ người thân
                hoặc đồng nghiệp làm — và biết ngay khi họ xong.{' '}
                <Link to="/app/billing" className="font-bold underline">
                  Nâng cấp Pro
                </Link>
              </span>
            </p>
          </div>
        ) : (
          <>
            {assignees.length > 0 && (
              <ul className="mt-3 space-y-2">
                {assignees.map((s) => (
                  <li
                    key={s.shareId}
                    className="flex items-center gap-3 rounded-xl bg-room-oat/50 px-3.5 py-2.5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-room-acorn/25 bg-room-paper">
                      {s.doneAt ? <SealCheck size={17} weight="bold" className="text-room-sage" /> : <Users size={17} weight="bold" className="text-room-ink/55" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-room-ink/85">
                        {s.assignee?.fullName || 'Người được giao'}
                      </p>
                      <p className="truncate text-xs font-semibold text-room-ink/50">
                        {s.doneAt
                          ? `Đã báo xong ${formatDateTime(s.doneAt)}`
                          : s.assignee?.email || 'Chưa báo xong'}
                        {s.note ? ` · “${s.note}”` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRevokeShare(s)}
                      disabled={shareBusy}
                      aria-label={`Thu hồi việc đã giao cho ${s.assignee?.fullName || ''}`}
                      className="cursor-pointer rounded-md p-1.5 text-room-ink/30 transition hover:bg-room-oat/70 hover:text-room-acorn disabled:opacity-50"
                    >
                      <X size={16} weight="bold" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!closed && assignees.length < 5 && (
              <form onSubmit={onShare} className="mt-4 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <RoomInput
                    type="email"
                    value={shareEmail}
                    onChange={(e) => {
                      setShareEmail(e.target.value)
                      setShareHint(null)
                    }}
                    placeholder="Email người bạn muốn nhờ…"
                    aria-label="Email người được giao việc"
                    className="h-11 flex-1"
                  />
                  <RoomInput
                    type="text"
                    value={shareNote}
                    onChange={(e) => setShareNote(e.target.value)}
                    maxLength={255}
                    placeholder="Lời nhắn (không bắt buộc)"
                    aria-label="Lời nhắn kèm theo"
                    className="h-11 flex-1"
                  />
                  <RoomButton type="submit" variant="secondary" icon={PaperPlaneTilt} loading={shareBusy}>
                    Giao việc
                  </RoomButton>
                </div>
                {shareHint && (
                  <p className="rounded-xl bg-room-rain/30 p-2.5 text-xs font-bold text-room-ink/75 ring-1 ring-inset ring-room-rain">
                    {shareHint}
                  </p>
                )}
              </form>
            )}
            {/* Luân phiên người làm: việc nhóm lặp lại mà mỗi kỳ MỘT người chịu
                trách nhiệm — "tuần này ai đổ rác". Không có khối này thì cả nhóm
                cùng nhận chuông rồi cùng đoán, và việc rơi vào tay người không
                biết mình có việc. */}
            {!closed && task.repeatType !== 'NONE' && assignees.length >= 2 && (
              <div className="mt-4 rounded-xl bg-room-oat/40 p-3 ring-1 ring-inset ring-room-acorn/15">
                <RoomToggle
                  checked={rotation.enabled}
                  onChange={(next) => onRotation({ enabled: next })}
                  disabled={rotationBusy}
                  label="Luân phiên mỗi kỳ"
                  description="Mỗi kỳ một người chịu trách nhiệm, xoay vòng theo thứ tự đã giao. Chuông chỉ nhắc người đến lượt."
                />
                {rotation.enabled && (
                  <div className="mt-1 space-y-2.5 border-t border-room-acorn/15 px-1 pt-3">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-room-ink/80">
                      <ArrowsClockwise size={14} weight="bold" className="text-room-acorn" />
                      Kỳ này: <strong>{turnName || 'chưa chọn ai'}</strong>
                      {nextTurnName && (
                        <span className="font-semibold text-room-ink/50">
                          · kỳ sau: {nextTurnName}
                        </span>
                      )}
                    </p>
                    <RoomSelect
                      value={rotation.turnAssigneeId ?? ''}
                      onChange={(e) => onRotation({ assigneeId: Number(e.target.value) })}
                      disabled={rotationBusy}
                      aria-label="Người làm kỳ này"
                      className="h-10 text-xs"
                    >
                      {assignees.map((s) => (
                        <option key={s.shareId} value={s.assignee?.id}>
                          {s.assignee?.fullName || 'Người được giao'}
                        </option>
                      ))}
                    </RoomSelect>
                    <p className="text-[11px] font-semibold leading-relaxed text-room-ink/50">
                      Đổi người ở đây chỉ áp dụng cho kỳ này — kỳ sau vẫn xoay đúng thứ tự
                      (tuần này con ốm thì mẹ làm, tuần sau vẫn đến lượt con).
                    </p>
                  </div>
                )}
              </div>
            )}
            {!closed && assignees.length >= 2 && task.repeatType === 'NONE' && (
              <p className="mt-3 text-xs font-semibold text-room-ink/50">
                Muốn mỗi kỳ một người làm?{' '}
                <Link to={`/app/tasks/${task.id}/edit`} className="font-bold underline">
                  Bật lặp lại
                </Link>{' '}
                cho việc này trước — luân phiên cần biết kỳ sau là khi nào.
              </p>
            )}
            {closed && (
              <p className="mt-3 text-xs font-semibold text-room-ink/50">
                Công việc đã kết thúc nên không giao thêm được.
              </p>
            )}
            {!closed && assignees.length >= 5 && (
              <p className="mt-3 text-xs font-semibold text-room-ink/50">
                Một việc chỉ giao được cho tối đa 5 người.
              </p>
            )}
          </>
        )}
      </RoomCard>

      <ConfirmDialog
        skin="room"
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runAction}
        title={confirm?.title}
        message={confirm?.message}
        danger={confirm?.danger}
        confirmLabel={confirm?.type === 'cancel' ? 'Hủy công việc' : 'Xóa'}
        loading={busy}
      />
    </div>
  )
}
