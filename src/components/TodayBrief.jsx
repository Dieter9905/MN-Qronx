import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, ListChecks, ArrowRight, MapPin, WarningCircle } from '@phosphor-icons/react'
import { getTodayBrief } from '../services/schoolScheduleService'
import { useToast } from './common/Toast'

// ─── Bản tin hôm nay (thông báo trong web) ────────────────────────────────
// Mỗi ngày một lần, khi mở web: gộp tiết học của mọi Lớp + việc đến hạn.
// Không có Lớp hoặc hôm nay trống lịch thì không chiếm chỗ trên Dashboard;
// chỉ hiện cảnh báo "hôm nay không có tiết" khi người dùng đã có TKB.
//
// Toast chỉ nổ MỘT lần/ngày (khoá theo ngày trong localStorage) để không
// thành phiền khi người dùng mở lại web nhiều lần.
function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export default function TodayBrief() {
  const [brief, setBrief] = useState(null)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await getTodayBrief()
      if (cancelled || !res.success) return
      const data = res.data
      setBrief(data)
      const hasSomething = (data.classes?.length || 0) + (data.tasks?.length || 0) > 0
      if (!hasSomething) return
      const key = 'mnq:todayBriefShown'
      if (localStorage.getItem(key) === todayKey()) return
      localStorage.setItem(key, todayKey())
      const parts = []
      if (data.classes?.length) parts.push(`${data.classes.length} tiết học`)
      if (data.tasks?.length) parts.push(`${data.tasks.length} việc đến hạn`)
      toast.info(`Hôm nay bạn có ${parts.join(' và ')}`)
    })()
    return () => {
      cancelled = true
    }
  }, [toast])

  if (!brief) return null
  const hasClasses = (brief.classes?.length || 0) > 0
  const hasTasks = (brief.tasks?.length || 0) > 0
  if (!hasClasses && !hasTasks && !brief.overdueCount) return null

  return (
    <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-navy-900 dark:text-white">
          <GraduationCap size={18} weight="fill" className="text-blue-600 dark:text-blue-400" />
          Hôm nay
          <span className="text-xs font-semibold text-navy-400 dark:text-slate-500">
            {hasClasses ? `${brief.classes.length} tiết` : 'không có tiết'}
            {hasTasks ? ` · ${brief.tasks.length} việc đến hạn` : ''}
          </span>
        </h2>
        <Link to="/app/calendar" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400">
          Mở lịch <ArrowRight size={12} weight="bold" />
        </Link>
      </div>

      {hasClasses && (
        <ul className="mt-3 space-y-1.5">
          {brief.classes.map((c) => (
            <li key={c.scheduleSlotId} className="flex items-center gap-2 rounded-lg bg-navy-50/70 px-3 py-2 dark:bg-slate-700/50">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.colorCode || '#7c8cff' }} aria-hidden="true" />
              <span className="text-xs font-bold tabular-nums text-navy-600 dark:text-slate-300">
                {c.startTime}–{c.endTime}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-800 dark:text-slate-200">{c.title}</span>
              {c.room && (
                <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-navy-400 dark:text-slate-500">
                  <MapPin size={11} weight="fill" /> {c.room}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasTasks && (
        <ul className="mt-2 space-y-1">
          {brief.tasks.slice(0, 4).map((t) => (
            <li key={t.id}>
              <Link
                to={`/app/tasks/${t.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 dark:text-slate-300 dark:hover:bg-slate-700/60"
              >
                <ListChecks size={13} weight="bold" className="shrink-0 text-navy-400" />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-[11px] font-medium text-navy-400 dark:text-slate-500">
                  {new Date(t.dueAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {brief.overdueCount > 0 && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11.5px] font-bold text-rose-600 dark:bg-rose-900/25 dark:text-rose-300">
          <WarningCircle size={13} weight="fill" /> {brief.overdueCount} việc quá hạn từ trước vẫn đang chờ
        </p>
      )}
    </section>
  )
}
