import { useEffect, useState } from 'react'
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
} from '@phosphor-icons/react'
import { getDashboard, completeTask } from '../../services/taskService'
import { useToast } from '../../components/common/Toast'
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import TaskItem from '../../components/TaskItem'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { app } from '../../i18n/app'
import { formatDate } from '../../lib/format'

function StatCard({ icon: Icon, label, value, tone, sub, delay }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-800/50',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800/50',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800/50',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:ring-purple-800/50',
  }
  return (
    <div className="card p-4 transition-all duration-200 hover:shadow-card-hover sm:p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${tones[tone]}`}>
          <Icon size={20} weight="duotone" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 dark:text-white">{value}</p>
      <p className="text-sm font-semibold text-navy-500 dark:text-slate-400">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-navy-400 dark:text-slate-500">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const t = app[lang]
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const res = await getDashboard()
    if (res.success) setData(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleComplete = async (task) => {
    const res = await completeTask(task.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.data.nextTask ? t.completedRepeat : t.completedTask)
    load()
  }

  const today = formatDate(new Date(), { weekday: true })

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title dark:text-white">{t.welcome}, {user?.fullName?.split(' ').slice(-1)[0]}! 👋</h1>
        <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">{today}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDots} label={t.todayCount} value={data.todayCount} tone="blue" sub={t.todayCountSub} delay={0} />
        <StatCard icon={WarningCircle} label={t.overdue} value={data.overdueCount} tone="amber" sub={t.overdueSub} delay={60} />
        <StatCard icon={CheckCircle} label={t.completed} value={data.completedCount} tone="emerald" sub={t.completedSub} delay={120} />
        <StatCard icon={Sparkle} label={t.upcoming} value={data.upcomingCount} tone="purple" sub={t.upcomingSub} delay={180} />
      </div>

      {/* Phần thưởng: chuỗi đăng nhập + điểm */}
      <Link
        to="/app/rewards"
        className="group flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 text-white transition-all hover:shadow-lg hover:shadow-indigo-500/25 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg">
            <Flame size={28} weight="fill" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-100">{t.loginReward}</p>
            <p className="mt-0.5 text-lg font-extrabold">
              🔥 {user?.loginStreak ?? 0} {t.streakDays} · {user?.points ?? 0} {t.pointsUnit}
            </p>
            <p className="text-xs text-blue-100">{t.loginRewardDesc}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-bold text-white transition group-hover:bg-white/20">
          <Gift size={16} weight="duotone" className="text-amber-300" /> {t.claimReward}
        </span>
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Công việc hôm nay */}
        <section className="card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
              <CalendarDots size={18} weight="fill" className="text-blue-600 dark:text-blue-400" />
              {t.todaySchedule}
            </h2>
            <Link to="/app/tasks" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
              {t.viewAll} <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
          <div className="mt-4 space-y-2.5">
            {data.todayTasks.length === 0 ? (
              <EmptyState
                icon={Sparkle}
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
              <WarningCircle size={18} weight="fill" className="text-amber-500 dark:text-amber-400" />
              {t.overdueTasks}
            </h2>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
              {data.overdueCount} {t.overdueTasksCount}
            </span>
          </div>
          <div className="mt-4 space-y-2.5">
            {data.overdueTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
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
  )
}
