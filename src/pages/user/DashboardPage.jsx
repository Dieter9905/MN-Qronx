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
} from '@phosphor-icons/react'
import { getDashboard, completeTask } from '../../services/taskService'
import { useToast } from '../../components/common/Toast'
import { Skeleton, EmptyState } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import TaskItem from '../../components/TaskItem'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/format'

function StatCard({ icon: Icon, label, value, tone, sub, delay }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100',
  }
  return (
    <div className="card p-4 transition-all duration-200 hover:shadow-card-hover sm:p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${tones[tone]}`}>
          <Icon size={20} weight="duotone" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900">{value}</p>
      <p className="text-sm font-semibold text-navy-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-navy-400">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
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
    toast.success(res.data.nextTask ? 'Đã hoàn thành – đã tạo lần lặp kế tiếp' : 'Đã hoàn thành công việc')
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
        <h1 className="page-title">Xin chào, {user?.fullName?.split(' ').slice(-1)[0]}! 👋</h1>
        <p className="mt-1 text-sm font-medium text-navy-400">{today}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDots} label="Công việc hôm nay" value={data.todayCount} tone="blue" sub="Chưa hoàn thành hôm nay" delay={0} />
        <StatCard icon={WarningCircle} label="Quá hạn" value={data.overdueCount} tone="amber" sub="Cần xử lý sớm" delay={60} />
        <StatCard icon={CheckCircle} label="Đã hoàn thành" value={data.completedCount} tone="emerald" sub="Tổng cộng" delay={120} />
        <StatCard icon={Sparkle} label="Sắp tới" value={data.upcomingCount} tone="purple" sub="Từ ngày mai" delay={180} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Công việc hôm nay */}
        <section className="card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-navy-900">
              <CalendarDots size={18} weight="fill" className="text-blue-600" />
              Lịch trình hôm nay
            </h2>
            <Link to="/app/tasks" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
              Xem tất cả <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
          <div className="mt-4 space-y-2.5">
            {data.todayTasks.length === 0 ? (
              <EmptyState
                icon={Sparkle}
                title="Hôm nay bạn rảnh rỗi 🎉"
                description="Không có công việc nào cần làm hôm nay. Hãy tận hưởng hoặc lên kế hoạch cho ngày mai."
                action={
                  <Link to="/app/tasks/new">
                    <Button variant="gradient" size="sm" icon={Plus}>
                      Tạo công việc mới
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
            <h2 className="flex items-center gap-2 font-bold text-navy-900">
              <WarningCircle size={18} weight="fill" className="text-amber-500" />
              Công việc quá hạn
            </h2>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
              {data.overdueCount} việc
            </span>
          </div>
          <div className="mt-4 space-y-2.5">
            {data.overdueTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="Không có việc quá hạn"
                description="Bạn đang bám sát kế hoạch. Tiếp tục nhé!"
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
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-navy-900 p-5 text-white sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient">
            <BellRinging size={22} weight="bold" className="animate-alarm-bell" />
          </span>
          <div>
            <p className="font-bold">Đừng quên thử tính năng cốt lõi</p>
            <p className="mt-0.5 text-sm text-navy-300">
              Bấm chuông ở góc trên bên phải để mô phỏng báo thức toàn màn hình – hoàn toàn miễn phí.
            </p>
          </div>
        </div>
        <Link to="/app/tasks">
          <Button variant="gradient" size="sm" icon={BellRinging}>
            Thử báo thức
          </Button>
        </Link>
      </div>
    </div>
  )
}
