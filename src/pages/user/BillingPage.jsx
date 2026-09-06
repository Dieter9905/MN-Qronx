import { useState } from 'react'
import { Check, Crown, Rocket, Sparkle, CalendarCheck, CalendarX, HourglassMedium, ArrowClockwise } from '@phosphor-icons/react'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { upgradePlan } from '../../services/planService'
import { PLANS, PLAN_BADGE, PLAN_NAMES } from '../../lib/constants'
import { formatDate } from '../../lib/format'

const PLAN_ICON = { FREE: Sparkle, PLUS: Rocket, PRO: Crown }
const PLAN_ICON_COLOR = {
  FREE: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  PLUS: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
  PRO: 'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
}
const RANK = { FREE: 0, PLUS: 1, PRO: 2 }

// Số ngày còn lại của gói (làm tròn lên, âm = đã hết hạn)
function daysRemaining(expiresAt, now = new Date()) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt) - now) / 86400000)
}

function expiryState(days) {
  if (days === null) return null
  if (days < 0) return 'expired'
  if (days <= 7) return 'urgent'
  return 'active'
}

const EXPIRY_UI = {
  expired: {
    label: 'Đã hết hạn',
    cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-700',
  },
  urgent: {
    label: '',
    cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700',
  },
  active: {
    label: '',
    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700',
  },
}

export default function BillingPage() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const current = user?.plan || 'FREE'
  const paid = current === 'PLUS' || current === 'PRO'
  const started = user?.planStartedAt || null
  const expiresAt = user?.planExpiresAt || null
  const days = paid ? daysRemaining(expiresAt) : null
  const state = paid ? expiryState(days) : null

  // Tiến độ kỳ đăng ký (phần trăm thời gian còn lại)
  const progress = paid && started && expiresAt && state !== 'expired'
    ? Math.max(0, Math.min(100, ((new Date(expiresAt) - Date.now()) / (new Date(expiresAt) - new Date(started))) * 100))
    : null

  const doUpgrade = async (planId) => {
    const renew = planId === current && paid
    setBusy(planId)
    const res = await upgradePlan(planId)
    setBusy(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    await refresh()
    toast.success(
      renew
        ? `Đã gia hạn gói ${PLAN_NAMES[current]} thêm 30 ngày 🎉`
        : `Chúc mừng! Bạn đang dùng gói ${PLAN_NAMES[planId]} 🎉`
    )
  }

  const isCurrentOrAbove = (planId) => RANK[planId] <= RANK[current]

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title dark:text-white">Gói của bạn</h1>
        <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
          Quản lý gói đang dùng, theo dõi hạn sử dụng và nâng cấp khi cần
        </p>
      </div>

      {/* ── Gói hiện tại ── */}
      <section
        className={`relative overflow-hidden rounded-2xl p-6 shadow-card sm:p-7 ${
          paid
            ? current === 'PRO'
              ? 'bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 text-white'
              : 'bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 text-white'
            : 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500 text-white'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner ${paid ? '' : ''}`}>
              {(() => {
                const Icon = PLAN_ICON[current]
                return <Icon size={30} weight="fill" />
              })()}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Gói hiện tại</p>
              <div className="mt-0.5 flex items-center gap-2.5">
                <h2 className="text-2xl font-extrabold">{PLAN_NAMES[current] || current}</h2>
                {paid && state === 'expired' && (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-extrabold text-white ring-1 ring-inset ring-white/40">
                    Đã hết hạn
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ngày đăng ký / hết hạn */}
          <div className="w-full sm:w-auto">
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {paid ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold ring-1 ring-inset ring-white/25 backdrop-blur">
                    <CalendarCheck size={15} weight="bold" />
                    Từ {started ? formatDate(started) : '—'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold ring-1 ring-inset ring-white/25 backdrop-blur">
                    <CalendarX size={15} weight="bold" />
                    Đến {expiresAt ? formatDate(expiresAt) : '—'}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold ring-1 ring-inset ring-white/25 backdrop-blur">
                  <Sparkle size={15} weight="bold" />
                  Miễn phí – không giới hạn thời gian
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Trạng thái hạn + nút hành động */}
        {paid ? (
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="min-w-[180px] flex-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 text-white/85">
                  <HourglassMedium size={15} weight="bold" />
                  {state === 'expired' ? 'Hạn đã qua' : `Còn lại ${days} ngày`}
                </span>
                {progress !== null && <span className="text-white/70">{Math.round(progress)}%</span>}
              </div>
              {progress !== null ? (
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/25">
                  <div
                    className={`h-full rounded-full ${state === 'urgent' ? 'bg-amber-300' : 'bg-white'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              ) : (
                <div className="mt-1.5 h-2 rounded-full bg-white/25" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {current !== 'PRO' && (
                <Button variant="light" icon={Crown} onClick={() => doUpgrade('PRO')} loading={busy === 'PRO'}>
                  Nâng cấp lên Pro
                </Button>
              )}
              <Button
                variant="light"
                icon={ArrowClockwise}
                onClick={() => doUpgrade(current)}
                loading={busy === current}
              >
                {state === 'expired' ? 'Gia hạn ngay (+30 ngày)' : 'Gia hạn +30 ngày'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <Button variant="light" icon={Crown} onClick={() => doUpgrade('PRO')} loading={busy === 'PRO'}>
              Nâng cấp lên Pro
            </Button>
          </div>
        )}
      </section>

      {/* ── Danh sách gói ── */}
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
              <div className="flex items-start justify-between">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${PLAN_ICON_COLOR[p.id]}`}>
                  <Icon size={24} weight="fill" />
                </span>
                {isCurrent && paid && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${
                    state === 'expired'
                      ? 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300'
                      : state === 'urgent'
                        ? 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
                  }`}>
                    {state === 'expired' ? 'Hết hạn' : `Còn ${days} ngày`}
                  </span>
                )}
              </div>
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
              {isCurrent && paid && (
                <p className="mt-3 text-center text-[11px] font-medium text-navy-400 dark:text-slate-500">
                  {started ? `Kích hoạt ${formatDate(started)}` : ''}
                  {started && expiresAt ? ' · ' : ''}
                  {expiresAt ? `hết hạn ${formatDate(expiresAt)}` : ''}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-navy-400 dark:text-slate-500">
        💡 Bản nâng cấp mô phỏng phục vụ demo: gói được kích hoạt ngay khi bấm nút, mỗi kỳ kéo dài 30 ngày.
        Admin có thể đổi gói bất kỳ tài khoản nào trong khu vực quản trị.
      </p>
    </div>
  )
}
