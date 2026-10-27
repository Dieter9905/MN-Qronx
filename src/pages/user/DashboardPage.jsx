import { useId } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDots,
  WarningCircle,
  CheckCircle,
  ArrowRight,
  Plus,
  Sparkle,
  BellRinging,
  Flame,
  Gift,
  Brain,
  Mountains,
  UserCircle,
} from '@phosphor-icons/react'
import { getDashboard, completeTask } from '../../services/taskService'
import { getMyBilling } from '../../services/billingService'
import { useCachedQuery } from '../../lib/useCachedQuery'
import { SERVER_WAKE_HINT } from '../../lib/useSlowHint'
import { useToast } from '../../components/common/Toast'
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import TaskItem from '../../components/TaskItem'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'
import { formatDate } from '../../lib/format'

// Icon thẻ thống kê — gradient riêng từng ô: xanh/teal/tím/cam như bản mẫu.
const STAT_TONES = {
  blue: 'from-blue-500 to-blue-700',
  teal: 'from-teal-400 to-emerald-600',
  purple: 'from-violet-500 to-purple-700',
  orange: 'from-orange-400 to-amber-600',
}

// Thẻ "Công việc hôm nay / Quá hạn / Đã hoàn thành / Sắp tới" — bố cục dọc:
// icon gradient trên, chữ & số bên dưới chiếm trọn bề rộng nên không bị bóp chữ
// kể cả khi lưới 4 cột hẹp lại, mũi tên chỉ hiện khi hover như bản mẫu.
function StatCard({ icon: Icon, label, value, sub, tone, to, delay }) {
  return (
    <Link
      to={to}
      className={`group flex flex-col gap-2 rounded-2xl p-4 text-white shadow-card transition-all duration-200 hover:shadow-card-hover bg-gradient-to-br ${STAT_TONES[tone]}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
          <Icon size={24} weight="duotone" className="text-white" />
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/0 opacity-60 transition group-hover:bg-white/20 group-hover:opacity-100">
          <ArrowRight size={15} weight="bold" />
        </span>
      </span>
      <span className="mt-1 block truncate text-sm font-semibold leading-snug">{label}</span>
      <span className="block text-3xl font-extrabold leading-none tracking-tight">{value}</span>
      <span className="block truncate text-xs font-medium text-white/85">{sub}</span>
    </Link>
  )
}

// Vòng tròn tiến độ (SVG stroke-dasharray) — % hoàn thành chung bảng Thống kê nhanh.
function ProgressRing({ percent, label }) {
  // Dùng useId để nhiều vòng tròn không xung đột id của gradient SVG.
  const uid = useId().replace(/:/g, '')
  const r = 54
  const c = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * c
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full">
        <defs>
          <linearGradient id={`ring-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="128" y2="128">
            <stop offset="0%" stopColor="#25C1C9" />
            <stop offset="50%" stopColor="#5B7CFA" />
            <stop offset="100%" stopColor="#9B6BFA" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-navy-100 dark:stroke-slate-700" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={`url(#ring-${uid})`}
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-navy-900 dark:text-white">{percent}%</span>
        <span className="text-xs text-navy-400 dark:text-slate-500">{label}</span>
      </div>
    </div>
  )
}

// Minh hoạ trạng thái trống: icon trong thẻ to + vài chấm lấp lánh như bản mẫu.
function IllEmpty({ icon: Icon, tint = 'text-blue-200 dark:text-blue-500/60' }) {
  return (
    <div className="relative mx-auto w-fit py-2">
      <span className={`flex h-24 w-24 items-center justify-center rounded-3xl bg-navy-50 dark:bg-slate-800/60 ${tint}`}>
        <Icon size={72} weight="duotone" />
      </span>
      <Sparkle size={14} weight="fill" className="absolute -top-1 right-3 text-amber-300" />
      <Sparkle size={10} weight="fill" className="absolute bottom-2 -left-2 text-blue-300" />
      <Sparkle size={12} weight="fill" className="absolute -right-4 top-8 text-purple-300" />
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const t = app[lang]
  const toast = useToast()
  // Hiện số liệu đã lưu NGAY khi mở, rồi làm mới ở chế độ ngầm: web service gói
  // free của Render có thể đang khởi động 30–60 giây, trước đây màn hình chỉ có
  // skeleton trong suốt thời gian đó, còn nếu request đầu thất bại thì `data`
  // null làm cả trang trắng (không có ErrorBoundary).
  const { data, loading, error, slow, reload } = useCachedQuery('dashboard', getDashboard)
  // Gói sắp hết hạn: chuyển khoản không tự gia hạn được nên phải nhắc ngay trên
  // màn hình chính, không để khách vô tình mất quyền lợi khi quên mua kỳ mới.
  const { data: billing } = useCachedQuery('billing-me', getMyBilling)

  const toggleComplete = async (task) => {
    const res = await completeTask(task.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.data.nextTask ? t.completedRepeat : t.completedTask)
    reload()
  }

  const today = formatDate(new Date(), { weekday: true })

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 rounded-3xl" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-72 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        {slow && (
          <p className="text-center text-xs leading-relaxed text-navy-400 dark:text-slate-500">
            {SERVER_WAKE_HINT}
          </p>
        )}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6 animate-fade-in">
        <EmptyState
          icon={WarningCircle}
          title="Chưa tải được dữ liệu"
          description={error || 'Không nhận được phản hồi từ máy chủ.'}
          action={
            <Button variant="gradient" onClick={reload}>
              Thử lại
            </Button>
          }
        />
        <p className="text-center text-xs leading-relaxed text-navy-400 dark:text-slate-500">
          {SERVER_WAKE_HINT}
        </p>
      </div>
    )
  }

  // ===== Số liệu cho bảng "Thống kê nhanh" =====
  const total = data.todayCount + data.overdueCount + data.upcomingCount + data.completedCount
  const percent = total > 0 ? Math.round((data.completedCount / total) * 100) : 0
  const legend = [
    { dot: 'bg-emerald-500', label: t.legendCompleted, value: data.completedCount },
    { dot: 'bg-blue-500', label: t.legendToday, value: data.todayCount },
    { dot: 'bg-orange-400', label: t.legendOverdue, value: data.overdueCount },
    { dot: 'bg-slate-400', label: t.legendTotal, value: total },
  ]
  const unreadReward = true // chưa nhấn Nhận thưởng hôm nay — API chưa có cờ riêng, luôn gợi ý

  const initials = String(user?.fullName || '')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase()

  return (
    <div className="animate-fade-in grid gap-6 xl:grid-cols-[1fr_320px]">
      {/* ─── CỘT CHÍNH ─────────────────────────────────────── */}
      <div className="space-y-5">
        {/* Banner chào hỏi: nền trời đêm + avatar + trích dẫn */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d1236] via-[#1a1a55] to-[#321b6b] px-6 py-6 text-white shadow-card sm:px-8 sm:py-7">
          {/* sao + dải sáng trang trí */}
          <span className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-orange-500/25 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-14 right-24 h-44 w-44 rounded-[100%] rotate-45 bg-blue-400/15 blur-xl" />
          <span className="pointer-events-none absolute right-6 top-5 h-1.5 w-1.5 rounded-full bg-amber-200/80" />
          <span className="pointer-events-none absolute right-16 top-12 h-1 w-1 rounded-full bg-white/70" />
          <span className="pointer-events-none absolute right-28 top-8 h-1.5 w-1.5 rounded-full bg-blue-200/60" />

          <div className="relative flex items-center gap-4 sm:gap-5">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-white/40 sm:h-20 sm:w-20" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 ring-2 ring-white/40 sm:h-20 sm:w-20">
                {initials ? (
                  <span className="text-xl font-extrabold sm:text-2xl">{initials}</span>
                ) : (
                  <UserCircle size={36} weight="duotone" />
                )}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">
                {t.welcome}, {user?.fullName}! 👋
              </h1>
              <p className="mt-0.5 text-sm font-medium text-white/75">{today}</p>
              <p className="mt-2 hidden text-xs italic leading-relaxed text-white/60 sm:block">
                “{t.dashQuote}”
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800/50">
            <span>Số liệu có thể chưa mới nhất — {error}</span>
            <button type="button" onClick={reload} className="font-bold underline">
              Thử lại
            </button>
          </div>
        )}

        {billing?.plan !== 'FREE' &&
          billing?.planExpiresAt &&
          typeof billing?.daysLeft === 'number' &&
          billing.daysLeft <= 7 && (
            <Link
              to="/app/billing"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100 dark:bg-amber-900/20 dark:ring-amber-800/50 dark:hover:bg-amber-900/30"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                  <BellRinging size={20} weight="duotone" />
                </span>
                <span>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    {billing.daysLeft > 0
                      ? `Gói ${billing.planName} còn ${billing.daysLeft} ngày nữa là hết hạn`
                      : `Gói ${billing.planName} hết hạn hôm nay`}
                  </p>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300/80">
                    Hạn {formatDate(billing.planExpiresAt)} — chuyển khoản không tự gia hạn nên bạn cần mua kỳ mới để giữ
                    nguyên quyền lợi.
                  </p>
                </span>
              </span>
              <span className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white">
                Gia hạn ngay <ArrowRight size={14} weight="bold" />
              </span>
            </Link>
          )}

        {/* 4 thẻ thống kê hàng ngang */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard icon={CalendarDots} label={t.todayCount} value={data.todayCount} sub={t.todayCountSub} tone="blue" to="/app/tasks" delay={0} />
          <StatCard icon={WarningCircle} label={t.overdue} value={data.overdueCount} sub={t.overdueSub} tone="teal" to="/app/tasks" delay={60} />
          <StatCard icon={CheckCircle} label={t.completed} value={data.completedCount} sub={t.completedSub} tone="purple" to="/app/tasks" delay={120} />
          <StatCard icon={Sparkle} label={t.upcoming} value={data.upcomingCount} sub={t.upcomingSub} tone="orange" to="/app/calendar" delay={180} />
        </div>

        {/* Phần thưởng đăng nhập: chuỗi ngày + điểm */}
        <Link
          to="/app/rewards"
          className="group flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-[#3a1d3d] via-[#3f1f4d] to-[#251a55] p-5 text-white ring-1 ring-inset ring-white/10 transition hover:shadow-lg hover:shadow-purple-900/30"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg">
              <Flame size={30} weight="fill" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-200">{t.loginReward}</p>
              <p className="mt-0.5 text-lg font-extrabold">
                🔥 {user?.loginStreak ?? 0} {t.streakDays} · {user?.points ?? 0} {t.pointsUnit}
              </p>
              <p className="text-xs font-medium text-white/70">{t.loginRewardDesc}</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow transition group-hover:brightness-110">
            <Gift size={17} weight="duotone" /> {t.claimReward}
          </span>
        </Link>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Công việc hôm nay */}
          <section className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <CalendarDots size={20} weight="duotone" />
                </span>
                {t.todaySchedule}
              </h2>
              <Link to="/app/tasks" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                {t.viewAll} <ArrowRight size={13} weight="bold" />
              </Link>
            </div>
            <div className="mt-4 space-y-2.5">
              {data.todayTasks.length === 0 ? (
                <EmptyState
                  illustration={<IllEmpty icon={CalendarDots} />}
                  title={t.emptyToday}
                  description={t.emptyTodayDesc}
                  action={
                    <Link to="/app/tasks/new">
                      <Button variant="gradient" size="sm" icon={Plus}>
                        {t.createNew}
                      </Button>
                    </Link>
                  }
                />
              ) : (
                data.todayTasks.map((t) => (
                  <TaskItem key={t.id} task={t} onToggleComplete={toggleComplete} />
                ))
              )}
            </div>
          </section>

          {/* Quá hạn */}
          <section className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400">
                  <WarningCircle size={20} weight="duotone" />
                </span>
                {t.overdueTasks}
              </h2>
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                {data.overdueCount} {t.overdueTasksCount}
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {data.overdueTasks.length === 0 ? (
                <EmptyState
                  illustration={<IllEmpty icon={CheckCircle} tint="text-slate-200 dark:text-slate-500/60" />}
                  title={t.noOverdue}
                  description={t.noOverdueDesc}
                  className="py-10"
                />
              ) : (
                data.overdueTasks.map((t) => (
                  <TaskItem key={t.id} task={t} onToggleComplete={toggleComplete} />
                ))
              )}
            </div>
          </section>
        </div>

        {/* Nhắc nhở gợi ý */}
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white dark:bg-slate-800 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient">
              <BellRinging size={22} weight="bold" className="animate-alarm-bell" />
            </span>
            <div>
              <p className="font-bold">{t.tryAlarm}</p>
              <p className="mt-0.5 text-sm text-blue-100">
                {t.tryAlarmDesc}
              </p>
            </div>
          </div>
          <Link to="/app/tasks">
            <Button variant="gradient" size="sm" icon={BellRinging}>
              {t.tryAlarmBtn}
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── CỘT PHẢI ───────────────────────────────────────── */}
      <aside className="space-y-5">
        {/* Thống kê nhanh: vòng tròn % + chú giải */}
        <section className="card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900 dark:text-white">
              <CalendarDots size={18} weight="fill" className="text-blue-500" />
              {t.quickStats}
            </h2>
            <span className="rounded-lg bg-navy-50 px-2.5 py-1 text-[11px] font-bold text-navy-500 ring-1 ring-inset ring-navy-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
              {t.range7}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <ProgressRing percent={percent} label={t.completed} />
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {legend.map((row) => (
              <li key={row.label} className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
                <span className="flex-1 text-navy-600 dark:text-slate-300">{row.label}</span>
                <span className="font-bold tabular-nums text-navy-900 dark:text-white">{row.value}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Trợ lý AI */}
        <Link
          to="/app/ai"
          className="card group flex items-center gap-4 p-4 transition hover:shadow-card-hover sm:p-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <Brain size={24} weight="duotone" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-brand-purple dark:text-indigo-300">{t.aiAssistant}</span>
            <span className="mt-0.5 block truncate text-xs font-medium text-navy-400 dark:text-slate-500">{t.aiQuickDesc}</span>
          </span>
          <ArrowRight size={16} weight="bold" className="shrink-0 text-navy-300 transition group-hover:translate-x-0.5 dark:text-slate-500" />
        </Link>

        {/* Gợi ý động lực */}
        <div className="card relative overflow-hidden p-4 sm:p-5">
          <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-blue-400/10 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white">
              <Mountains size={24} weight="duotone" />
            </span>
            <div>
              <p className="font-bold text-navy-900 dark:text-white">{t.motivationTitle}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-navy-400 dark:text-slate-500">{t.motivationDesc}</p>
            </div>
          </div>
        </div>

        {/* Thẻ nhận thưởng mỗi ngày */}
        <div className="card relative overflow-hidden p-4 sm:p-5">
          <span className="pointer-events-none absolute -right-10 -bottom-12 h-32 w-32 rounded-full bg-purple-400/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                <BellRinging size={22} weight="duotone" />
              </span>
              <div>
                <p className="font-bold text-navy-900 dark:text-white">
                  {t.dailyReward} 🎁
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-navy-400 dark:text-slate-500">{t.loginRewardDesc}</p>
              </div>
            </div>
            <Link
              to="/app/rewards"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 py-2.5 text-sm font-bold text-white shadow transition hover:brightness-110"
            >
              <Gift size={16} weight="duotone" /> {t.claimNow}
              {unreadReward && <span className="h-2 w-2 rounded-full bg-amber-300" />}
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
