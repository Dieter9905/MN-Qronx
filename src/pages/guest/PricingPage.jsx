import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Crown, Rocket, Sparkle, ArrowRight } from '@phosphor-icons/react'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { upgradePlan } from '../../services/planService'
import { Logo } from '../../components/Logo'
import { PLANS, PLAN_NAMES, PLAN_BADGE } from '../../lib/constants'

const PLAN_ICON = { FREE: Sparkle, PLUS: Rocket, PRO: Crown }
const PLAN_ICON_COLOR = {
  FREE: 'bg-slate-100 text-slate-600',
  PLUS: 'bg-blue-50 text-blue-600',
  PRO: 'bg-violet-50 text-violet-600',
}

export default function PricingPage() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(null)
  const current = user?.plan || 'FREE'

  const doUpgrade = async (planId) => {
    if (!user) {
      navigate('/register')
      return
    }
    setBusy(planId)
    const res = await upgradePlan(planId)
    setBusy(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    await refresh()
    toast.success(`Chúc mừng! Bạn đang dùng gói ${PLAN_NAMES[planId]} 🎉`)
  }

  return (
    <div className="min-h-dvh bg-navy-950 text-white">
      {/* Thanh trên */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="MN-Qronx – Trang chủ">
            <Logo size={34} />
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${PLAN_BADGE[current]}`}>
                  Gói {PLAN_NAMES[current]}
                </span>
                <Button variant="light" size="sm" onClick={() => navigate(user.role === 'ADMIN' ? '/admin' : '/app')}>
                  Mở ứng dụng
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="text-slate-200" onClick={() => navigate('/login')}>
                  Đăng nhập
                </Button>
                <Button variant="gradient" size="sm" onClick={() => navigate('/register')}>
                  Đăng ký miễn phí
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {/* Hero */}
        <div className="pt-16 pb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300 ring-1 ring-white/10">
            <Crown size={14} weight="fill" />
            Bảng giá MN-Qronx
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Chọn gói phù hợp{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
              với cách bạn làm việc
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400">
            Bắt đầu miễn phí, nâng cấp khi cần thêm công việc, nhắc nhở và tính năng nâng cao.
            Hủy bất kỳ lúc nào – không ràng buộc.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => {
            const Icon = PLAN_ICON[p.id]
            const isCurrent = current === p.id
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-3xl bg-white/[0.04] p-7 ring-1 backdrop-blur transition ${
                  isCurrent
                    ? 'ring-2 ring-blue-400'
                    : p.popular
                      ? 'bg-gradient-to-b from-blue-500/[0.12] to-violet-500/[0.06] ring-cyan-400/60'
                      : 'ring-white/10 hover:ring-white/25'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md">
                    Phổ biến nhất
                  </span>
                )}
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${PLAN_ICON_COLOR[p.id]}`}>
                  <Icon size={24} weight="fill" />
                </span>
                <h2 className="mt-4 text-2xl font-extrabold">{p.label}</h2>
                <p className="mt-1 text-sm text-slate-400">{p.tagline}</p>
                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold tracking-tight">{p.price}</span>
                  <span className="text-sm font-semibold text-slate-500">{p.period}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-slate-300">
                      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check size={11} weight="bold" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  {isCurrent ? (
                    <Button variant="secondary" fullWidth disabled>
                      Gói hiện tại ✓
                    </Button>
                  ) : p.id === 'FREE' ? (
                    <Button
                      variant="light"
                      fullWidth
                      onClick={() => navigate(user ? '/app' : '/register')}
                      icon={user ? undefined : Sparkle}
                    >
                      {user ? 'Mở ứng dụng' : 'Bắt đầu miễn phí'}
                    </Button>
                  ) : user ? (
                    <Button
                      variant={p.popular ? 'gradient' : 'primary'}
                      fullWidth
                      icon={Crown}
                      loading={busy === p.id}
                      onClick={() => doUpgrade(p.id)}
                    >
                      Nâng cấp {p.label}
                    </Button>
                  ) : (
                    <Link to="/register" className="block">
                      <Button variant={p.popular ? 'gradient' : 'primary'} fullWidth icon={ArrowRight}>
                        Đăng ký để dùng {p.label}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          💡 Bản nâng cấp mô phỏng phục vụ demo – gói được kích hoạt ngay sau khi bấm nút. Thanh toán thật sẽ được kết nối sau.
        </p>
      </main>
    </div>
  )
}