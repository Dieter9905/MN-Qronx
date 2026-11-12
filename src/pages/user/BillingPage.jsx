import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  UsersThree,
  EnvelopeSimple,
  Eye,
  EyeSlash,
} from '@phosphor-icons/react'
import { RoomButton, RoomCard, RoomSkeleton } from '../../components/common/RoomUI'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { formatDate, formatVnd } from '../../lib/format'
import { PLANS as FALLBACK_PLANS, PLAN_NAMES, BILLING_CYCLES, isPaidPlan, isProPlan } from '../../lib/constants'
import {
  getFamily,
  inviteMember,
  removeMember,
  leaveFamily,
} from '../../services/familyService'
import {
  getProducts,
  getMyBilling,
  createOrder,
  getOrder,
  checkOrder,
  cancelOrder,
  startTrial,
} from '../../services/billingService'

const PLAN_ICON = { FREE: Sparkle, PLUS: Rocket, PRO: Crown, BUSINESS: Crown }
// Đĩa icon gói (trang trí bề mặt) về tông phòng — chip PLAN_BADGE (dữ liệu tên gói ở
// Header/Admin) giữ nguyên màu dữ liệu theo luật mốc.
const PLAN_ICON_COLOR = {
  FREE: 'bg-room-oat/70 text-room-ink/60',
  PLUS: 'bg-room-rain/40 text-room-ink/65',
  PRO: 'bg-room-bell/25 text-room-bell ring-1 ring-inset ring-room-bell/40',
  BUSINESS: 'bg-room-acorn/20 text-room-acorn',
}
// Thang bậc gói: cao hơn thì là "nâng cấp", thấp hơn/ngang thì là "gia hạn".
const RANK = { FREE: 0, PLUS: 1, PRO: 2, BUSINESS: 3 }

// Trạng thái đơn = verdict bằng tông: chờ = Bell (chuông chưa re), đã thanh toán =
// Sage (chỉ hoàn thành), huỷ = Rain (trung tính), hết hạn = Blush (deadline đã qua).
const ORDER_STATUS = {
  PENDING: { label: 'Chờ thanh toán', cls: 'bg-room-bell/25 text-room-ink/85 ring-room-bell/40' },
  PAID: { label: 'Đã thanh toán', cls: 'bg-room-sage/45 text-room-ink/85 ring-room-acorn/20' },
  CANCELLED: { label: 'Đã huỷ', cls: 'bg-room-rain/30 text-room-ink/60 ring-room-rain' },
  EXPIRED: { label: 'Hết hạn', cls: 'bg-room-blush/45 text-room-ink/85 ring-room-acorn/20 dark:bg-room-blush/30' },
}

function daysRemaining(expiresAt) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt) - Date.now()) / 86400000)
}

