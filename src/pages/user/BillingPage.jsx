import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Check,
  Crown,
  Rocket,
  Sparkle,
  CalendarCheck,
  CalendarX,
  HourglassMedium,
  ArrowClockwise,
  Copy,
  QrCode,
  X,
  Clock,
  Receipt,
  Brain,
  Warning,
} from '@phosphor-icons/react'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { formatDate, formatVnd } from '../../lib/format'
import { PLANS as FALLBACK_PLANS, PLAN_NAMES, BILLING_CYCLES } from '../../lib/constants'
import {
  getProducts,
  getMyBilling,
  createOrder,
  getOrder,
  cancelOrder,
  startTrial,
} from '../../services/billingService'

const PLAN_ICON = { FREE: Sparkle, PLUS: Rocket, PRO: Crown }
const PLAN_ICON_COLOR = {
  FREE: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  PLUS: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
  PRO: 'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
}
const RANK = { FREE: 0, PLUS: 1, PRO: 2 }

const ORDER_STATUS = {
  PENDING: { label: 'Chờ thanh toán', cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/50' },
  PAID: { label: 'Đã thanh toán', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50' },
  CANCELLED: { label: 'Đã huỷ', cls: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600' },
  EXPIRED: { label: 'Hết hạn', cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/50' },
}

function daysRemaining(expiresAt) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt) - Date.now()) / 86400000)
}

