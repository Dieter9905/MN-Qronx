import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Flame,
  Gift,
  UsersThree,
  CheckCircle,
  Copy,
  ArrowRight,
  ClockCounterClockwise,
  LockSimple,
  Sparkle,
} from '@phosphor-icons/react'
import { getRewardsOverview, claimReward, buildInviteLink } from '../../services/rewardService'
import { useToast } from '../../components/common/Toast'
import { Skeleton } from '../../components/common/Feedback'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'

const REASON_LABELS = {
  DAILY_LOGIN: 'Đăng nhập hằng ngày',
  STREAK_BONUS: 'Thưởng chuỗi ngày',
  INVITE: 'Mời bạn bè',
  REDEEM_REWARD: 'Đổi thưởng',
}

const STATUS_META = {
  PENDING: { label: 'Chờ kích hoạt', cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/50' },
  CREDITED: { label: 'Đã thưởng ✓', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50' },
  REJECTED: { label: 'Không hợp lệ', cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/50' },
}

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  return Promise.resolve()
}

export default function RewardsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(null)

  const load = async () => {
    const res = await getRewardsOverview()
    if (res.success) setData(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const days = useMemo(() => {
    if (!data) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const lastDay = data.lastLoginDate ? new Date(data.lastLoginDate) : null
    if (lastDay) lastDay.setHours(0, 0, 0, 0)
    const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      let filled = false
      if (lastDay && lastDay <= d) {
        const diff = Math.round((lastDay - d) / 86400000)
        filled = diff >= 0 && diff < data.loginStreak
      }
      return { date: d, weekday: weekdays[d.getDay()], day: d.getDate(), filled, isToday: d.getTime() === today.getTime() }
    })
  }, [data])

  const onClaim = async (tier) => {
    setClaiming(tier.id)
    const res = await claimReward(tier.id)
    setClaiming(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(`Đã đổi: ${tier.name} 🎉`)
    load()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-44" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  const inviteLink = buildInviteLink(data.inviteCode)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title dark:text-white">Phần thưởng</h1>
        <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
          Đăng nhập mỗi ngày, mời bạn bè và đổi điểm lấy gói trả phí miễn phí.
        </p>
      </div>

      {/* Hero: streak + points */}
      <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 to-navy-900 p-6 text-white transition-all duration-500 hover:-translate-y-1 hover:shadow-glow-purple dark:from-slate-700 dark:to-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl transition-transform duration-700 group-hover:scale-125" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl transition-transform duration-700 group-hover:scale-125" aria-hidden="true" />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-amber-400 shadow-glow-purple transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105">
              <Flame size={42} weight="fill" className="text-white" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight">{data.loginStreak}</span>
                <span className="text-sm font-bold text-orange-300">ngày liên tiếp</span>
              </div>
              <p className="mt-0.5 text-sm text-navy-300">
                {data.todayClaimed
                  ? `Đã nhận điểm hôm nay ✓ · mốc kế tiếp: ${data.nextStreakMilestone} ngày`
                  : 'Đăng nhập hôm nay để nhận +10 điểm!'}
              </p>
            </div>
          </div>            <div className="flex items-center gap-5 rounded-2xl bg-white/10 px-6 py-4 ring-1 ring-white/15 backdrop-blur transition-all duration-500 hover:bg-white/20 hover:ring-white/30">
            <Gift size={28} weight="duotone" className="text-amber-300" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-navy-300">Điểm của bạn</p>
              <p className="text-3xl font-extrabold">{data.points} <span className="text-sm font-bold text-navy-300">điểm</span></p>
            </div>
            <Link
              to="/app/billing"
              className="ml-2 hidden items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20 sm:flex"
            >
              Gói của tôi <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
        </div>

        {/* 7 ngày gần nhất */}
        <div className="relative mt-6 flex items-center justify-between gap-1 sm:justify-start sm:gap-2">
          {days.map((d) => (
            <div
              key={d.date.toISOString()}              className={`flex w-10 cursor-default flex-col items-center rounded-xl py-2 transition-all duration-300 hover:-translate-y-1 hover:scale-105 sm:w-12 ${d.filled
                  ? 'bg-gradient-to-b from-orange-500/80 to-red-500/60 text-white'
                  : d.isToday
                    ? 'bg-white/10 text-white ring-1 ring-white/25'
                    : 'bg-white/5 text-navy-300'
              }`}
            >
              <span className="text-[10px] font-bold">{d.weekday}</span>
              <span className="text-sm font-extrabold">{d.day}</span>
              <span className="text-[10px]">{d.filled ? '🔥' : d.isToday ? '·' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Luật chơi */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: CheckCircle, title: `+${data.rules?.dailyLogin ?? 10} điểm / ngày`, desc: 'Đăng nhập mỗi ngày là có điểm' },
          { icon: Flame, title: `+${data.rules?.streakBonus ?? 50} điểm / 7 ngày`, desc: 'Chuỗi 7, 14, 21… ngày được thưởng' },
          { icon: UsersThree, title: `+${data.rules?.invite ?? 100} điểm / bạn`, desc: 'Bạn đăng ký mã mời + đăng nhập lần đầu' },
        ].map((r) => (
          <div key={r.title} className="card group flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800/50">
              <r.icon size={20} weight="duotone" />
            </span>
            <div>
              <p className="text-sm font-bold text-navy-900 dark:text-white">{r.title}</p>
              <p className="text-xs text-navy-400 dark:text-slate-500">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mời bạn bè */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
            <UsersThree size={18} weight="fill" className="text-blue-600 dark:text-blue-400" />
            Mời bạn bè
          </h2>
          <p className="mt-1 text-sm text-navy-400 dark:text-slate-500">
            Gửi mã hoặc link này cho bạn bè — khi họ đăng ký và đăng nhập lần đầu, cả hai cùng có lợi.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 rounded-xl bg-navy-50 px-4 py-3 text-center font-mono text-lg font-extrabold tracking-[0.25em] text-blue-700 ring-1 ring-inset ring-navy-100 dark:bg-slate-800 dark:text-blue-400 dark:ring-slate-700">
              {data.inviteCode}
            </div>
            <Button
              variant="secondary"
              size="md"
              icon={Copy}
              onClick={async () => {
                await copyText(data.inviteCode)
                toast.success('Đã sao chép mã mời')
              }}
            >
              Mã
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={inviteLink}
              className="w-full rounded-xl border-0 bg-navy-50 px-3 py-2 text-xs text-navy-500 outline-none ring-1 ring-inset ring-navy-100 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
            />
            <Button
              variant="secondary"
              size="md"
              icon={Copy}
              onClick={async () => {
                await copyText(inviteLink)
                toast.success('Đã sao chép link mời')
              }}
            >
              Link
            </Button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800/50">
            <LockSimple size={14} weight="bold" className="mt-0.5 shrink-0" />
            Chống gian lận: 1 IP + 1 thiết bị chỉ tính 1 tài khoản cho cùng người mời — tài khoản ảo từ cùng máy sẽ không được thưởng.
          </p>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
              Bạn đã mời ({data.invites.length})
            </p>
            {data.invites.length === 0 ? (
              <p className="rounded-xl bg-navy-50 p-4 text-center text-sm text-navy-400 dark:bg-slate-800 dark:text-slate-500">
                Chưa có ai đăng ký bằng mã của bạn.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.invites.map((inv) => {
                  const meta = STATUS_META[inv.status] || STATUS_META.PENDING
                  return (
                    <li key={inv.id} className="flex items-center justify-between gap-3 rounded-xl bg-navy-50 px-3.5 py-2.5 transition-all duration-200 hover:translate-x-0.5 hover:bg-navy-100/80 dark:bg-slate-800 dark:hover:bg-slate-700/80">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-800 dark:text-slate-200">{inv.email}</p>
                        <p className="text-xs text-navy-400 dark:text-slate-500">
                          {new Date(inv.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Đổi thưởng */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
            <Gift size={18} weight="fill" className="text-amber-500 dark:text-amber-400" />
            Đổi thưởng
          </h2>
          <p className="mt-1 text-sm text-navy-400 dark:text-slate-500">
            Dùng điểm để mở gói trả phí — gia hạn cộng dồn khi gói cùng loại còn hạn.
          </p>

          <div className="mt-4 space-y-3">
            {data.tiers.map((tier) => {
              const pct = Math.min(100, Math.round((tier.progress / tier.points) * 100))
              return (                <div
                  key={tier.id}
                  className={`group rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${tier.plan === 'PRO'
                      ? 'border-violet-200 bg-violet-50/50 hover:border-violet-300 hover:shadow-glow-purple dark:border-violet-900 dark:bg-violet-900/10'
                      : 'border-blue-100 bg-blue-50/40 hover:border-blue-300 hover:shadow-glow-blue dark:border-blue-900 dark:bg-blue-900/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-navy-900 dark:text-white">
                        {tier.plan === 'PRO' && <Sparkle size={14} weight="fill" className="text-violet-500" />}
                        {tier.name}
                      </p>
                      <p className="text-xs text-navy-400 dark:text-slate-500">{tier.description}</p>
                    </div>
                    <Button
                      variant={tier.plan === 'PRO' ? 'gradient' : 'primary'}
                      size="sm"
                      disabled={!tier.canClaim || claiming === tier.id}
                      loading={claiming === tier.id}
                      onClick={() => onClaim(tier)}
                    >
                      {tier.canClaim ? 'Nhận thưởng' : `${tier.points}đ`}
                    </Button>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-100 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${tier.plan === 'PRO' ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] font-semibold text-navy-400 dark:text-slate-500">
                    {tier.progress}/{tier.points} điểm
                  </p>
                </div>
              )
            })}
          </div>

          {data.claimed.length > 0 && (
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/20 dark:ring-emerald-800/50">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Đã đổi gần đây</p>
              <ul className="mt-1.5 space-y-1">
                {data.claimed.slice(0, 5).map((c, i) => (
                  <li key={i} className="flex items-center justify-between text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <span>{c.note}</span>
                    <span>{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Lịch sử điểm */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-bold text-navy-900 dark:text-white">
          <ClockCounterClockwise size={18} weight="fill" className="text-navy-400" />
          Lịch sử điểm
        </h2>
        <div className="mt-3 space-y-1.5">
          {data.transactions.length === 0 ? (
            <p className="rounded-xl bg-navy-50 p-4 text-center text-sm text-navy-400 dark:bg-slate-800 dark:text-slate-500">
              Chưa có giao dịch nào. Đăng nhập mỗi ngày để bắt đầu tích điểm!
            </p>
          ) : (
            data.transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl bg-navy-50 px-3.5 py-2.5 transition-all duration-200 hover:translate-x-0.5 hover:bg-navy-100/80 dark:bg-slate-800 dark:hover:bg-slate-700/80">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${
                      tx.amount > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy-800 dark:text-slate-200">{tx.note || REASON_LABELS[tx.reason] || tx.reason}</p>
                    <p className="text-[11px] text-navy-400 dark:text-slate-500">
                      {new Date(tx.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <p className="text-center text-xs text-navy-300 dark:text-slate-600">
        Điểm có thể được điều chỉnh bởi nhà vận hành · {user?.email}
      </p>
    </div>
  )
}