/** Số giây còn lại tới hạn (0 khi đã qua) — dùng cho đồng hồ đếm ngược mã QR. */
function secondsLeft(expiresAt) {
  if (!expiresAt) return 0
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

/** 09:45 khi còn dưới 1 giờ, 47:09:45 khi còn dài hơn. */
function countdownText(totalSeconds) {
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  const minutes = String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')
  const hours = Math.floor(totalSeconds / 3600)
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
}

/** Đếm ngược mỗi giây tới `expiresAt`: mã QR chỉ có giá trị tới lúc đơn hết hạn. */
function useCountdown(expiresAt) {
  const [left, setLeft] = useState(() => secondsLeft(expiresAt))
  useEffect(() => {
    setLeft(secondsLeft(expiresAt))
    if (!expiresAt) return undefined
    const timer = setInterval(() => {
      const next = secondsLeft(expiresAt)
      setLeft(next)
      if (next <= 0) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])
  return left
}

// ─── Gói Pro Doanh nghiệp ────────────────────────────────────────
/**
 * Khối "Gói doanh nghiệp" — CÙNG một khối cho cả ba vai:
 *   • người chưa có nhà → thấy mức giá và nút mua;
 *   • chủ gói           → thấy danh sách chỗ trống, form mời và nút gỡ;
 *   • người trong nhóm    → thấy mình dùng chung của ai và nút rời đi.
 * Một khối, ba nội dung: không có chuyện hai màn hình nói hai chuyện khác nhau
 * về cùng một gói.
 */
function FamilyCard({ family, current, isSeat, onChanged, onBuy, busy }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [inviting, setInviting] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)

  // Chủ gói: khi API hỏng thì vẫn vào được khối này nhờ gói BUSINESS trên máy —
  // server tự chặn nếu thật sự không có quyền mời.
  const isOwner = !isSeat && (Boolean(family?.ownerActive) || current === 'BUSINESS')
  const members = family?.members || []
  const left = family ? (family.seatsLeft ?? 0) : 3
  const expiresAt = isSeat ? family?.owner?.expiresAt : family?.expiresAt

  const invite = async () => {
    const clean = email.trim()
    if (!clean) return
    setInviting(true)
    const res = await inviteMember({ email: clean, note: note.trim() })
    setInviting(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setEmail('')
    setNote('')
    toast.success(res.message)
    onChanged()
  }

  const drop = async (memberId) => {
    const res = await removeMember(memberId)
    setConfirmRemove(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    onChanged()
  }

  const leave = async () => {
    const res = await leaveFamily()
    setConfirmLeave(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    onChanged()
  }

  // ── Người trong nhóm: biết mình dùng chung của ai, và rời đi được ──
  if (isSeat) {
    return (
      <RoomCard className="p-5">
        <p className="inline-flex items-center gap-2 text-sm font-extrabold text-room-ink">
          <UsersThree size={18} weight="duotone" className="text-room-acorn" /> Gói Pro Doanh nghiệp
        </p>
        <p className="mt-3 text-sm font-semibold text-room-ink/70">
          Bạn đang dùng chung gói Pro Doanh nghiệp của <b className="text-room-ink">{family?.owner?.fullName || 'chủ nhóm'}</b>
          {expiresAt && (
            <>
              {' '}
              — gói còn hiệu lực tới <b className="text-room-ink">{formatDate(expiresAt)}</b>
            </>
          )}
          . Mọi quyền lợi Pro (nhắc dai, báo cáo năng suất, kế hoạch tuần, nhờ người khác làm) đều dùng
          được như bạn tự trả tiền.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!confirmLeave ? (
            <RoomButton variant="secondary" icon={UsersThree} onClick={() => setConfirmLeave(true)}>
              Rời gói doanh nghiệp
            </RoomButton>
          ) : (
            <>
              <RoomButton variant="danger" icon={Check} onClick={leave}>
                Chắc chắn — rời gói
              </RoomButton>
              <RoomButton variant="secondary" onClick={() => setConfirmLeave(false)}>
                Để ở lại
              </RoomButton>
            </>
          )}
        </div>
        {/* Chủ gói xem được tiến độ của người này ở mục Cả nhóm — phải nói ngay ở
            đây, không thì khách phát hiện ra sau và thấy như bị theo dõi. */}
        <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-room-ink/60">
          {family?.progressShared === false ? (
            <>
              <EyeSlash size={14} weight="fill" className="mt-0.5 shrink-0 text-room-ink/65" />
              Bạn đã tắt chia sẻ tiến độ — chủ gói không thấy số liệu công việc của bạn.
            </>
          ) : (
            <>
              <Eye size={14} weight="fill" className="mt-0.5 shrink-0 text-room-acorn" />
              Chủ gói thấy được tiến độ công việc của bạn (số việc xong, việc quá hạn — không đọc được nội dung).
              Bật/tắt ở mục <Link to="/app/family" className="font-extrabold text-room-acorn underline underline-offset-2">Cả nhóm</Link>.
            </>
          )}
        </p>
        <p className="mt-3 text-xs font-semibold text-room-ink/60">
          Rời gói không xoá dữ liệu nào của bạn — chỉ là trở lại gói Miễn phí, và bạn vẫn mua được gói riêng
          bất cứ lúc nào.
        </p>
      </RoomCard>
    )
  }

  // ── Chủ gói: mời, xem chỗ trống, gỡ ──
  if (isOwner) {
    return (
      <RoomCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm font-extrabold text-room-ink">
            <UsersThree size={18} weight="duotone" className="text-room-acorn" /> Gói Pro Doanh nghiệp
          </p>
          <p className="text-xs font-extrabold text-room-ink/60">
            Đang dùng {members.length + 1}/{family?.maxSeats || 4} tài khoản
            {expiresAt && <> · hết hạn {formatDate(expiresAt)}</>}
          </p>
        </div>          <p className="mt-2 text-sm font-semibold text-room-ink/70">
          Người bạn mời <b className="text-room-ink">không cần trả tiền</b> — họ dùng quyền lợi Pro y hệt bạn với việc và chuông nhắc của
          riêng mình, và vẫn là tài khoản độc lập nên việc của bạn vẫn riêng của bạn.
        </p>

        {/* Danh sách người trong nhóm */}
        <ul className="mt-4 space-y-2">
          <li className="flex items-center justify-between gap-3 rounded-xl bg-room-oat/70 px-3 py-2.5 ring-1 ring-room-acorn/25">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-room-ink">Bạn (chủ gói)</p>
              <p className="truncate text-xs font-semibold text-room-ink/65">Người trả tiền cho cả nhóm</p>
            </div>
          </li>
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-3 rounded-xl bg-room-oat/40 px-3 py-2.5 ring-1 ring-room-acorn/10"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-room-ink">{m.fullName}</p>
                <p className="truncate text-xs font-semibold text-room-ink/65">
                  {m.email} · tham gia {formatDate(m.joinedAt)}
                </p>
              </div>
              {confirmRemove === m.userId ? (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => drop(m.userId)}
                    className="cursor-pointer rounded-lg bg-room-rain px-2.5 py-1 text-xs font-extrabold text-room-ink transition hover:brightness-[0.96]"
                  >
                    Gỡ thật
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(null)}
                    className="cursor-pointer rounded-lg px-2 py-1 text-xs font-extrabold text-room-ink/60 transition hover:text-room-ink"
                  >
                    Huỷ
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(m.userId)}
                  className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-extrabold text-room-ink/60 transition hover:bg-room-rain/40 hover:text-room-ink"
                >
                  Gỡ
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* Form mời */}
        <div className="mt-4 rounded-xl bg-room-oat/40 p-3 ring-1 ring-room-acorn/10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-room-ink/65">
            Thêm chủ nhóm (tối đa {left} chỗ còn trống)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={left <= 0 || inviting}
              placeholder="email của người bạn muốn mời"
              className="min-w-[220px] flex-1 rounded-xl bg-room-paper px-3 py-2 text-sm font-semibold text-room-ink ring-1 ring-inset ring-room-acorn/20 transition focus:ring-2 focus:ring-room-acorn disabled:opacity-60"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={left <= 0 || inviting}
              placeholder="lời nhắn (không bắt buộc)"
              className="min-w-[160px] flex-1 rounded-xl bg-room-paper px-3 py-2 text-sm font-semibold text-room-ink ring-1 ring-inset ring-room-acorn/20 transition focus:ring-2 focus:ring-room-acorn disabled:opacity-60"
            />
            <RoomButton icon={EnvelopeSimple} loading={inviting} disabled={left <= 0 || !email.trim()} onClick={invite}>
              Thêm vào nhà
            </RoomButton>
          </div>
          {left <= 0 ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-room-bell/25 px-2.5 py-1 text-xs font-bold text-room-ink/85 ring-1 ring-inset ring-room-bell/40">
              Nhà đã đủ {family?.maxSeats || 4} tài khoản. Gỡ một người đi rồi mời người khác.
            </p>
          ) : (
            <p className="mt-2 text-xs font-semibold text-room-ink/65">
              Người được mời cần ĐÃ có tài khoản MN-Qronx (dùng miễn phí). Họ nhận thông báo ngay và dùng được
              quyền Pro kể từ giây đó.
            </p>
          )}
        </div>

        {/* Bảng tiến độ cả nhóm là lý do gói này đáng 349.000đ thay vì 79.000đ —
            để ngay cạnh phần mời người, không giấu vào menu. */}
        <div className="mt-4">
          <Link to="/app/family">
            <RoomButton variant="secondary" icon={UsersThree}>
              Xem cả nhóm đang tới đâu
            </RoomButton>
          </Link>
        </div>
      </RoomCard>
    )
  }

  // ── Chưa có nhà: bán gói ──
  return (
    <RoomCard className="p-5">
      <p className="inline-flex items-center gap-2 text-sm font-extrabold text-room-ink">
        <UsersThree size={18} weight="duotone" className="text-room-acorn" /> Gói Pro Doanh nghiệp — 349.000đ/tháng cho cả nhóm
      </p>
      <p className="mt-2 text-sm font-semibold text-room-ink/70">
        Mua một lần, dùng chung tới <b className="text-room-ink">10 tài khoản</b>: mỗi người vẫn là một tài khoản riêng với việc, nhắc nhở và
        báo cáo của chính mình, nhưng tất cả đều có quyền lợi Pro (nhắc dai, báo cáo năng suất, kế hoạch tuần,
        báo cáo gửi email, nhờ người khác làm). So với 10 gói Pro lẻ là 790.000đ, cả nhóm tiết kiệm 441.000đ mỗi tháng.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <RoomButton icon={Crown} loading={busy === 'BUSINESS'} onClick={() => onBuy('BUSINESS')}>
          Mua cho cả nhóm
        </RoomButton>
        <span className="inline-flex items-center rounded-xl bg-room-oat/60 px-3 py-2 text-xs font-bold text-room-ink/70 ring-1 ring-inset ring-room-acorn/20">
          Trả theo năm 3.490.000đ — tặng 2 tháng
        </span>
      </div>
    </RoomCard>
  )
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
  // Gói Pro Doanh nghiệp: chủ gói mời/gỡ người, người trong nhóm xem mình dùng chung của ai
  const [family, setFamily] = useState(null)
  const [paymentState, setPaymentState] = useState('PENDING')
  // Nút “Tôi đã chuyển”: đang kiểm tra, và lời nhắc sau khi kiểm tra xong
  const [checking, setChecking] = useState(false)
  const [checkNote, setCheckNote] = useState('')

  const current = overview?.plan || user?.plan || 'FREE'
  const paid = isPaidPlan(current)
  const days = paid ? daysRemaining(overview?.planExpiresAt) : null
  // Đang dùng một chỗ trong nhóm người khác: không có gì để họ "gia hạn" hay "nâng cấp"
  const isSeat = family?.role === 'MEMBER'

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
    const [productsRes, mineRes, familyRes] = await Promise.all([getProducts(), getMyBilling(), getFamily()])
    if (productsRes.success && productsRes.data?.plans?.length) {
      setCatalog(productsRes.data.plans)
    }
    if (mineRes.success) setOverview(mineRes.data)
    if (familyRes.success) setFamily(familyRes.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
     
  }, [])

  // Đến từ trang giá với gói đã chọn sẵn ("Nâng cấp Pro") → mở luôn khung thanh toán
  const preselected = useRef(false)
  useEffect(() => {
    const wanted = location.state?.plan
    if (!wanted || preselected.current || loading) return
    if (!isPaidPlan(wanted)) return
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
        await settlePaid()
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
    setCheckNote('')
    setCheckout({ order: res.data.order, payment: res.data.payment })
    await load()
  }

  /** Đánh dấu đã nhận tiền: dừng chờ, nạp lại gói và đóng khung thanh toán. */
  const settlePaid = async () => {
    await load()
    await refresh()
    toast.success('Đã nhận được thanh toán — gói của bạn đã được kích hoạt 🎉')
    setCheckout(null)
  }

  /**
   * “Tôi đã chuyển”: hỏi máy chủ kiểm tra ngay (máy chủ kéo luôn giao dịch ngân
   * hàng mới nhất) thay vì ngồi chờ tới lượt đồng bộ kế tiếp.
   */
  const checkNow = async () => {
    if (!checkout) return
    setChecking(true)
    const res = await checkOrder(checkout.order.orderCode)
    setChecking(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setPaymentState(res.data.order.status)
    if (res.data.order.status === 'PAID') {
      await settlePaid()
      return
    }
    setCheckNote(res.message)
    toast.info(res.message)
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
        <RoomSkeleton className="h-40" />
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <RoomSkeleton key={i} className="h-72" />
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
        <h1 className="font-display text-2xl font-bold text-room-ink">Gói của bạn</h1>
        <p className="mt-1 text-sm font-semibold text-room-ink/60">
          Quản lý gói, theo dõi hạn sử dụng và thanh toán bằng chuyển khoản ngân hàng
        </p>
      </div>

      {/* ── Gói hiện tại ── */}
      <RoomCard className="relative p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${PLAN_ICON_COLOR[current] || PLAN_ICON_COLOR.FREE}`}>
              {(() => {
                const Icon = PLAN_ICON[current] || Sparkle
                return <Icon size={30} weight={current === 'PRO' || current === 'BUSINESS' ? 'fill' : 'duotone'} />
              })()}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-room-ink/65">Gói hiện tại</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-2xl font-bold text-room-ink">{PLAN_NAMES[current] || current}</h2>
                {overview?.subscription?.provider === 'TRIAL' && (
                  <span className="rounded-full bg-room-bell/25 px-2.5 py-0.5 text-xs font-extrabold text-room-ink/85 ring-1 ring-inset ring-room-bell/40">
                    Đang dùng thử
                  </span>
                )}
                {isSeat && (
                  <span className="rounded-full bg-room-oat/60 px-2.5 py-0.5 text-xs font-extrabold text-room-ink/65 ring-1 ring-inset ring-room-acorn/20">
                    Dùng chung của {family?.owner?.fullName || 'chủ nhóm'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            {paid ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-room-oat/45 px-3 py-2 text-xs font-bold text-room-ink/70 ring-1 ring-inset ring-room-acorn/15">
                  <CalendarCheck size={15} weight="bold" className="text-room-acorn" />
                  Từ {overview?.planStartedAt ? formatDate(overview.planStartedAt) : '—'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-room-oat/45 px-3 py-2 text-xs font-bold text-room-ink/70 ring-1 ring-inset ring-room-acorn/15">
                  <CalendarX size={15} weight="bold" className="text-room-ink/65" />
                  Đến {overview?.planExpiresAt ? formatDate(overview.planExpiresAt) : '—'}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-room-oat/45 px-3 py-2 text-xs font-bold text-room-ink/70 ring-1 ring-inset ring-room-acorn/15">
                <Sparkle size={15} weight="duotone" className="text-room-acorn" />
                Miễn phí – không giới hạn thời gian
              </span>
            )}
          </div>
        </div>

        {paid ? (
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="min-w-[180px] flex-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-room-ink/70">
                <HourglassMedium size={15} weight="bold" className="text-room-acorn" />
                {days < 0 ? 'Hạn đã qua' : `Còn lại ${days} ngày`}
              </p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-room-ink/10">
                <div
                  className={`h-full rounded-full ${days <= 7 ? 'bg-room-blush' : 'bg-room-acorn'}`}
                  style={{ width: `${Math.max(0, Math.min(100, ((days || 0) / 30) * 100))}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Người trong nhóm không tự gia hạn/nâng cấp được — để hai nút này ở đó
                  là mời họ bấm vào một lỗi. Quản lý gói nằm ở khối "Gói doanh nghiệp". */}
              {!isSeat && (
                <>
                  {!isProPlan(current) && (
                    <RoomButton icon={Crown} onClick={() => buy('PRO')} loading={busy === 'PRO'}>
                      Nâng cấp lên Pro
                    </RoomButton>
                  )}
                  <RoomButton variant="secondary" icon={ArrowClockwise} onClick={() => buy(current)} loading={busy === current}>
                    Gia hạn thêm {cycle === 'YEARLY' ? '1 năm' : '30 ngày'}
                  </RoomButton>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            <RoomButton icon={Crown} onClick={() => buy('PRO')} loading={busy === 'PRO'}>
              Nâng cấp lên Pro
            </RoomButton>
            {trial.eligible && (
              <RoomButton variant="secondary" icon={Sparkle} onClick={doTrial} loading={busy === 'TRIAL'}>
                Dùng thử Pro {trial.days} ngày miễn phí
              </RoomButton>
            )}
          </div>
        )}
      </RoomCard>

      {/* ── Gói Pro Doanh nghiệp: một người trả tiền, tới 10 tài khoản cùng dùng ── */}
      <FamilyCard
        family={family}
        current={current}
        isSeat={isSeat}
        onChanged={load}
        onBuy={buy}
        busy={busy}
      />

      {/* ── Hạn mức AI hôm nay ── */}
      {aiUsage && (
        <RoomCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-extrabold text-room-ink">
              <Brain size={18} weight="duotone" className="text-room-bell" />
              Trợ lý AI hôm nay
            </p>
            <p className="text-sm font-bold text-room-ink/60">
              {aiUsage.limit === null
                ? `Đã dùng ${aiUsage.used} lần — không giới hạn`
                : `Còn ${aiUsage.remaining}/${aiUsage.limit} lần`}
            </p>
          </div>
          {aiUsage.limit !== null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-room-ink/10">
              <div
                className="h-full rounded-full bg-room-acorn"
                style={{ width: `${Math.min(100, (aiUsage.used / aiUsage.limit) * 100)}%` }}
              />
            </div>
          )}
          {aiUsage.limit !== null && aiUsage.remaining === 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-room-bell/25 px-2.5 py-1 text-xs font-bold text-room-ink/85 ring-1 ring-inset ring-room-bell/40">
              <Warning size={14} weight="fill" /> Hết lượt hôm nay — nâng cấp để có thêm, hoặc quay lại vào ngày mai
            </p>
          )}
        </RoomCard>
      )}

      {/* ── Chọn kỳ thanh toán ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-room-ink">Các gói</h2>
        <div className="inline-flex rounded-xl bg-room-oat/70 p-1 ring-1 ring-room-acorn/15">
          {BILLING_CYCLES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCycle(c.id)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                cycle === c.id
                  ? 'bg-room-paper text-room-ink shadow-[0_6px_12px_-8px_rgb(0_0_0/0.25)] ring-1 ring-room-acorn/30'
                  : 'text-room-ink/65 hover:text-room-ink'
              }`}
            >
              {c.label}
              {c.note && <span className="ml-1.5 text-[10px] font-bold text-room-acorn">{c.note}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Danh sách gói ── (4 gói → 2 cột trên tablet, 4 cột trên màn rộng) */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const Icon = PLAN_ICON[p.id] || Sparkle
          const isCurrent = current === p.id
          const included = RANK[p.id] <= RANK[current]
          const isFree = p.id === 'FREE'
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl bg-room-paper p-6 ring-1 transition ${
                isCurrent
                  ? 'ring-2 ring-room-acorn'
                  : p.popular
                    ? 'ring-2 ring-room-bell/60'
                    : 'ring-room-acorn/25'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-room-bell px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-room-ink shadow-[0_10px_18px_-10px_rgb(0_0_0/0.35)]">
                  Phổ biến nhất
                </span>
              )}
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${(PLAN_ICON_COLOR[p.id] || PLAN_ICON_COLOR.FREE)}`}>
                <Icon size={24} weight={p.id === 'FREE' || p.id === 'PLUS' ? 'duotone' : 'fill'} />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold text-room-ink">{p.title}</h3>
              <p className="mt-1 text-sm font-semibold text-room-ink/60">{p.tagline}</p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-room-ink">
                  {isFree ? '0đ' : formatVnd(p.price)}
                </span>
                {!isFree && <span className="text-sm font-semibold text-room-ink/65">{p.period}</span>}
              </p>
              {!isFree && cycle === 'YEARLY' && (
                <p className="mt-1 text-xs font-bold text-room-acorn">
                  ≈ {formatVnd(Math.round(p.price / 12))}/tháng — tiết kiệm 2 tháng
                </p>
              )}
              <ul className="mt-5 space-y-2.5">
                {(p.features || []).map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm font-semibold text-room-ink/70">
                    <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-room-sage/45 text-room-ink/80">
                      <Check size={11} weight="bold" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Chưa làm xong thì nói thẳng là “Sắp có” — không bán thứ chưa có */}
              {(p.upcoming || []).length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-dashed border-room-acorn/25 pt-3">
                  {p.upcoming.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm font-semibold text-room-ink/65">
                      <span className="mt-0.5 shrink-0 rounded-full bg-room-oat/70 px-2 py-[1px] text-[10px] font-extrabold uppercase tracking-wide text-room-ink/65">
                        Sắp có
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex-1" />
              <div className="mt-6">
                {isCurrent ? (
                  <RoomButton variant="secondary" fullWidth disabled icon={Sparkle}>
                    Gói hiện tại
                  </RoomButton>
                ) : isFree ? (
                  <RoomButton variant="secondary" fullWidth disabled>
                    {included ? 'Đã bao gồm' : 'Gói cơ bản'}
                  </RoomButton>
                ) : (
                  <RoomButton
                    fullWidth
                    icon={Crown}
                    loading={busy === p.id}
                    onClick={() => buy(p.id)}
                  >
                    {included ? `Gia hạn ${p.title}` : `Nâng cấp ${p.title}`}
                  </RoomButton>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Lịch sử đơn ── */}
      <RoomCard className="p-5">
        <p className="inline-flex items-center gap-2 text-sm font-extrabold text-room-ink">
          <Receipt size={18} weight="duotone" className="text-room-acorn" /> Lịch sử đơn hàng
        </p>
        {!overview?.orders?.length ? (
          <p className="mt-3 text-sm font-semibold text-room-ink/60">Chưa có đơn nào.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-room-ink/65">
                  <th className="pb-2">Mã đơn</th>
                  <th className="pb-2">Gói</th>
                  <th className="pb-2">Số tiền</th>
                  <th className="pb-2">Trạng thái</th>
                  <th className="pb-2">Tạo lúc</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-room-acorn/15">
                {overview.orders.map((o) => {
                  const st = ORDER_STATUS[o.status] || ORDER_STATUS.PENDING
                  return (
                    <tr key={o.id}>
                      <td className="py-2.5 font-mono text-xs font-bold text-room-ink/85">{o.orderCode}</td>
                      <td className="py-2.5 font-semibold text-room-ink/85">
                        {o.planName} · {o.cycle === 'YEARLY' ? 'năm' : 'tháng'}
                      </td>
                      <td className="py-2.5 font-bold text-room-ink/85">{formatVnd(o.amount)}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ring-inset ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2.5 font-semibold text-room-ink/65">{formatDate(o.createdAt)}</td>
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
                              className="cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-extrabold text-room-acorn underline-offset-2 transition hover:bg-room-oat/70 hover:underline"
                            >
                              Thanh toán
                            </button>
                            <button
                              type="button"
                              onClick={() => dropOrder(o.orderCode)}
                              className="cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-extrabold text-room-ink/60 underline-offset-2 transition hover:bg-room-rain/40 hover:text-room-ink hover:underline"
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
      </RoomCard>

      <p className="text-center text-xs font-semibold text-room-ink/65">
        Thanh toán bằng chuyển khoản ngân hàng (VietQR). Tiền vào tài khoản là gói tự kích hoạt, không cần chờ duyệt.
        Cần hỗ trợ? Nhắn cho chúng tôi ở mục <span className="font-bold text-room-ink/70">Hỗ trợ</span>.
      </p>

      {checkout && (
        <CheckoutModal
          order={checkout.order}
          payment={checkout.payment}
          status={paymentState}
          onCopy={copy}
          onCancel={() => dropOrder(checkout.order.orderCode)}
          onClose={() => setCheckout(null)}
          onCheck={checkNow}
          checking={checking}
          checkNote={checkNote}
          onRenew={() => buy(checkout.order.plan)}
        />
      )}
    </div>
  )
}

// ─── Khung thanh toán ───────────────────────────────────────

function CheckoutModal({ order, payment, status, onCopy, onCancel, onClose, onCheck, checking, checkNote, onRenew }) {
  // Đồng hồ đếm ngược hiệu lực của mã: hết giờ là mã cũ không còn dùng được, vì
  // nội dung chuyển khoản chính là mã đơn đã hết hạn.
  const left = useCountdown(order.expiresAt)
  const expired = status === 'EXPIRED' || (status !== 'PAID' && left <= 0)
  const urgent = !expired && left <= 120

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-room-ink/45 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-room-paper p-6 shadow-xl ring-1 ring-room-acorn/25 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-room-ink/65">Thanh toán đơn</p>
            <h3 className="font-display text-xl font-bold text-room-ink">
              {order.planName} · {order.cycle === 'YEARLY' ? '1 năm' : '1 tháng'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-room-ink/60 transition hover:bg-room-oat/70 hover:text-room-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-room-oat/50 p-4 ring-1 ring-inset ring-room-acorn/25">
          <p className="text-xs font-bold uppercase tracking-wider text-room-ink/65">Số tiền cần chuyển</p>
          <p className="mt-1 font-display text-3xl font-bold text-room-ink">{formatVnd(order.amount)}</p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-xs font-bold text-room-ink/75">
            <Clock size={14} weight="bold" className="text-room-bell" />
            {status === 'PAID' ? (
              'Đã thanh toán'
            ) : expired ? (
              'Mã QR đã hết hiệu lực'
            ) : (
              <>
                Mã QR còn hiệu lực
                <span
                  className={`rounded-lg px-1.5 py-0.5 font-mono text-sm font-extrabold ${
                    urgent
                      ? 'bg-room-blush/45 text-room-ink ring-1 ring-inset ring-room-acorn/20'
                      : 'bg-room-paper text-room-ink/85 ring-1 ring-inset ring-room-acorn/25'
                  }`}
                >
                  {countdownText(left)}
                </span>
                {urgent && <span className="font-extrabold text-room-ink">sắp hết — chuyển ngay nhé</span>}
              </>
            )}
          </p>
          {!expired && status !== 'PAID' && (
            <p className="mt-1 text-[11px] font-semibold text-room-ink/65">
              Hết giờ này thì mã đơn cũ không còn khớp — lúc đó bấm “Tạo mã mới”.
            </p>
          )}
        </div>

        {expired && (
          <div className="mt-4 rounded-xl bg-room-rain/30 p-4 text-sm font-bold text-room-ink/85 ring-1 ring-inset ring-room-rain">
            Đơn này đã quá hạn nên mã đơn{' '}
            <span className="font-mono font-extrabold text-room-ink">{order.orderCode}</span> không còn dùng để chuyển khoản được nữa. Bấm
            “Tạo mã mới” để sinh đơn khác. Nếu bạn đã lỡ chuyển tiền cho đơn này, tiền vẫn được ghi lại trong mục “Tiền đã vào
            nhưng chưa khớp đơn” và chúng tôi sẽ xử lý — nhắn mục Hỗ trợ kèm mã đơn trên là xong.
          </div>
        )}

        {!payment?.configured ? (
          <div className="mt-4 rounded-xl bg-room-bell/20 p-4 text-sm font-bold text-room-ink/85 ring-1 ring-inset ring-room-bell/40">
            Hệ thống chưa cấu hình tài khoản nhận tiền (BANK_ID / BANK_ACCOUNT). Bạn nhắn cho chúng tôi ở mục Hỗ trợ kèm mã đơn
            <span className="font-mono font-extrabold text-room-ink"> {order.orderCode}</span> để được hướng dẫn.
          </div>
        ) : (
          <>
            {(() => {
              // Ưu tiên mã QR do hệ thống tự sinh (hoặc do ngân hàng tạo qua API) —
              // ảnh vietqr.io chỉ còn là phương án dự phòng.
              const qrSrc = payment.qrImageDataUrl || payment.qrImageUrl || payment.vietQrUrl
              if (!qrSrc || expired) return null
              return (
                <div className="mt-4 flex flex-col items-center">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-room-ink/60">
                    <QrCode size={14} weight="bold" className="text-room-acorn" /> Quét mã bằng app ngân hàng
                  </p>
                  <img
                    src={qrSrc}
                    alt={`Mã VietQR cho đơn ${order.orderCode}`}
                    className="mt-2 w-full max-w-[260px] rounded-2xl ring-1 ring-room-acorn/25"
                  />
                  <p className="mt-2 rounded-full bg-room-oat/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-room-ink/65 ring-1 ring-inset ring-room-acorn/15">
                    {payment.qrSource === 'BANK'
                      ? `Mã QR do ${payment.bankName || 'ngân hàng'} tạo cho đơn này`
                      : 'Mã QR do hệ thống tạo — có sẵn số tiền và nội dung'}
                  </p>
                  {payment.qrPayload && (
                    <button
                      type="button"
                      onClick={() => onCopy(payment.qrPayload, 'chuỗi mã QR')}
                      className="mt-1.5 cursor-pointer text-[11px] font-bold text-room-acorn underline underline-offset-2"
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

        {checkNote && status !== 'PAID' && !expired && (
          <p className="mt-4 rounded-xl bg-room-oat/60 p-3 text-xs font-bold text-room-ink/80 ring-1 ring-inset ring-room-acorn/15">
            {checkNote}
          </p>
        )}

        <div className="mt-5 rounded-xl bg-room-oat/45 p-4 text-xs font-semibold text-room-ink/70 ring-1 ring-inset ring-room-acorn/10">
          {status === 'PAID' ? (
            <span className="rounded-md bg-room-sage/45 px-2 py-0.5 text-xs font-bold text-room-ink/85">
              Đã nhận được tiền — gói đang được kích hoạt.
            </span>
          ) : (
            <>
              Chuyển <span className="font-extrabold text-room-ink/90">đúng số tiền</span> và{' '}
              <span className="font-extrabold text-room-ink/90">đúng nội dung</span> — tiền vào là hệ thống tự phát hiện và{' '}
              <span className="font-extrabold text-room-ink/90">kích hoạt gói ngay</span>, không phải chờ ai duyệt. Trang này tự cập nhật trong
              vài giây. Quá 5 phút vẫn chưa thấy gói mới, bạn nhắn ở mục{' '}
              <span className="font-extrabold text-room-ink/90">Hỗ trợ</span> kèm mã đơn{' '}
              <span className="font-mono font-extrabold text-room-ink/90">{order.orderCode}</span> để được kiểm tra ngay.
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {expired ? (
            <RoomButton icon={ArrowClockwise} onClick={onRenew}>
              Tạo mã mới
            </RoomButton>
          ) : (
            <RoomButton icon={Check} loading={checking} disabled={status === 'PAID'} onClick={onCheck}>
              Tôi đã chuyển
            </RoomButton>
          )}
          {status === 'PENDING' && !expired && (
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer rounded-full px-3.5 py-2 font-display text-sm font-bold text-room-ink/60 ring-1 ring-room-acorn/25 transition hover:bg-room-rain/40 hover:text-room-ink"
            >
              Huỷ đơn này
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full px-3.5 py-2 font-display text-sm font-bold text-room-ink/60 ring-1 ring-room-acorn/25 transition hover:bg-room-oat/70 hover:text-room-ink"
          >
            Đóng
          </button>
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
          ? 'bg-room-bell/25 ring-room-bell/40'
          : 'bg-room-oat/40 ring-room-acorn/10'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-room-ink/65">{label}</p>
        <p className="truncate font-mono text-sm font-extrabold text-room-ink">{value}</p>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 cursor-pointer rounded-lg p-2 text-room-ink/60 transition hover:bg-room-oat/75 hover:text-room-ink"
          aria-label={`Copy ${label}`}
        >
          <Copy size={15} weight="bold" />
        </button>
      )}
    </div>
  )
}
