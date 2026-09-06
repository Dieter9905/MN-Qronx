import { useState } from 'react'
import { Check, Crown, Rocket, Sparkle } from '@phosphor-icons/react'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { upgradePlan } from '../../services/planService'
import { PLANS, PLAN_BADGE, PLAN_NAMES } from '../../lib/constants'

const PLAN_ICON = { FREE: Sparkle, PLUS: Rocket, PRO: Crown }
const PLAN_ICON_COLOR = {
  FREE: 'bg-slate-100 text-slate-600',
  PLUS: 'bg-blue-50 text-blue-600',
  PRO: 'bg-violet-50 text-violet-600',
}

export default function BillingPage() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const current = user?.plan || 'FREE'

  const doUpgrade = async (planId) => {
    if (planId === current) return
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

  const isCurrentOrAbove = (planId) => {
    const rank = { FREE: 0, PLUS: 1, PRO: 2 }
    return rank[planId] <= rank[current]
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title dark:text-white">Gói của bạn</h1>
        <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
          Chọn gói phù hợp để mở rộng giới hạn và bật các tính năng nâng cao
        </p>
      </div>

      {/* Gói hiện tại */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-gradient p-5 text-white shadow-card sm:p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
          {(() => {
            const Icon = PLAN_ICON[current]
            return <Icon size={26} weight="fill" />
          })()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">Gói hiện tại</p>
          <p className="text-xl font-extrabold">{PLAN_NAMES[current] || current}</p>
        </div>
        {current !== 'PRO' && (
          <div className="w-full sm:w-auto">
            <Button
              variant="light"
              icon={Crown}
              onClick={() => doUpgrade('PRO')}
              loading={busy === 'PRO'}
            >
              Nâng cấp lên Pro
            </Button>
          </div>
        )}
      </div>

      {/* Danh sách gói */}
      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => {
          const Icon = PLAN_ICON[p.id]
          const isCurrent = current === p.id
          const active = isCurrentOrAbove(p.id)
          const needsUpgrade = !active && p.id !== 'FREE'
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl bg-white p-6 shadow-card ring-1 transition dark:bg-slate-800 ${
                isCurrent
                  ? 'ring-2 ring-blue-500 dark:ring-blue-500'
                  : p.popular
                    ? 'ring-2 ring-cyan-400 dark:ring-cyan-400'
                    : 'ring-navy-100 dark:ring-slate-700'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md">
                  Phổ biến nhất
                </span>
              )}
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${PLAN_ICON_COLOR[p.id]}`}>
                <Icon size={24} weight="fill" />
              </span>
              <h2 className="mt-4 text-xl font-extrabold text-navy-900 dark:text-white">{p.label}</h2>
              <p className="mt-1 text-sm text-navy-400 dark:text-slate-500">{p.tagline}</p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-navy-900 dark:text-white">{p.price}</span>
                {p.period !== 'mãi mãi' && (
                  <span className="text-sm font-semibold text-navy-400 dark:text-slate-500">{p.period}</span>
                )}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-navy-600 dark:text-slate-300">
                    <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                      <Check size={11} weight="bold" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <Button variant="secondary" fullWidth disabled icon={Sparkle}>
                    Gói hiện tại
                  </Button>
                ) : needsUpgrade ? (
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
                  <Button variant="secondary" fullWidth disabled>
                    Đã bao gồm trong gói {PLAN_NAMES[current]}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-navy-400 dark:text-slate-500">
        💡 Đây là bản nâng cấp mô phỏng phục vụ demo – gói được kích hoạt ngay sau khi bấm nút.
        Admin có thể đổi gói bất kỳ tài khoản nào trong khu vực quản trị.
      </p>
    </div>
  )
}