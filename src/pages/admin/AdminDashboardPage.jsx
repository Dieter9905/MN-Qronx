import { useEffect, useState } from 'react'
import {
  UsersThree,
  UserCheck,
  ListChecks,
  BellRinging,
  ChartBar,
} from '@phosphor-icons/react'
import { getAdminDashboard } from '../../services/adminService'
import { getNotificationStats } from '../../services/notificationService'
import { Skeleton } from '../../components/common/Feedback'

function StatCard({ icon: Icon, label, value, tone, delay }) {
  const tones = {
    blue: 'bg-blue-500/15 text-blue-400',
    emerald: 'bg-emerald-500/15 text-emerald-400',
    purple: 'bg-purple-500/15 text-purple-400',
    amber: 'bg-amber-500/15 text-amber-400',
  }
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={22} weight="duotone" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900">{value}</p>
      <p className="text-sm font-semibold text-navy-500">{label}</p>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null)
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [dRes, sRes] = await Promise.all([getAdminDashboard(), getNotificationStats(7)])
      if (dRes.success) setData(dRes.data)
      if (sRes.success) setStats(sRes.data)
      setLoading(false)
    })()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }

  const maxCount = Math.max(1, ...stats.map((s) => s.count))
  const statusBars = [
    { label: 'Chưa làm', value: data.tasksByStatus.TODO, color: '#64748b' },
    { label: 'Đang làm', value: data.tasksByStatus.IN_PROGRESS, color: '#2563EB' },
    { label: 'Hoàn thành', value: data.tasksByStatus.COMPLETED, color: '#10B981' },
    { label: 'Đã hủy', value: data.tasksByStatus.CANCELLED, color: '#F43F5E' },
  ]
  const totalStatus = Math.max(1, statusBars.reduce((s, b) => s + b.value, 0))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Dashboard hệ thống</h1>
        <p className="mt-1 text-sm font-medium text-navy-400">Tổng quan hoạt động của MN-Qronx</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={UsersThree} label="Tổng số người dùng" value={data.totalUsers} tone="blue" delay={0} />
        <StatCard icon={UserCheck} label="Đang hoạt động" value={data.activeUsers} tone="emerald" delay={60} />
        <StatCard icon={ListChecks} label="Tổng số công việc" value={data.totalTasks} tone="purple" delay={120} />
        <StatCard icon={BellRinging} label="Thông báo hôm nay" value={data.notificationsToday} tone="amber" delay={180} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Biểu đồ 7 ngày */}
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100">
          <h2 className="flex items-center gap-2 font-bold text-navy-900">
            <ChartBar size={18} weight="fill" className="text-blue-600" />
            Thông báo đã gửi – 7 ngày gần nhất
          </h2>
          <div className="mt-5 flex h-48 items-end gap-2.5">
            {stats.map((s, i) => (
              <div key={i} className="group flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-bold text-navy-600">{s.count}</span>
                <div
                  className="w-full rounded-t-lg bg-brand-gradient transition-all duration-500 group-hover:opacity-80"
                  style={{ height: `${Math.max(6, (s.count / maxCount) * 140)}px` }}
                  title={`${s.label}: ${s.count} thông báo`}
                />
                <span className="text-[10px] font-semibold text-navy-400">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Phân bố công việc */}
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100">
          <h2 className="flex items-center gap-2 font-bold text-navy-900">
            <ListChecks size={18} weight="fill" className="text-purple-500" />
            Phân bố trạng thái công việc
          </h2>
          <div className="mt-5 space-y-4">
            {statusBars.map((b) => (
              <div key={b.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-navy-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} aria-hidden="true" />
                    {b.label}
                  </span>
                  <span className="font-bold text-navy-900">
                    {b.value} <span className="text-xs font-medium text-navy-400">({Math.round((b.value / totalStatus) * 100)}%)</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-navy-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(b.value / totalStatus) * 100}%`, backgroundColor: b.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-navy-400">
            Tổng cộng {data.totalNotifications} thông báo đã gửi từ khi hệ thống đi vào hoạt động.
          </p>
        </section>
      </div>
    </div>
  )
}
