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
} from '../../services/taskService'
import { addReminder, removeReminder } from '../../services/reminderService'
import { useToast } from '../../components/common/Toast'
import { PageLoader, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/common/Badge'
import { ConfirmDialog } from '../../components/common/Modal'
import { formatDateTime, formatRelativeDay, formatTime, effectiveStatus, isOverdue } from '../../lib/format'
import { REPEAT_TYPE } from '../../lib/constants'

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

  if (loading) return <PageLoader label="Đang tải chi tiết công việc…" />
  if (!task) return null

  const status = effectiveStatus(task)
  const closed = task.status === 'COMPLETED' || task.status === 'CANCELLED'
  const completedSub = task.subtasks.filter((s) => s.isCompleted).length

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

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <Link to="/app/tasks" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500 transition hover:text-blue-600">
        <ArrowLeft size={16} weight="bold" /> Quay lại danh sách
      </Link>

      {/* Header */}
      <div className="card relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <PriorityBadge priority={task.priority} />
              {task.category && <CategoryBadge category={task.category} />}
            </div>
            <h1 className={`mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl ${task.status === 'COMPLETED' ? 'text-navy-300 line-through dark:text-slate-500' : 'text-navy-900 dark:text-white'}`}>
              {task.title}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-navy-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck size={16} weight="bold" className="text-blue-600" />
                {formatRelativeDay(task.dueAt)} · {formatDateTime(task.dueAt)}
              </span>
              {task.repeatType !== 'NONE' && (
                <span className="inline-flex items-center gap-1.5 text-purple-600">
                  <Repeat size={16} weight="bold" /> Lặp lại: {REPEAT_TYPE[task.repeatType]}
                </span>
              )}
            </p>
            {isOverdue(task) && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
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
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-navy-500 transition hover:bg-navy-50 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <DotsThree size={24} weight="bold" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl bg-white py-1.5 shadow-2xl ring-1 ring-navy-100 animate-scale-in dark:bg-slate-800 dark:ring-slate-700">
                <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); navigate(`/app/tasks/${task.id}/edit`) }} className="menu-item">
                  <PencilSimple size={17} weight="bold" /> Sửa công việc
                </button>
                {!closed && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => { setMenuOpen(false); setConfirm({ type: 'cancel', title: 'Hủy công việc', message: `Hủy công việc “${task.title}”? Các nhắc nhở chưa kích hoạt sẽ bị hủy.` }) }}
                    className="menu-item text-amber-600 hover:bg-amber-50"
                  >
                    <Prohibit size={17} weight="bold" /> Hủy công việc
                  </button>
                )}
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => { setMenuOpen(false); setConfirm({ type: 'delete', title: 'Xóa công việc', message: `Xóa công việc “${task.title}”? Hành động này không thể hoàn tác.`, danger: true }) }}
                  className="menu-item text-rose-600 hover:bg-rose-50"
                >
                  <Trash size={17} weight="bold" /> Xóa công việc
                </button>
              </div>
            )}
          </div>
        </div>

        {task.description && (
          <div className="mt-5 rounded-xl bg-navy-50/70 p-4 dark:bg-slate-900/50">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-700 dark:text-slate-300">{task.description}</p>
          </div>
        )}

        {/* Nút hoàn thành */}
        <div className="mt-6">
          {closed ? (
            <Button variant="secondary" fullWidth size="lg" icon={Repeat} onClick={handleReopen} loading={busy}>
              Mở lại công việc
            </Button>
          ) : (
            <Button variant="gradient" fullWidth size="lg" icon={CheckCircle} onClick={handleComplete} loading={busy}>
              Đánh dấu hoàn thành
            </Button>
          )}
        </div>
      </div>

      {/* Việc con */}
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
          <ListChecks size={19} weight="fill" className="text-blue-600 dark:text-blue-400" />
          Việc con
          {task.subtasks.length > 0 && (
            <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-500 dark:bg-slate-700 dark:text-slate-400">
              {completedSub}/{task.subtasks.length}
            </span>
          )}
        </h2>
        {task.subtasks.length > 0 && (
          <div className="mb-3 mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-300"
              style={{ width: `${(completedSub / task.subtasks.length) * 100}%` }}
            />
          </div>
        )}
        <ul className="mt-3 space-y-1.5">
          {task.subtasks.map((sub) => (
            <li key={sub.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-navy-50 dark:hover:bg-slate-700/50">
              <button
                type="button"
                onClick={() => onToggleSub(sub)}
                aria-label={sub.isCompleted ? `Mở lại: ${sub.content}` : `Hoàn thành: ${sub.content}`}
                className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition ${
                  sub.isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-navy-200 text-transparent hover:border-blue-500'
                }`}
              >
                <Check size={11} weight="bold" />
              </button>
              <p className={`flex-1 text-sm ${sub.isCompleted ? 'text-navy-300 line-through dark:text-slate-500' : 'text-navy-800 dark:text-slate-200'}`}>{sub.content}</p>
              <button
                type="button"
                onClick={() => onDeleteSub(sub)}
                aria-label={`Xóa việc con: ${sub.content}`}
                className="cursor-pointer rounded-md p-1.5 text-navy-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-rose-900/30"
              >
                <X size={15} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
        {!closed && (
          <form onSubmit={onAddSubtask} className="mt-3 flex gap-2">
            <input
              type="text"
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              placeholder="Thêm việc con, nhấn Enter…"
              aria-label="Thêm việc con"
              className="h-11 flex-1 rounded-xl border-0 bg-navy-50 px-3.5 text-sm text-navy-900 ring-1 ring-inset ring-navy-100 transition placeholder:text-navy-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600 dark:placeholder:text-slate-400 dark:focus:bg-slate-600"
            />
            <Button type="submit" variant="secondary" icon={Plus} size="icon" aria-label="Thêm việc con" />
          </form>
        )}
        {task.subtasks.length === 0 && !closed && (
          <p className="mt-2 text-xs text-navy-400">Chia nhỏ công việc thành các bước để dễ hoàn thành hơn.</p>
        )}
      </section>

      {/* Nhắc nhở */}
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
          <Bell size={19} weight="fill" className="text-amber-500 dark:text-amber-400" />
          Nhắc nhở
          <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-500 dark:bg-slate-700 dark:text-slate-400">
            {task.reminders.filter((r) => r.status === 'SCHEDULED').length}/5
          </span>
        </h2>
        {task.reminders.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {task.reminders.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-navy-50/70 px-3.5 py-2.5 dark:bg-slate-900/50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <Clock size={17} weight="bold" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy-800 dark:text-slate-200">{formatDateTime(r.remindAt)}</p>
                  <p className="text-xs text-navy-400 dark:text-slate-500">
                    {r.status === 'SCHEDULED' ? 'Sẽ báo thức đúng giờ' : r.status === 'CANCELLED' ? 'Đã bị hủy' : r.status === 'DISMISSED' ? 'Đã tắt' : 'Đã kích hoạt'}
                    {r.snoozeCount > 0 && ` · Đã hoãn ${r.snoozeCount} lần`}
                  </p>
                </div>
                {r.status === 'SCHEDULED' && (
                  <button
                    type="button"
                    onClick={() => onDeleteReminder(r)}
                    aria-label="Xóa nhắc nhở"
                    className="cursor-pointer rounded-md p-1.5 text-navy-300 transition hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Bell} title="Chưa có nhắc nhở" description="Thêm nhắc nhở để MN-Qronx báo thức bạn đúng giờ." className="py-8" />
        )}
        {!closed && task.reminders.filter((r) => r.status === 'SCHEDULED').length < 5 && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">              <input
              type="datetime-local"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              aria-label="Chọn thời điểm nhắc nhở"
              className="h-11 flex-1 rounded-xl border-0 bg-navy-50 px-3.5 text-sm text-navy-900 ring-1 ring-inset ring-navy-100 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white dark:ring-slate-600 dark:focus:bg-slate-600"
            />
            <Button variant="secondary" icon={Plus} onClick={onAddReminder}>
              Thêm nhắc nhở
            </Button>
          </div>
        )}
        {closed && <p className="mt-3 text-xs text-navy-400 dark:text-slate-500">Công việc đã đóng – không thể thêm nhắc nhở mới.</p>}
      </section>

      <ConfirmDialog
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
