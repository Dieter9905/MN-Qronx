import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Crown, Rocket, Sparkle, ArrowRight, ShieldCheck } from '@phosphor-icons/react'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { Logo } from '../../components/Logo'
import { formatVnd } from '../../lib/format'
import { PLANS as FALLBACK_PLANS, PLAN_NAMES, PLAN_BADGE, BILLING_CYCLES } from '../../lib/constants'
import { getProducts } from '../../services/billingService'

const PLAN_ICON = { FREE: Sparkle, PLUS: Rocket, PRO: Crown }
const PLAN_ICON_COLOR = {
  FREE: 'bg-slate-100 text-slate-600',
  PLUS: 'bg-blue-50 text-blue-600',
  PRO: 'bg-violet-50 text-violet-600',
}

export default function PricingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState(FALLBACK_PLANS)
  const [cycle, setCycle] = useState('MONTHLY')
  const [trialDays, setTrialDays] = useState(7)
  const current = user?.plan || 'FREE'

  // Bảng giá lấy từ máy chủ (nguồn duy nhất) — không gọi được thì dùng bản dự phòng
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await getProducts()
      if (!cancelled && res.success && res.data?.plans?.length) {
        setPlans(res.data.plans)
        if (res.data.payments?.trialDays !== undefined) setTrialDays(res.data.payments.trialDays)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const open = (planId) => {
    if (!user) {
      navigate('/register')
      return
    }
    navigate('/app/billing', { state: { plan: planId, cycle } })
  }

  return (
    <div className="min-h-dvh bg-white text-navy-900 dark:bg-navy-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-navy-950/90">
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
                <Button variant="ghost" size="sm" className="text-navy-700 dark:text-slate-200" onClick={() => navigate('/login')}>
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
        <div className="pt-16 pb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 ring-1 ring-blue-100 dark:bg-white/5 dark:text-cyan-300 dark:ring-white/10">
            <Crown size={14} weight="fill" /> Bảng giá MN-Qronx
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Chọn gói phù hợp{' '}
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-violet-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-cyan-400 dark:to-violet-400">
              với cách bạn làm việc
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-500 dark:text-slate-400">
            Bắt đầu miễn phí — đủ để nhắc việc mỗi ngày, kể cả công việc lặp lại. Nâng cấp khi bạn cần thêm
            {' '}{trialDays} ngày dùng thử Pro miễn phí, huỷ bất kỳ lúc nào.
          </p>

          <div className="mt-6 inline-flex rounded-xl bg-navy-100 p-1 dark:bg-white/10">
            {BILLING_CYCLES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCycle(c.id)}
                className={`rounded-lg px-4 py-2 text-sm font-extrabold transition ${
                  cycle === c.id
                    ? 'bg-white text-navy-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-navy-500 hover:text-navy-800 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {c.label}
                {c.note && <span className="ml-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{c.note}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const Icon = PLAN_ICON[p.id] || Sparkle
            const isCurrent = Boolean(user) && current === p.id
            const price = cycle === 'YEARLY' ? p.priceYearly : p.priceMonthly
            const isFree = p.id === 'FREE'
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-3xl bg-white p-7 shadow-card ring-1 transition dark:bg-white/[0.04] dark:shadow-none dark:backdrop-blur ${
                  isCurrent
                    ? 'ring-2 ring-blue-500 dark:ring-blue-400'
                    : p.popular
                      ? 'bg-gradient-to-b from-blue-50 to-violet-50 ring-cyan-500/50 dark:from-blue-500/[0.12] dark:to-violet-500/[0.06] dark:ring-cyan-400/60'
                      : 'ring-navy-100 hover:ring-navy-200 dark:ring-white/10 dark:hover:ring-white/25'
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
                <h2 className="mt-4 text-2xl font-extrabold">{p.label || PLAN_NAMES[p.id]}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{p.tagline}</p>
                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold tracking-tight">{isFree ? '0đ' : formatVnd(price)}</span>
                  {!isFree && (
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      /{cycle === 'YEARLY' ? 'năm' : 'tháng'}
                    </span>
                  )}
                </p>
                {!isFree && cycle === 'YEARLY' && (
                  <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ≈ {formatVnd(Math.round(price / 12))}/tháng — tiết kiệm 2 tháng
                  </p>
                )}
                <ul className="mt-6 flex-1 space-y-3">
                  {(p.features || []).map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-navy-600 dark:text-slate-300">
                      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
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
                  ) : isFree ? (
                    <Button variant="secondary" fullWidth onClick={() => navigate(user ? '/app' : '/register')} icon={user ? undefined : Sparkle}>
                      {user ? 'Mở ứng dụng' : 'Bắt đầu miễn phí'}
                    </Button>
                  ) : (
                    <Button
                      variant={p.popular ? 'gradient' : 'primary'}
                      fullWidth
                      icon={user ? Crown : ArrowRight}
                      onClick={() => open(p.id)}
                    >
                      {user ? `Nâng cấp ${p.label || PLAN_NAMES[p.id]}` : `Đăng ký để dùng ${p.label || PLAN_NAMES[p.id]}`}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          <Assurance
            icon={ShieldCheck}
            title="Thanh toán an toàn"
            text="Chuyển khoản ngân hàng qua mã VietQR, đúng số tiền và nội dung là gói được kích hoạt."
          />
          <Assurance
            icon={Sparkle}
            title="Thử trước khi trả tiền"
            text={`${trialDays} ngày dùng thử gói Pro, không cần thẻ, không tự động trừ tiền.`}
          />
          <Assurance
            icon={Crown}
            title="Không ràng buộc"
            text="Gói theo kỳ 30 ngày hoặc 1 năm. Hết kỳ không gia hạn thì tự về gói Miễn phí, dữ liệu vẫn còn."
          />
        </div>

        <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Trả theo năm để được tặng 2 tháng, hoặc nhắn cho chúng tôi nếu bạn cần hoá đơn cho công ty.
        </p>
      </main>
    </div>
  )
}

function Assurance({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl bg-navy-50 p-5 ring-1 ring-navy-100 dark:bg-white/[0.04] dark:ring-white/10">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-white/10 dark:text-cyan-300">
        <Icon size={20} weight="fill" />
      </span>
      <p className="mt-3 text-sm font-extrabold text-navy-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-navy-500 dark:text-slate-400">{text}</p>
    </div>
  )
}
