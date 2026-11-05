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
import { useAuth } from '../../context/AuthContext'
import { RoomButton, RoomCard, RoomSkeleton } from '../../components/common/RoomUI'

const REASON_LABELS = {
  DAILY_LOGIN: 'Đăng nhập hằng ngày',
  STREAK_BONUS: 'Thưởng chuỗi ngày',
  INVITE: 'Mời bạn bè',
  REDEEM_REWARD: 'Đổi thưởng',
}

// Trạng thái lời mời trên da phòng: "Đã thưởng" là hoàn thành — Sage; "Chờ kích
// hoạt" và "Không hợp lệ" là chờ/lỗi — Rain. Nhãn giữ nguyên.
const STATUS_META = {
  PENDING: { label: 'Chờ kích hoạt', cls: 'bg-room-rain/40 text-room-ink/70 ring-room-rain' },
  CREDITED: { label: 'Đã thưởng ✓', cls: 'bg-room-sage/45 text-room-ink ring-room-acorn/20' },
  REJECTED: { label: 'Không hợp lệ', cls: 'bg-room-rain/60 text-room-ink/80 ring-room-rain' },
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
        <RoomSkeleton className="h-9 w-64" />
        <RoomSkeleton className="h-44" />
        <div className="grid gap-4 md:grid-cols-2">
          <RoomSkeleton className="h-72" />
          <RoomSkeleton className="h-72" />
        </div>
      </div>
    )
  }

  const inviteLink = buildInviteLink(data.inviteCode)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-room-ink">Phần thưởng</h1>
        <p className="mt-1 text-sm font-semibold text-room-ink/50">
          Đăng nhập mỗi ngày, mời bạn bè và đổi điểm lấy gói trả phí miễn phí.
        </p>
      </div>

      {/* Hero: streak + points — đĩa chuỗi ngày mang màu Bell, số điểm trên giấy */}
      <RoomCard className="relative overflow-hidden p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-room-bell/25 ring-1 ring-inset ring-room-bell/40">
              <Flame size={42} weight="fill" className="text-room-bell" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-5xl font-bold tracking-tight text-room-ink">{data.loginStreak}</span>
                <span className="text-sm font-extrabold text-room-bell">ngày liên tiếp</span>
              </div>
              <p className="mt-0.5 text-sm font-semibold text-room-ink/55">
                {data.todayClaimed
                  ? `Đã nhận điểm hôm nay ✓ · mốc kế tiếp: ${data.nextStreakMilestone} ngày`
                  : 'Đăng nhập hôm nay để nhận +10 điểm!'}
              </p>
            </div>
          </div>            <div className="flex items-center gap-5 rounded-2xl bg-room-oat/50 px-6 py-4 ring-1 ring-inset ring-room-acorn/20 transition-all duration-500 hover:bg-room-oat/70">
            <Gift size={28} weight="duotone" className="text-room-acorn" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-room-ink/50">Điểm của bạn</p>
              <p className="font-display text-3xl font-bold text-room-ink">{data.points} <span className="text-sm font-bold text-room-ink/50">điểm</span></p>
            </div>
            <Link
              to="/app/billing"
              className="ml-2 hidden items-center gap-1 rounded-full bg-room-paper px-3 py-2 text-xs font-bold text-room-ink ring-1 ring-room-acorn/40 transition hover:bg-room-oat/70 sm:flex"
            >
              Gói của tôi <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
        </div>

        {/* 7 ngày gần nhất: ngày có điểm là cốc chuông Bell — không gradient lửa */}
        <div className="relative mt-6 flex items-center justify-between gap-1 sm:justify-start sm:gap-2">
          {days.map((d) => (
            <div
              key={d.date.toISOString()}              className={`flex w-10 cursor-default flex-col items-center rounded-xl py-2 transition-all duration-300 hover:-translate-y-1 sm:w-12 ${d.filled
                  ? 'bg-room-bell/40 text-room-ink ring-1 ring-inset ring-room-bell/50'
                  : d.isToday
                    ? 'bg-room-oat/50 text-room-ink/70 ring-1 ring-inset ring-room-acorn/25'
                    : 'bg-room-rain/40 text-room-ink/35'
              }`}
            >
              <span className="text-[10px] font-bold">{d.weekday}</span>
              <span className="text-sm font-extrabold">{d.day}</span>
              <span className="text-[10px]">{d.filled ? '🔥' : d.isToday ? '·' : ''}</span>
            </div>
          ))}
        </div>
      </RoomCard>

      {/* Luật chơi */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: CheckCircle, title: `+${data.rules?.dailyLogin ?? 10} điểm / ngày`, desc: 'Đăng nhập mỗi ngày là có điểm', bell: false },
          { icon: Flame, title: `+${data.rules?.streakBonus ?? 50} điểm / 7 ngày`, desc: 'Chuỗi 7, 14, 21… ngày được thưởng', bell: true },
          { icon: UsersThree, title: `+${data.rules?.invite ?? 100} điểm / bạn`, desc: 'Bạn đăng ký mã mời + đăng nhập lần đầu', bell: false },
        ].map((r) => (
          <RoomCard key={r.title} className="group flex items-center gap-3 p-4">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                r.bell ? 'bg-room-bell/25 ring-room-bell/40 text-room-bell' : 'bg-room-oat/60 ring-room-acorn/20 text-room-acorn'
              }`}
            >
              <r.icon size={20} weight="duotone" />
            </span>
            <div>
              <p className="font-display font-bold text-room-ink">{r.title}</p>
              <p className="text-xs font-semibold text-room-ink/50">{r.desc}</p>
            </div>
          </RoomCard>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mời bạn bè */}
        <RoomCard className="p-5">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <UsersThree size={18} weight="fill" className="text-room-acorn" />
            Mời bạn bè
          </h2>
          <p className="mt-1 text-sm font-semibold text-room-ink/50">
            Gửi mã hoặc link này cho bạn bè — khi họ đăng ký và đăng nhập lần đầu, cả hai cùng có lợi.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 rounded-xl bg-room-oat/50 px-4 py-3 text-center font-mono text-lg font-extrabold tracking-[0.25em] text-room-ink ring-1 ring-inset ring-room-acorn/20">
              {data.inviteCode}
            </div>
            <RoomButton
              variant="secondary"
              size="md"
              icon={Copy}
              onClick={async () => {
                await copyText(data.inviteCode)
                toast.success('Đã sao chép mã mời')
              }}
            >
              Mã
            </RoomButton>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={inviteLink}
              className="w-full rounded-xl bg-room-oat/50 px-3 py-2 text-xs font-semibold text-room-ink/60 outline-none ring-1 ring-inset ring-room-acorn/15"
            />
            <RoomButton
              variant="secondary"
              size="md"
              icon={Copy}
              onClick={async () => {
                await copyText(inviteLink)
                toast.success('Đã sao chép link mời')
              }}
            >
              Link
            </RoomButton>
          </div>
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-room-rain/30 p-3 text-xs font-semibold leading-relaxed text-room-ink/75 ring-1 ring-inset ring-room-rain">
            <LockSimple size={14} weight="bold" className="mt-0.5 shrink-0" />
            Chống gian lận: 1 IP + 1 thiết bị chỉ tính 1 tài khoản cho cùng người mời — tài khoản ảo từ cùng máy sẽ không được thưởng.
          </p>

          <div className="mt-4">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-room-ink/45">
              Bạn đã mời ({data.invites.length})
            </p>
            {data.invites.length === 0 ? (
              <p className="rounded-xl bg-room-oat/40 p-4 text-center text-sm font-semibold text-room-ink/45">
                Chưa có ai đăng ký bằng mã của bạn.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.invites.map((inv) => {
                  const meta = STATUS_META[inv.status] || STATUS_META.PENDING
                  return (
                    <li key={inv.id} className="flex items-center justify-between gap-3 rounded-xl bg-room-oat/40 px-3.5 py-2.5 ring-1 ring-inset ring-room-acorn/15 transition-all duration-200 hover:translate-x-0.5 hover:bg-room-oat/70">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-room-ink/80">{inv.email}</p>
                        <p className="text-xs font-semibold text-room-ink/45">
                          {new Date(inv.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ring-inset ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </RoomCard>

        {/* Đổi thưởng */}
        <RoomCard className="p-5">
          <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
            <Gift size={18} weight="fill" className="text-room-acorn" />
            Đổi thưởng
          </h2>
          <p className="mt-1 text-sm font-semibold text-room-ink/50">
            Dùng điểm để mở gói trả phí — gia hạn cộng dồn khi gói cùng loại còn hạn.
          </p>

          <div className="mt-4 space-y-3">
            {data.tiers.map((tier) => {
              const pct = Math.min(100, Math.round((tier.progress / tier.points) * 100))
              return (                <div
                  key={tier.id}
                  className={`group rounded-2xl p-4 ring-1 ring-inset transition-all duration-300 hover:-translate-y-0.5 ${tier.plan === 'PRO'
                      ? 'bg-room-oat/55 ring-room-acorn/35 hover:ring-room-acorn/60'
                      : 'bg-room-oat/35 ring-room-acorn/20 hover:ring-room-acorn/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 font-display text-sm font-bold text-room-ink">
                        {tier.plan === 'PRO' && <Sparkle size={14} weight="fill" className="text-room-bell" />}
                        {tier.name}
                      </p>
                      <p className="text-xs font-semibold text-room-ink/50">{tier.description}</p>
                    </div>
                    <RoomButton size="sm" disabled={!tier.canClaim || claiming === tier.id} loading={claiming === tier.id} onClick={() => onClaim(tier)}>
                      {tier.canClaim ? 'Nhận thưởng' : `${tier.points}đ`}
                    </RoomButton>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-room-oat/70">
                    {/* Thanh tiến độ solid Acorn — trước đây là gradient tím/xanh theo gói */}
                    <div
                      className="h-full rounded-full bg-room-acorn transition-all duration-700"
                      style={{ width: `${pct}%`, opacity: tier.plan === 'PRO' ? 1 : 0.75 }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] font-semibold text-room-ink/45">
                    {tier.progress}/{tier.points} điểm
                  </p>
                </div>
              )
            })}
          </div>

          {data.claimed.length > 0 && (
            <div className="mt-4 rounded-xl bg-room-sage/25 p-3 ring-1 ring-inset ring-room-acorn/20">
              <p className="text-xs font-extrabold uppercase tracking-wider text-room-ink/50">Đã đổi gần đây</p>
              <ul className="mt-1.5 space-y-1">
                {data.claimed.slice(0, 5).map((c, i) => (
                  <li key={i} className="flex items-center justify-between text-xs font-semibold text-room-ink/70">
                    <span>{c.note}</span>
                    <span>{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </RoomCard>
      </div>

      {/* Lịch sử điểm */}
      <RoomCard className="p-5">
        <h2 className="flex items-center gap-2 font-display font-bold text-room-ink">
          <ClockCounterClockwise size={18} weight="fill" className="text-room-rain" />
          Lịch sử điểm
        </h2>
        <div className="mt-3 space-y-1.5">
          {data.transactions.length === 0 ? (
            <p className="rounded-xl bg-room-oat/40 p-4 text-center text-sm font-semibold text-room-ink/45">
              Chưa có giao dịch nào. Đăng nhập mỗi ngày để bắt đầu tích điểm!
            </p>
          ) : (
            data.transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl bg-room-oat/40 px-3.5 py-2.5 ring-1 ring-inset ring-room-acorn/15 transition-all duration-200 hover:translate-x-0.5 hover:bg-room-oat/70">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${
                      tx.amount > 0 ? 'bg-room-oat/70 text-room-ink/75 ring-1 ring-inset ring-room-acorn/25' : 'bg-room-rain/50 text-room-ink/75 ring-1 ring-inset ring-room-rain'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-room-ink/80">{tx.note || REASON_LABELS[tx.reason] || tx.reason}</p>
                    <p className="text-[11px] font-semibold text-room-ink/45">
                      {new Date(tx.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </RoomCard>

      <p className="text-center text-xs font-semibold text-room-ink/40">
        Điểm có thể được điều chỉnh bởi nhà vận hành · {user?.email}
      </p>
    </div>
  )
}