/** Trang gói: xem hạn mức, dùng thử, mua/gia hạn bằng chuyển khoản VietQR. */
export default function BillingPage() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState(null)
  const [catalog, setCatalog] = useState(FALLBACK_PLANS)
  const [cycle, setCycle] = useState('MONTHLY')
  const [busy, setBusy] = useState(null)
  const [checkout, setCheckout] = useState(null) // { order, payment }
  const [paymentState, setPaymentState] = useState('PENDING')

  const current = overview?.plan || user?.plan || 'FREE'
  const paid = current === 'PLUS' || current === 'PRO'
  const days = paid ? daysRemaining(overview?.planExpiresAt) : null

  const plans = useMemo(
    () =>
      (catalog || []).map((p) => ({
        ...p,
        // API trả `name`, bảng dự phòng trong constants dùng `label` → hợp nhất
        // tại đây để nút bấm không bao giờ hiện "Nâng cấp undefined".
        title: p.label || p.name || PLAN_NAMES[p.id] || p.id,
        price: cycle === 'YEARLY' ? p.priceYearly : p.priceMonthly,
        period: cycle === 'YEARLY' ? '/năm' : '/tháng',
      })),
    [catalog, cycle]
  )

  const load = async () => {
    const [productsRes, mineRes] = await Promise.all([getProducts(), getMyBilling()])
    if (productsRes.success && productsRes.data?.plans?.length) {
      setCatalog(productsRes.data.plans)
    }
    if (mineRes.success) setOverview(mineRes.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đến từ trang giá với gói đã chọn sẵn ("Nâng cấp Pro") → mở luôn khung thanh toán
  const preselected = useRef(false)
  useEffect(() => {
    const wanted = location.state?.plan
    if (!wanted || preselected.current || loading) return
    if (wanted !== 'PLUS' && wanted !== 'PRO') return
    preselected.current = true
    if (location.state?.cycle) setCycle(location.state.cycle)
    buy(wanted)
    navigate('.', { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, location.state])

  // ── Hỏi lại trạng thái đơn mỗi 5 giây khi đang chờ chuyển khoản ──
  const pollRef = useRef(null)
  useEffect(() => {
    if (!checkout) return undefined
    const code = checkout.order.orderCode
    pollRef.current = setInterval(async () => {
      const res = await getOrder(code)
      if (!res.success) return
      setPaymentState(res.data.order.status)
      if (res.data.order.status === 'PAID') {
        clearInterval(pollRef.current)
        await load()
        await refresh()
        toast.success('Đã nhận được thanh toán — gói của bạn đã được kích hoạt 🎉')
        setCheckout(null)
      }
    }, 5000)
    return () => clearInterval(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout])

  const buy = async (planId) => {
    setBusy(planId)
    const res = await createOrder({ plan: planId, cycle })
    setBusy(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setPaymentState(res.data.order.status)
    setCheckout({ order: res.data.order, payment: res.data.payment })
    await load()
  }

  const doTrial = async () => {
    setBusy('TRIAL')
    const res = await startTrial()
    setBusy(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    await load()
    await refresh()
    toast.success('Đã bật dùng thử Pro 7 ngày — dùng hết sức nhé!')
  }

  const dropOrder = async (code) => {
    const res = await cancelOrder(code)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã huỷ đơn')
    setCheckout(null)
    await load()
  }

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Đã copy ${label}`)
    } catch {
      toast.error('Không copy được, bạn chép tay giúp mình nhé')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="h-40 animate-pulse rounded-2xl bg-navy-100 dark:bg-slate-800" />
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-navy-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    )
  }

  const trial = overview?.trial || {}
  const aiUsage = overview?.aiUsage

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title dark:text-white">Gói của bạn</h1>
        <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
          Quản lý gói, theo dõi hạn sử dụng và thanh toán bằng chuyển khoản ngân hàng
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
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner">
              {(() => {
                const Icon = PLAN_ICON[current] || Sparkle
                return <Icon size={30} weight="fill" />
              })()}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Gói hiện tại</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-extrabold">{PLAN_NAMES[current] || current}</h2>
                {overview?.subscription?.provider === 'TRIAL' && (
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-extrabold ring-1 ring-inset ring-white/40">
                    Đang dùng thử
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            {paid ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold ring-1 ring-inset ring-white/25 backdrop-blur">
                  <CalendarCheck size={15} weight="bold" />
                  Từ {overview?.planStartedAt ? formatDate(overview.planStartedAt) : '—'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold ring-1 ring-inset ring-white/25 backdrop-blur">
                  <CalendarX size={15} weight="bold" />
                  Đến {overview?.planExpiresAt ? formatDate(overview.planExpiresAt) : '—'}
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

        {paid ? (
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="min-w-[180px] flex-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 text-white/85">
                  <HourglassMedium size={15} weight="bold" />
                  {days < 0 ? 'Hạn đã qua' : `Còn lại ${days} ngày`}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/25">
                <div
                  className={`h-full rounded-full ${days <= 7 ? 'bg-amber-300' : 'bg-white'}`}
                  style={{ width: `${Math.max(0, Math.min(100, ((days || 0) / 30) * 100))}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {current !== 'PRO' && (
                <Button variant="light" icon={Crown} onClick={() => buy('PRO')} loading={busy === 'PRO'}>
                  Nâng cấp lên Pro
                </Button>
              )}
              <Button variant="light" icon={ArrowClockwise} onClick={() => buy(current)} loading={busy === current}>
                Gia hạn thêm {cycle === 'YEARLY' ? '1 năm' : '30 ngày'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="light" icon={Crown} onClick={() => buy('PRO')} loading={busy === 'PRO'}>
              Nâng cấp lên Pro
            </Button>
            {trial.eligible && (
              <Button variant="light" icon={Sparkle} onClick={doTrial} loading={busy === 'TRIAL'}>
                Dùng thử Pro {trial.days} ngày miễn phí
              </Button>
            )}
          </div>
        )}
      </section>

      {/* ── Hạn mức AI hôm nay ── */}
      {aiUsage && (
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-extrabold text-navy-900 dark:text-white">
              <Brain size={18} weight="fill" className="text-violet-500" />
              Trợ lý AI hôm nay
            </p>
            <p className="text-sm font-bold text-navy-500 dark:text-slate-400">
              {aiUsage.limit === null
                ? `Đã dùng ${aiUsage.used} lần — không giới hạn`
                : `Còn ${aiUsage.remaining}/${aiUsage.limit} lần`}
            </p>
          </div>
          {aiUsage.limit !== null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                style={{ width: `${Math.min(100, (aiUsage.used / aiUsage.limit) * 100)}%` }}
              />
            </div>
          )}
          {aiUsage.limit !== null && aiUsage.remaining === 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Warning size={14} weight="fill" /> Hết lượt hôm nay — nâng cấp để có thêm, hoặc quay lại vào ngày mai
            </p>
          )}
        </section>
      )}

      {/* ── Chọn kỳ thanh toán ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-navy-900 dark:text-white">Các gói</h2>
        <div className="inline-flex rounded-xl bg-navy-100 p-1 dark:bg-slate-800">
          {BILLING_CYCLES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCycle(c.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                cycle === c.id
                  ? 'bg-white text-navy-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-navy-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {c.label}
              {c.note && <span className="ml-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{c.note}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Danh sách gói ── */}
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const Icon = PLAN_ICON[p.id] || Sparkle
          const isCurrent = current === p.id
          const included = RANK[p.id] <= RANK[current]
          const isFree = p.id === 'FREE'
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl bg-white p-6 shadow-card ring-1 transition dark:bg-slate-800 ${
                isCurrent
                  ? 'ring-2 ring-blue-500'
                  : p.popular
                    ? 'ring-2 ring-cyan-400'
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
              <h3 className="mt-4 text-xl font-extrabold text-navy-900 dark:text-white">{p.title}</h3>
              <p className="mt-1 text-sm text-navy-400 dark:text-slate-500">{p.tagline}</p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-navy-900 dark:text-white">
                  {isFree ? '0đ' : formatVnd(p.price)}
                </span>
                {!isFree && <span className="text-sm font-semibold text-navy-400 dark:text-slate-500">{p.period}</span>}
              </p>
              {!isFree && cycle === 'YEARLY' && (
                <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ≈ {formatVnd(Math.round(p.price / 12))}/tháng — tiết kiệm 2 tháng
                </p>
              )}
              <ul className="mt-5 flex-1 space-y-2.5">
                {(p.features || []).map((f) => (
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
                ) : isFree ? (
                  <Button variant="secondary" fullWidth disabled>
                    {included ? 'Đã bao gồm' : 'Gói cơ bản'}
                  </Button>
                ) : (
                  <Button
                    variant={p.popular ? 'gradient' : 'primary'}
                    fullWidth
                    icon={Crown}
                    loading={busy === p.id}
                    onClick={() => buy(p.id)}
                  >
                    {included ? `Gia hạn ${p.title}` : `Nâng cấp ${p.title}`}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Lịch sử đơn ── */}
      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
        <p className="inline-flex items-center gap-2 text-sm font-extrabold text-navy-900 dark:text-white">
          <Receipt size={18} weight="fill" className="text-blue-500" /> Lịch sử đơn hàng
        </p>
        {!overview?.orders?.length ? (
          <p className="mt-3 text-sm text-navy-400 dark:text-slate-500">Chưa có đơn nào.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
                  <th className="pb-2">Mã đơn</th>
                  <th className="pb-2">Gói</th>
                  <th className="pb-2">Số tiền</th>
                  <th className="pb-2">Trạng thái</th>
                  <th className="pb-2">Tạo lúc</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100 dark:divide-slate-700">
                {overview.orders.map((o) => {
                  const st = ORDER_STATUS[o.status] || ORDER_STATUS.PENDING
                  return (
                    <tr key={o.id}>
                      <td className="py-2.5 font-mono text-xs font-bold text-navy-700 dark:text-slate-200">{o.orderCode}</td>
                      <td className="py-2.5 font-semibold text-navy-700 dark:text-slate-200">
                        {o.planName} · {o.cycle === 'YEARLY' ? 'năm' : 'tháng'}
                      </td>
                      <td className="py-2.5 font-bold text-navy-700 dark:text-slate-200">{formatVnd(o.amount)}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ring-inset ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2.5 text-navy-500 dark:text-slate-400">{formatDate(o.createdAt)}</td>
                      <td className="py-2.5 text-right">
                        {o.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await getOrder(o.orderCode)
                                if (res.success) {
                                  setPaymentState(res.data.order.status)
                                  setCheckout({ order: res.data.order, payment: res.data.payment })
                                }
                              }}
                              className="text-xs font-extrabold text-blue-600 hover:underline dark:text-blue-400"
                            >
                              Thanh toán
                            </button>
                            <button
                              type="button"
                              onClick={() => dropOrder(o.orderCode)}
                              className="text-xs font-extrabold text-rose-600 hover:underline dark:text-rose-400"
                            >
                              Huỷ
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-navy-400 dark:text-slate-500">
        Thanh toán bằng chuyển khoản ngân hàng (VietQR). Tiền vào tài khoản là gói tự kích hoạt, không cần chờ duyệt.
        Cần hỗ trợ? Nhắn cho chúng tôi ở mục <span className="font-bold">Hỗ trợ</span>.
      </p>

      {checkout && (
        <CheckoutModal
          order={checkout.order}
          payment={checkout.payment}
          status={paymentState}
          onCopy={copy}
          onCancel={() => dropOrder(checkout.order.orderCode)}
          onClose={() => setCheckout(null)}
        />
      )}
    </div>
  )
}

// ─── Khung thanh toán ───────────────────────────────────────

function CheckoutModal({ order, payment, status, onCopy, onCancel, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">Thanh toán đơn</p>
            <h3 className="text-xl font-extrabold text-navy-900 dark:text-white">
              {order.planName} · {order.cycle === 'YEARLY' ? '1 năm' : '1 tháng'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 dark:hover:bg-slate-700"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-white/80">Số tiền cần chuyển</p>
          <p className="mt-1 text-3xl font-extrabold">{formatVnd(order.amount)}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white/90">
            <Clock size={14} weight="bold" />
            {status === 'EXPIRED' ? 'Đơn đã hết hạn' : `Đơn hết hạn sau ${formatDate(order.expiresAt)}`}
          </p>
        </div>

        {!payment?.configured ? (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/50">
            Hệ thống chưa cấu hình tài khoản nhận tiền (BANK_ID / BANK_ACCOUNT). Bạn nhắn cho chúng tôi ở mục Hỗ trợ kèm mã đơn
            <span className="font-mono font-extrabold"> {order.orderCode}</span> để được hướng dẫn.
          </div>
        ) : (
          <>
            {(() => {
              // Ưu tiên mã QR do hệ thống tự sinh (hoặc do ngân hàng tạo qua API) —
              // ảnh vietqr.io chỉ còn là phương án dự phòng.
              const qrSrc = payment.qrImageDataUrl || payment.qrImageUrl || payment.vietQrUrl
              if (!qrSrc) return null
              return (
                <div className="mt-4 flex flex-col items-center">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-500 dark:text-slate-400">
                    <QrCode size={14} weight="bold" /> Quét mã bằng app ngân hàng
                  </p>
                  <img
                    src={qrSrc}
                    alt={`Mã VietQR cho đơn ${order.orderCode}`}
                    className="mt-2 w-full max-w-[260px] rounded-2xl ring-1 ring-navy-100 dark:ring-slate-700"
                  />
                  <p className="mt-2 rounded-full bg-navy-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-navy-500 dark:bg-slate-900/60 dark:text-slate-400">
                    {payment.qrSource === 'BANK'
                      ? `Mã QR do ${payment.bankName || 'ngân hàng'} tạo cho đơn này`
                      : 'Mã QR do hệ thống tạo — có sẵn số tiền và nội dung'}
                  </p>
                  {payment.qrPayload && (
                    <button
                      type="button"
                      onClick={() => onCopy(payment.qrPayload, 'chuỗi mã QR')}
                      className="mt-1.5 text-[11px] font-bold text-blue-600 underline dark:text-blue-400"
                    >
                      Copy chuỗi mã QR (dán vào app khác)
                    </button>
                  )}
                </div>
              )
            })()}

            <div className="mt-4 space-y-2.5">
              <Row label="Ngân hàng" value={payment.bankName || payment.bankId} />
              <Row label="Số tài khoản" value={payment.accountNumber} onCopy={() => onCopy(payment.accountNumber, 'số tài khoản')} />
              {payment.accountName && <Row label="Chủ tài khoản" value={payment.accountName} />}
              <Row
                label="Nội dung chuyển khoản"
                value={payment.transferContent}
                highlight
                onCopy={() => onCopy(payment.transferContent, 'nội dung chuyển khoản')}
              />
            </div>
          </>
        )}

        <div className="mt-5 rounded-xl bg-navy-50 p-4 text-xs font-semibold text-navy-600 dark:bg-slate-900/50 dark:text-slate-300">
          {status === 'PAID' ? (
            <span className="text-emerald-600 dark:text-emerald-400">Đã nhận được tiền — gói đang được kích hoạt.</span>
          ) : (
            <>
              Chuyển <span className="font-extrabold">đúng số tiền</span> và{' '}
              <span className="font-extrabold">đúng nội dung</span> — tiền vào là hệ thống tự phát hiện và{' '}
              <span className="font-extrabold">kích hoạt gói ngay</span>, không phải chờ ai duyệt. Trang này tự cập nhật trong
              vài giây. Quá 5 phút vẫn chưa thấy gói mới, bạn nhắn ở mục{' '}
              <span className="font-extrabold">Hỗ trợ</span> kèm mã đơn{' '}
              <span className="font-mono font-extrabold">{order.orderCode}</span> để được kiểm tra ngay.
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onClose}>
            Tôi sẽ chuyển sau
          </Button>
          {status === 'PENDING' && (
            <Button variant="ghost" className="text-rose-600 dark:text-rose-400" onClick={onCancel}>
              Huỷ đơn này
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, onCopy, highlight }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset ${
        highlight
          ? 'bg-amber-50 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-800/50'
          : 'bg-white ring-navy-100 dark:bg-slate-900/40 dark:ring-slate-700'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">{label}</p>
        <p className="truncate font-mono text-sm font-extrabold text-navy-900 dark:text-white">{value}</p>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-lg p-2 text-navy-400 hover:bg-navy-100 hover:text-navy-700 dark:hover:bg-slate-700 dark:hover:text-white"
          aria-label={`Copy ${label}`}
        >
          <Copy size={15} weight="bold" />
        </button>
      )}
    </div>
  )
}
