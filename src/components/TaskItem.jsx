import { Link } from 'react-router-dom'
import { Check, Bell, Repeat, Clock, UserPlus } from '@phosphor-icons/react'
import { StatusBadge, PriorityBadge, CategoryBadge } from './common/Badge'
import { formatTime, formatRelativeDay, effectiveStatus } from '../lib/format'
import { repeatSummary } from '../lib/constants'

export default function TaskItem({ task, onToggleComplete, compact = false, onBellClick }) {
  const status = effectiveStatus(task)
  const completed = task.status === 'COMPLETED'
  const hasReminders = task.reminders?.length > 0
  const cancelled = task.status === 'CANCELLED'

  const toggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleComplete?.(task)
  }

  return (
    <Link
      to={`/app/tasks/${task.id}`}
      data-spotlight
      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-navy-100/80 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover hover:ring-blue-200 dark:bg-slate-800 dark:ring-slate-700/80 dark:hover:ring-blue-500/50 ${
        cancelled ? 'opacity-60' : ''
      } ${compact ? '' : 'sm:p-4'}`}
      aria-label={`Xem chi tiết: ${task.title}`}
    >
      {/* Vạch màu bung ra khi hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-r-full bg-brand-gradient transition-all duration-300 group-hover:h-9"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={completed ? `Mở lại công việc: ${task.title}` : `Đánh dấu hoàn thành: ${task.title}`}
        aria-pressed={completed}
        className={[
          'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-200 hover:scale-110 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
          completed
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-navy-200 text-transparent hover:border-blue-500 hover:text-blue-200 group-hover:border-blue-400 dark:border-slate-600 dark:hover:border-blue-400 dark:group-hover:border-blue-400',
        ].join(' ')}
      >
        <Check size={13} weight="bold" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`truncate text-sm font-semibold ${
              completed ? 'text-navy-300 line-through dark:text-slate-500' : 'text-navy-900 dark:text-white'
            }`}
          >
            {task.title}
          </p>
          {hasReminders && !cancelled && (
            <span
              title={`${task.reminders.length} nhắc nhở`}
              className="shrink-0 text-amber-500"
              aria-label={`${task.reminders.length} nhắc nhở`}
            >
              <Bell size={14} weight={onBellClick ? 'fill' : 'regular'} />
            </span>
          )}
          {task.repeatType && task.repeatType !== 'NONE' && !cancelled && (
            <span
              title={`Lặp lại: ${repeatSummary(task.repeatType, task.repeatDays)}`}
              className="shrink-0 text-purple-400"
              aria-label={`Lặp lại: ${repeatSummary(task.repeatType, task.repeatDays)}`}
            >
              <Repeat size={14} weight="bold" />
            </span>
          )}
          {/* Nhờ người khác làm (Pro): thấy ngay trong danh sách là việc này không
              chỉ nằm ở đầu bạn — không có nhãn thì rất dễ tưởng mình đang làm một mình. */}
          {task.shareCount > 0 && (
            <span
              title={`Đã giao cho ${task.shareCount} người`}
              className="inline-flex shrink-0 items-center gap-0.5 text-violet-400"
              aria-label={`Đã giao cho ${task.shareCount} người`}
            >
              <UserPlus size={14} weight="bold" />
              {task.shareCount > 1 ? task.shareCount : ''}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-navy-400 dark:text-slate-500">
            <Clock size={12} weight="bold" />
            {formatRelativeDay(task.dueAt)} · {formatTime(task.dueAt)}
          </span>
          {!compact && <CategoryBadge category={task.category} />}
          {!compact && <PriorityBadge priority={task.priority} />}
          {!compact && <StatusBadge status={status} />}
        </div>
      </div>

      {compact && (
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <StatusBadge status={status} />
        </div>
      )}
      {task.category && compact && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full sm:hidden"
          style={{ backgroundColor: task.category.color }}
          aria-hidden="true"
        />
      )}
    </Link>
  )
}
