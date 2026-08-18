import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, BellSlash, Clock, XCircle, Alarm } from '@phosphor-icons/react'
import { useAlarm, startAlarmSound } from '../context/AlarmContext'
import { useToast } from './common/Toast'
import { PRIORITY, MAX_SNOOZE_COUNT } from '../lib/constants'
import { formatTime, formatRelativeDay } from '../lib/format'
import { CategoryBadge } from './common/Badge'

// Màu nền theo mức ưu tiên (theo wireframe SCR-U-07)
const URGENT_BG = 'linear-gradient(160deg, #4c0519 0%, #9f1239 60%, #7c2d12 130%)'

export default function AlarmOverlay() {
  const { alarm, snooze, dismiss } = useAlarm()
  const toast = useToast()
  const [muted, setMuted] = useState(false)
  const [busy, setBusy] = useState(false)

  const priorityInfo = useMemo(() => PRIORITY[alarm?.task?.priority] || PRIORITY.MEDIUM, [alarm])
  const urgent = alarm?.task?.priority === 'URGENT'
  const snoozeCount = alarm?.snoozeCount || 0
  const maxSnoozeReached = snoozeCount >= MAX_SNOOZE_COUNT
  const isDemo = alarm?.demo

  if (!alarm) return null

  const handleSnooze = async () => {
    setBusy(true)
    const res = await snooze()
    setBusy(false)
    if (!res?.success) toast.error(res?.message || 'Không thể hoãn báo thức')
  }

  const handleDismiss = async () => {
    setBusy(true)
    const res = await dismiss()
    setBusy(false)
    if (!res?.success) toast.error(res?.message || 'Không thể tắt báo thức')
  }

  const toggleMute = () => {
    setMuted((m) => {
      if (m) startAlarmSound()
      return !m
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] overflow-hidden font-sans text-white"
      style={{ background: urgent ? URGENT_BG : 'var(--alarm-bg, linear-gradient(160deg,#0D1B2A 0%,#1e3a8a 55%,#6d28d9 130%))' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Báo thức: ${alarm.task.title}`}
    >
      {/* hiệu ứng nền */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-brand-purple/20 blur-3xl" />
        <div className="absolute inset-x-0 top-1/3 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      {/* nút tắt tiếng */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng tạm thời'}
        className="absolute right-4 top-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {muted ? <BellSlash size={22} weight="bold" /> : <Bell size={22} weight="bold" />}
      </button>
      {isDemo && (
        <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
          <Alarm size={14} weight="fill" className="text-cyan-300" /> Báo thức demo
        </span>
      )}

      <div className="relative flex h-full flex-col items-center justify-between px-6 py-14 sm:py-16">
        {/* Chuông + thông tin */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`relative flex h-28 w-28 items-center justify-center rounded-full ${!muted ? 'animate-alarm-ring' : ''}`}
            aria-hidden="true"
          >
            <div className="absolute inset-0 rounded-full bg-white/10" />
            <Bell
              size={56}
              weight="fill"
              className={`text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)] ${!muted ? 'animate-alarm-bell' : ''}`}
            />
          </div>

          <p className="mt-8 text-sm font-bold uppercase tracking-[0.3em] text-white/60">
            {formatRelativeDay(alarm.task.dueAt)} · {formatTime(alarm.task.dueAt)}
          </p>
          <h2 className="mt-3 max-w-xl text-3xl font-extrabold leading-tight drop-shadow sm:text-4xl">
            {alarm.task.title}
          </h2>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {alarm.task.category && <CategoryBadge category={alarm.task.category} />}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-white/20">
              <span className={`h-1.5 w-1.5 rounded-full ${priorityInfo.dot}`} aria-hidden="true" />
              Ưu tiên {priorityInfo.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-white/20">
              <Clock size={12} weight="bold" className="text-cyan-300" />
              Đến hạn {formatTime(alarm.task.dueAt)}
            </span>
          </div>

          {alarm.task.description && (
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">{alarm.task.description}</p>
          )}

          {maxSnoozeReached && (
            <p className="mt-5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-inset ring-amber-300/30">
              Đã hoãn tối đa {MAX_SNOOZE_COUNT} lần cho phép – hãy tắt báo thức để xác nhận
            </p>
          )}
        </div>

        {/* Hành động */}
        <div className="w-full max-w-md">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSnooze}
              disabled={busy || maxSnoozeReached}
              className={[
                'flex h-16 items-center justify-center gap-2 rounded-2xl text-base font-bold transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                'disabled:cursor-not-allowed disabled:opacity-40',
                maxSnoozeReached
                  ? 'bg-white/5 text-white/50 ring-1 ring-white/10'
                  : 'cursor-pointer bg-white/15 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/25 active:scale-[0.98]',
              ].join(' ')}
            >
              <Clock size={22} weight="bold" />
              Hoãn {alarm?.snoozeMinutes ?? 10} phút
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={busy}
              className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white text-navy-900 text-base font-extrabold shadow-2xl transition-all duration-150 hover:bg-navy-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XCircle size={24} weight="fill" className="text-rose-500" />
              Tắt
            </button>
          </div>
          <p className="mt-4 text-center text-xs font-medium text-white/50">
            Báo thức chỉ dừng khi bạn chọn <span className="font-bold text-white/80">Hoãn</span> hoặc{' '}
            <span className="font-bold text-white/80">Tắt</span> – không thể đóng bằng nút back.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
