import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, BellSlash, Clock, XCircle, Alarm, CheckCircle } from '@phosphor-icons/react'
import { useAlarm, startAlarmSound, stopAlarmSound } from '../context/AlarmContext'
import { useToast } from './common/Toast'
import { PRIORITY, MAX_SNOOZE_COUNT, DEFAULT_SNOOZE_OPTIONS } from '../lib/constants'
import { formatTime, formatRelativeDay } from '../lib/format'
import { CategoryBadge } from './common/Badge'

// Màu nền theo mức ưu tiên (theo wireframe SCR-U-07)
const URGENT_BG = 'linear-gradient(160deg, #4c0519 0%, #9f1239 60%, #7c2d12 130%)'

// Vòng xoay cho nút đang chờ máy chủ. Khai báo ở phạm vi module (không phải trong
// thân component) để mỗi lần render lại không sinh ra một component mới — React sẽ
// tháo và dựng lại DOM của nút, làm nút nhấp nháy ngay lúc khách vừa bấm.
function Spinner({ light = false }) {
  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 ${
        light ? 'border-navy-900/20 border-t-navy-900' : 'border-white/30 border-t-white'
      }`}
    />
  )
}

export default function AlarmOverlay() {
  const { alarm, snooze, complete, dismiss } = useAlarm()
  const toast = useToast()
  const [muted, setMuted] = useState(false)
  // Đang chờ máy chủ trả lời thao tác NÀO — để nút vừa bấm hiện vòng xoay, các
  // nút còn lại tạm khoá. Một biến `busy` chung thì khách không biết nút nào đang chạy.
  const [busyAction, setBusyAction] = useState(null)

  const priorityInfo = useMemo(() => PRIORITY[alarm?.task?.priority] || PRIORITY.MEDIUM, [alarm])
  const urgent = alarm?.task?.priority === 'URGENT'
  const snoozeCount = alarm?.snoozeCount || 0
  const maxSnoozeReached = snoozeCount >= MAX_SNOOZE_COUNT
  const remainingSnoozes = Math.max(0, MAX_SNOOZE_COUNT - snoozeCount)
  const isDemo = alarm?.demo
  const busy = busyAction !== null

  // Thời gian hoãn chọn được ngay tại chuông, mặc định là con số khách đã đặt trong
  // Cài đặt (Hoãn mặc định). Nếu khách đặt một giá trị ngoài danh sách gợi ý
  // (backend cho 1–60 phút) thì vẫn phải có mặt — nếu không, đúng cái nút khách
  // đã chọn làm mặc định lại là nút duy nhất không có.
  const defaultSnoozeMinutes = alarm?.snoozeMinutes ?? 10
  const snoozeOptions = useMemo(
    () => [...new Set([...DEFAULT_SNOOZE_OPTIONS, defaultSnoozeMinutes])].sort((a, b) => a - b),
    [defaultSnoozeMinutes]
  )

  if (!alarm) return null

  const handleSnooze = async (minutes) => {
    setBusyAction(`snooze-${minutes}`)
    const res = await snooze(minutes)
    setBusyAction(null)
    if (!res?.success) toast.error(res?.message || 'Không thể hoãn báo thức')
  }

  // Việc đã làm xong: kết thúc cả vòng nhắc nhở ngay tại đây. Việc lặp lại thì
  // nói luôn kỳ sau rơi vào lúc nào — khách không phải mở danh sách để kiểm tra.
  const handleComplete = async () => {
    setBusyAction('complete')
    const res = await complete()
    setBusyAction(null)
    if (!res?.success) {
      // Không đánh dấu xong được (mất mạng, việc đã kết thúc…) → tắt tiếng cho dễ
      // chịu NHƯNG giữ màn hình lại: tắt luôn màn hình là khách tưởng việc đã xong,
      // và giữ nguyên tiếng chuông thì khách bị phạt vì mạng hỏng.
      stopAlarmSound()
      toast.error(res?.message || 'Không thể đánh dấu hoàn thành')
      return
    }
    // Chuông demo không đánh dấu xong việc thật, nên câu "Đã đánh dấu hoàn
    // thành" ở đây sẽ là nói dối. Nói đúng việc vừa xảy ra.
    if (isDemo) {
      toast.info('Chế độ thử — việc thật không bị đánh dấu xong')
      return
    }
    const next = res.data?.nextTask
    if (next?.dueAt) {
      toast.success(
        `Đã xong! Kỳ tiếp theo: ${formatRelativeDay(next.dueAt).toLowerCase()} ${formatTime(next.dueAt)}`
      )
    } else {
      toast.success('Đã đánh dấu hoàn thành')
    }
  }

  const handleDismiss = async () => {
    setBusyAction('dismiss')
    const res = await dismiss()
    setBusyAction(null)
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
              Đã hoãn tối đa {MAX_SNOOZE_COUNT} lần – bấm <span className="font-extrabold">Đã xong việc</span>{' '}
              nếu đã làm xong, hoặc <span className="font-extrabold">Tắt</span> để xử lý sau
            </p>
          )}
        </div>

        {/* Hành động.
            Ba mức rõ ràng, theo đúng thứ tự việc thường xảy ra:
            1. Đã xong việc — hành động CHÍNH, vì việc làm xong đúng lúc chuông kêu
               là kết thúc tự nhiên nhất của cả vòng nhắc nhở (và đây là chỗ duy
               nhất trước đây khách còn phải mở danh sách để đánh dấu).
            2. Hoãn — chọn được số phút ngay tại đây.
            3. Tắt — chỉ tắt chuông, việc VẪN còn trong danh sách. */}
        <div className="w-full max-w-md space-y-3">
          <button
            type="button"
            onClick={handleComplete}
            disabled={busy}
            className="flex h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white text-base font-extrabold text-navy-900 shadow-2xl transition-all duration-150 hover:bg-navy-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === 'complete' ? (
              <Spinner light />
            ) : (
              <CheckCircle size={24} weight="fill" className="text-emerald-500" />
            )}
            Đã xong việc
          </button>

          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-inset ring-white/15">
            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                Hoãn nhắc lại
              </span>
              <span className="text-[11px] font-semibold text-white/45">
                còn {remainingSnoozes}/{MAX_SNOOZE_COUNT} lần
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {snoozeOptions.map((minutes) => {
                const isDefault = minutes === defaultSnoozeMinutes
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => handleSnooze(minutes)}
                    disabled={busy || maxSnoozeReached}
                    aria-label={`Hoãn ${minutes} phút${isDefault ? ' (mặc định của bạn)' : ''}`}
                    className={[
                      'flex h-12 cursor-pointer items-center justify-center rounded-xl text-sm font-bold transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      isDefault
                        ? 'bg-white/25 text-white ring-1 ring-inset ring-white/40'
                        : 'bg-white/10 text-white/85 ring-1 ring-inset ring-white/15 hover:bg-white/20',
                    ].join(' ')}
                  >
                    {busyAction === `snooze-${minutes}` ? <Spinner /> : `${minutes} phút`}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            disabled={busy}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-bold text-white/80 ring-1 ring-inset ring-white/15 backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === 'dismiss' ? (
              <Spinner />
            ) : (
              <XCircle size={18} weight="fill" className="text-rose-300" />
            )}
            Tắt nhắc nhở này
          </button>

          <p className="text-center text-xs font-medium leading-relaxed text-white/50">
            <span className="font-bold text-white/80">Đã xong việc</span> = kết thúc luôn việc này (việc
            lặp lại sẽ sang kỳ sau). <span className="font-bold text-white/80">Tắt</span> = chỉ tắt
            chuông, việc vẫn nằm trong danh sách. Báo thức không thể đóng bằng nút back.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
