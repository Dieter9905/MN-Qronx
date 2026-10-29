import { useCallback, useEffect, useState } from 'react'
import {
  Receipt,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  ArrowClockwise,
  Warning,
  Bank,
  ClockCountdown,
} from '@phosphor-icons/react'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { formatDateTime, formatVnd } from '../../lib/format'
import {
  adminListOrders,
  adminConfirmOrder,
  adminCancelOrder,
  adminAttachTransfer,
  adminGetBillingSetup,
  adminSaveBillingSettings,
  adminRotateWebhookSecret,
  adminTestBankConnection,
  adminSyncBankNow,
  adminTestWebhook,
} from '../../services/billingService'

const STATUS_TABS = [
  { id: '', label: 'Tất cả' },
  { id: 'PENDING', label: 'Chờ thanh toán' },
  { id: 'PAID', label: 'Đã thanh toán' },
  { id: 'CANCELLED', label: 'Đã huỷ' },
  { id: 'EXPIRED', label: 'Hết hạn' },
]

const STATUS_BADGE = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/50',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600',
  EXPIRED: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/50',
}

const STATUS_LABEL = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã huỷ',
  EXPIRED: 'Hết hạn',
}

/**
 * Đơn đã thanh toán được mở gói bởi đường nào.
 * Phải nói rõ: tiền vào thì hệ thống tự mở, còn admin bấm xác nhận là việc khác —
 * nếu chỉ hiện "Đã kích hoạt ✓" thì rất dễ tưởng một cú bấm xác nhận đã hoàn thành
 * nhiều đơn cùng lúc.
 */
function activationOf(order) {
  if (order.status !== 'PAID') return null
  if (order.provider === 'WEBHOOK') {
    return { label: 'Tiền vào tự mở', detail: order.providerRef || 'khớp từ ngân hàng' }
  }
  if (order.provider === 'ADMIN') return { label: 'Admin đổi gói', detail: order.note || '' }
  if (order.provider === 'TRIAL') return { label: 'Dùng thử', detail: '' }
  return {
    label: order.confirmedBy ? 'Admin xác nhận' : 'Đã thanh toán',
    detail: order.providerRef || '',
  }
}

/**
 * Đối soát thanh toán: người dùng chuyển khoản → admin thấy đơn ở đây và bấm
 * "Đã nhận tiền" để kích hoạt gói (hoặc để webhook Casso/Sepay tự làm).
 */
export default function AdminOrdersPage() {
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pageSize: 20 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [confirming, setConfirming] = useState(null)
  // Tiền nhận về tài khoản nào: chưa cấu hình thì khách không thấy được mã QR
  const [bank, setBank] = useState(null)
  // Cài đặt nhận tiền (ngân hàng ACB, số tài khoản, mã xác thực webhook)
  const [setup, setSetup] = useState(null)
  const [setupForm, setSetupForm] = useState({ bankId: '970416', bankAccount: '', bankAccountName: '', qrTemplate: 'compact2' })
  // Nguồn tự phát hiện tiền vào: khai báo API ngân hàng (hệ thống tự kéo giao dịch)
  const [apiForm, setApiForm] = useState({
    bankApiProvider: 'SEPAY',
    bankApiBaseUrl: '',
    bankApiToken: '',
    bankApiClientId: '',
    bankApiClientSecret: '',
    bankApiTokenUrl: '',
    bankApiHistoryPath: '',
    bankApiQrPath: '',
    bankApiAccount: '',
    syncEnabled: false,
    syncIntervalMinutes: 5,
  })
  const [savingApi, setSavingApi] = useState(false)
  const [testingApi, setTestingApi] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [apiTest, setApiTest] = useState(null)
  const [savingSetup, setSavingSetup] = useState(false)
  const [rotating, setRotating] = useState(false)
  // Kết quả "gửi thử webhook" và nhật ký lần gọi gần nhất (để biết vì sao SePay báo lỗi)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [webhookTest, setWebhookTest] = useState(null)
  // null = tự quyết định: chưa cấu hình thì mở sẵn để admin thấy việc cần làm
  const [showSetup, setShowSetup] = useState(null)
  // Giao dịch đã vào tài khoản nhưng chưa khớp đơn nào (khách ghi sai nội dung…)
  const [unmatched, setUnmatched] = useState([])
  const [pendingOptions, setPendingOptions] = useState([])
  const [attachCode, setAttachCode] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await adminListOrders({ status: status || undefined, keyword: keyword || undefined, page })
    setLoading(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setData(res.data)
    if (res.data?.bank) setBank(res.data.bank)
    setUnmatched(res.data?.unmatched || [])
  }, [status, keyword, page, toast])

  const loadSetup = useCallback(async () => {
    const res = await adminGetBillingSetup()
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setSetup(res.data)
    const b = res.data.bank || {}
    setSetupForm({
      bankId: b.bankId || '970416',
      bankAccount: b.accountNumber || '',
      bankAccountName: b.accountName || '',
      qrTemplate: b.qrTemplate || 'compact2',
    })
    const s = res.data.sync || {}
    setApiForm({
      bankApiProvider: s.provider || 'SEPAY',
      bankApiBaseUrl: s.baseUrl || '',
      // Để trống = giữ nguyên bí mật đang lưu, không ghi đè
      bankApiToken: '',
      bankApiClientId: s.clientId || '',
      bankApiClientSecret: '',
      bankApiTokenUrl: s.tokenUrl || '',
      bankApiHistoryPath: s.historyPath || '',
      bankApiQrPath: s.qrPath || '',
      bankApiAccount: s.account || '',
      syncEnabled: Boolean(s.syncEnabled),
      syncIntervalMinutes: s.intervalMinutes || 5,
    })
    setBank(b)
  }, [toast])

  useEffect(() => {
    load()
    loadSetup()
  }, [load, loadSetup])

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Đã copy ${label}`)
    } catch {
      toast.error('Trình duyệt không cho copy tự động — bạn chọn và copy tay nhé')
    }
  }

  const saveSetup = async () => {
    setSavingSetup(true)
    const res = await adminSaveBillingSettings({
      bankId: setupForm.bankId,
      bankAccount: setupForm.bankAccount,
      bankAccountName: setupForm.bankAccountName,
      qrTemplate: setupForm.qrTemplate,
    })
    setSavingSetup(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    // Giữ khung mở sau khi lưu để admin thấy ngay URL webhook và mã xác thực
    setShowSetup(true)
    loadSetup()
    load()
  }

  const saveApi = async () => {
    setSavingApi(true)
    const res = await adminSaveBillingSettings({
      bankApiProvider: apiForm.bankApiProvider,
      bankApiBaseUrl: apiForm.bankApiBaseUrl,
      bankApiClientId: apiForm.bankApiClientId,
      bankApiTokenUrl: apiForm.bankApiTokenUrl,
      bankApiHistoryPath: apiForm.bankApiHistoryPath,
      bankApiQrPath: apiForm.bankApiQrPath,
      bankApiAccount: apiForm.bankApiAccount,
      syncEnabled: apiForm.syncEnabled,
      syncIntervalMinutes: Number(apiForm.syncIntervalMinutes) || 5,
      // Chỉ gửi khi có nhập, trống thì giữ nguyên bí mật đang lưu
      ...(apiForm.bankApiToken ? { bankApiToken: apiForm.bankApiToken } : {}),
      ...(apiForm.bankApiClientSecret ? { bankApiClientSecret: apiForm.bankApiClientSecret } : {}),
    })
    setSavingApi(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã lưu cấu hình API ngân hàng')
    setShowSetup(true)
    loadSetup()
  }

  const testWebhook = async () => {
    setTestingWebhook(true)
    setWebhookTest(null)
    const res = await adminTestWebhook()
    setTestingWebhook(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setWebhookTest(res.data)
    if (res.data?.ok) toast.success('Webhook thông — máy chủ trả 200')
    else toast.error(res.message)
    // Nhật ký vừa được ghi thêm một dòng → đọc lại để hiển thị mới nhất
    loadSetup()
  }

  const testApi = async () => {
    setTestingApi(true)
    const res = await adminTestBankConnection()
    setTestingApi(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    setApiTest(res.data)
    if (res.data?.ok) toast.success(res.data.message)
    else toast.error(res.data?.message || 'Không kết nối được API ngân hàng')
  }

  const syncNow = async () => {
    setSyncing(true)
    const res = await adminSyncBankNow()
    setSyncing(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    if (res.data?.ok) toast.success(res.message)
    else toast.error(res.data?.message || res.message)
    loadSetup()
    load()
  }

  const rotateSecret = async () => {
    setRotating(true)
    const res = await adminRotateWebhookSecret()
    setRotating(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã sinh mã xác thực mới — dán lại vào SePay/Casso')
    setShowSetup(true)
    loadSetup()
  }

  // Khi có giao dịch lạc, nạp danh sách đơn đang chờ để gán vào
  useEffect(() => {
    if (!unmatched.length || pendingOptions.length) return
    ;(async () => {
      const res = await adminListOrders({ status: 'PENDING', pageSize: 50 })
      if (res.success) setPendingOptions(res.data.items || [])
    })()
  }, [unmatched, pendingOptions.length])

  const attach = async (eventId) => {
    const orderCode = attachCode[eventId]
    if (!orderCode) {
      toast.error('Chọn đơn cần gán trước đã')
      return
    }
    setBusy(`EV${eventId}`)
    const res = await adminAttachTransfer(eventId, { orderCode })
    setBusy(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    load()
  }
  const confirm = async () => {
    setBusy(confirming.orderCode)
    const res = await adminConfirmOrder(confirming.orderCode, {
      provider: 'VIETQR',
      providerRef: confirming.providerRef || null,
      note: confirming.note || null,
    })
    setBusy(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success(res.message)
    setConfirming(null)
    load()
  }

  const cancel = async (order) => {
    setBusy(order.orderCode)
    const res = await adminCancelOrder(order.orderCode)
    setBusy(null)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast.success('Đã huỷ đơn')
    load()
  }

  const openSetup = (v, b) => (v === null || v === undefined ? !b?.configured : v)

  const paidTotal = data.items.filter((o) => o.status === 'PAID').reduce((sum, o) => sum + o.amount, 0)
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 20)))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title dark:text-white">Đơn hàng & thanh toán</h1>
          <p className="mt-1 text-sm font-medium text-navy-400 dark:text-slate-500">
            Đối soát chuyển khoản và kích hoạt gói cho người dùng
          </p>
        </div>
        <Button variant="secondary" icon={ArrowClockwise} onClick={load} loading={loading}>
          Làm mới
        </Button>
      </div>

      {/* Gói sắp hết hạn: chuyển khoản không tự gia hạn nên admin cần chủ động nhắc */}
      {setup?.expiringSoon?.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-extrabold text-navy-900 dark:text-white">
                <ClockCountdown size={18} weight="fill" className="text-amber-500" />
                Sắp hết hạn trong 7 ngày
              </p>
              <p className="mt-1 text-xs font-semibold text-navy-500 dark:text-slate-400">
                {setup.expiringSoon.length} gói — chuyển khoản không tự gia hạn nên hãy nhắc họ mua kỳ mới trước khi
                mất quyền lợi.
              </p>
            </div>
          </div>

          <ul className="mt-3 divide-y divide-navy-100 dark:divide-slate-700">
            {setup.expiringSoon.map((s) => (
              <li key={s.subscriptionId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-navy-900 dark:text-white">
                    {s.user.fullName || s.user.email}
                  </span>
                  <span className="block truncate text-xs font-medium text-navy-400 dark:text-slate-500">
                    {s.user.email}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800/50">
                    {s.planName}
                  </span>
                  <span
                    className={
                      s.daysLeft <= 3
                        ? 'rounded-lg bg-rose-50 px-2 py-1 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/50'
                        : 'rounded-lg bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/50'
                    }
                  >
                    còn {s.daysLeft} ngày
                  </span>
                  <span className="text-navy-400 dark:text-slate-500">hạn {formatDateTime(s.expiresAt)}</span>
                  <span className={s.reminded ? 'text-emerald-600 dark:text-emerald-400' : 'text-navy-400 dark:text-slate-500'}>
                    {s.reminded ? `đã nhắc ${formatDateTime(s.reminderSentAt)}` : 'chưa nhắc email'}
                  </span>
                  <a
                    href={`mailto:${s.user.email}?subject=${encodeURIComponent(`Gói ${s.planName} của bạn sắp hết hạn`)}`}
                    className="rounded-lg bg-navy-900 px-2.5 py-1 text-white transition hover:bg-navy-700 dark:bg-white dark:text-navy-900 dark:hover:bg-slate-200"
                  >
                    Nhắc khách
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cài đặt nhận tiền: đặt ngay trong app, đổi là ăn liền (không cần deploy) */}
      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-extrabold text-navy-900 dark:text-white">
              <Bank size={18} weight="fill" className="text-blue-500" />
              Cài đặt nhận tiền
            </p>
            {bank?.configured ? (
              <p className="mt-1 text-xs font-semibold text-navy-500 dark:text-slate-400">
                Đang nhận tiền vào{' '}
                <span className="font-bold text-navy-800 dark:text-white">{bank.bankName || bank.bankId}</span> ·{' '}
                <span className="font-mono font-bold">{bank.accountNumber}</span>
                {bank.accountName ? ` · ${bank.accountName}` : ''}
                {bank.source === 'ENV' ? ' · (lấy từ biến môi trường)' : ''}
              </p>
            ) : (
              <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300">
                Chưa có tài khoản nhận tiền — khách bấm mua gói sẽ không thấy mã QR.
              </p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowSetup((v) => !openSetup(v))}>
            {openSetup(showSetup, bank) ? 'Thu gọn' : 'Mở cài đặt'}
          </Button>
        </div>

        {setup?.warnings?.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {setup.warnings.map((w) => (
              <p
                key={w}
                className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/50"
              >
                <Warning size={15} weight="fill" className="mt-0.5 shrink-0" />
                <span>{w}</span>
              </p>
            ))}
          </div>
        )}

        {/* Webhook gọi tới mà bị từ chối = tiền vào không tự mở gói. Nói thẳng ra
            ngay trên đầu thẻ thay vì để admin tự đoán vì sao khách thanh toán rồi
            vẫn ở gói cũ. */}
        {(setup?.lastWebhook?.status === 'REJECTED' || setup?.lastWebhook?.status === 'ERROR') && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:ring-rose-800/50">
            <p className="flex items-start gap-2">
              <Warning size={15} weight="fill" className="mt-0.5 shrink-0" />
              <span>
                Webhook gần nhất bị từ chối lúc {formatDateTime(setup.lastWebhook.at)} — tiền vào sẽ không tự mở gói.{' '}
                {setup.lastWebhook.message}
              </span>
            </p>
          </div>
        )}

        {openSetup(showSetup, bank) && (
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            {/* 1. Tài khoản nhận tiền */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
                1. Tài khoản nhận tiền
              </p>
              <label className="block">
                <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Ngân hàng</span>
                <select
                  value={setupForm.bankId}
                  onChange={(e) => setSetupForm((f) => ({ ...f, bankId: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-navy-800 ring-1 ring-navy-100 dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                >
                  {(setup?.bankOptions || []).map((b) => (
                    <option key={b.bin} value={b.bin}>
                      {b.name} ({b.bin})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Số tài khoản</span>
                <input
                  value={setupForm.bankAccount}
                  onChange={(e) => setSetupForm((f) => ({ ...f, bankAccount: e.target.value }))}
                  placeholder="Ví dụ 123456789"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-sm font-semibold text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-navy-600 dark:text-slate-300">
                  Tên chủ tài khoản (không dấu, viết hoa — đúng như ngân hàng đang hiển thị)
                </span>
                <input
                  value={setupForm.bankAccountName}
                  onChange={(e) => setSetupForm((f) => ({ ...f, bankAccountName: e.target.value.toUpperCase() }))}
                  placeholder="Ví dụ MN QRONX"
                  className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold uppercase text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Mẫu mã QR</span>
                <select
                  value={setupForm.qrTemplate}
                  onChange={(e) => setSetupForm((f) => ({ ...f, qrTemplate: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-navy-800 ring-1 ring-navy-100 dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                >
                  {(setup?.templates || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button icon={CheckCircle} loading={savingSetup} onClick={saveSetup}>
                Lưu tài khoản nhận tiền
              </Button>
              <p className="text-[11px] font-semibold text-navy-400 dark:text-slate-500">{setup?.note}</p>
            </div>

            {/* 2. Webhook tự kích hoạt gói */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
                2. Tự kích hoạt khi tiền vào (webhook)
              </p>
              <div className="rounded-xl bg-navy-50/70 p-3 dark:bg-slate-900/60">
                <p className="text-xs font-bold text-navy-600 dark:text-slate-300">URL webhook dán vào SePay / Casso</p>
                <p className="mt-1 break-all font-mono text-[11px] font-bold text-navy-800 dark:text-white">
                  {setup?.webhookUrl || '(chưa xác định)'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!setup?.webhookUrl}
                    onClick={() => copy(setup.webhookUrl, 'URL webhook')}
                  >
                    Copy URL
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!setup?.webhookUrlWithToken}
                    onClick={() => copy(setup.webhookUrlWithToken, 'URL kèm mã')}
                  >
                    Copy URL kèm mã
                  </Button>
                </div>
              </div>

              <div className="rounded-xl bg-navy-50/70 p-3 dark:bg-slate-900/60">
                <p className="text-xs font-bold text-navy-600 dark:text-slate-300">Mã xác thực (Apikey / secure token)</p>
                <p className="mt-1 break-all font-mono text-[11px] font-bold text-navy-800 dark:text-white">
                  {setup?.webhookSecret || '(chưa có — bấm Sinh mã mới)'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!setup?.webhookSecret}
                    onClick={() => copy(setup.webhookSecret, 'mã xác thực')}
                  >
                    Copy mã
                  </Button>
                  <Button size="sm" variant="secondary" icon={ArrowClockwise} loading={rotating} onClick={rotateSecret}>
                    Sinh mã mới
                  </Button>
                </div>
              </div>

              {/* Nhật ký lần gọi gần nhất: SePay báo “Không xác thực” thì chỗ này nói
                  rõ nó gọi tới lúc nào, gửi kèm gì và vì sao bị từ chối. */}
              <div
                className={`rounded-xl p-3 ring-1 ${
                  setup?.lastWebhook?.status === 'OK'
                    ? 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-900/20 dark:ring-emerald-800/50'
                    : setup?.lastWebhook
                      ? 'bg-rose-50 ring-rose-200 dark:bg-rose-900/20 dark:ring-rose-800/50'
                      : 'bg-navy-50/70 ring-navy-100 dark:bg-slate-900/60 dark:ring-slate-700'
                }`}
              >
                <p className="text-xs font-bold text-navy-600 dark:text-slate-300">Lần SePay gọi webhook gần nhất</p>
                {setup?.lastWebhook ? (
                  <>
                    <p className="mt-1 text-[11px] font-bold text-navy-700 dark:text-slate-200">
                      {setup.lastWebhook.status === 'OK' ? '✓ Đã nhận' : '✗ Bị từ chối'} lúc{' '}
                      {formatDateTime(setup.lastWebhook.at)} · gửi kèm: {setup.lastWebhook.auth}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-navy-500 dark:text-slate-400">
                      {setup.lastWebhook.message}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[11px] font-semibold text-navy-500 dark:text-slate-400">
                    Chưa thấy lần gọi nào. Sang SePay bấm “Gửi thử” ở dòng webhook, hoặc bấm nút bên dưới để máy chủ tự gọi thử.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" loading={testingWebhook} onClick={testWebhook}>
                    Gửi thử từ máy chủ
                  </Button>
                </div>
                {webhookTest && (
                  <p className="mt-2 break-all text-[11px] font-semibold text-navy-500 dark:text-slate-400">
                    {webhookTest.ok ? 'Máy chủ trả' : 'Lỗi'}{' '}
                    {webhookTest.status ? `HTTP ${webhookTest.status}` : ''} {webhookTest.response || webhookTest.error || ''}
                  </p>
                )}
              </div>

              <ol className="list-inside list-decimal space-y-1 text-[11px] font-semibold text-navy-500 dark:text-slate-400">
                <li>Tạo tài khoản SePay (miễn phí) rồi liên kết tài khoản ACB của bạn.</li>
                <li>
                  Vào mục Webhooks → Thêm webhook. <span className="font-bold">URL</span>: bấm “Copy URL kèm mã” ở trên rồi dán
                  — URL này đã có sẵn mã nên chọn phương thức xác thực là <span className="font-bold">Không xác thực</span> cũng
                  chạy. Muốn chắc hơn thì chọn <span className="font-bold">API Key</span> rồi dán mã ở ô trên.
                </li>
                <li>
                  Loại giao dịch chọn “Tiền vào”, tài khoản chọn “Tất cả tài khoản”. Sai hai mục này là webhook không bao giờ
                  gọi tới.
                </li>
                <li>Bấm “Gửi thử” của SePay. Thấy dòng “Lần SePay gọi webhook gần nhất: ✓ Đã nhận” là thông.</li>
                <li>
                  Giao dịch không khớp tự động (ghi sai nội dung, chuyển thiếu) vẫn được giữ lại ở mục “Tiền đã vào nhưng chưa
                  khớp đơn” bên dưới.
                </li>
              </ol>
            </div>
          </div>
        )}

        {openSetup(showSetup, bank) && (
          <div className="mt-6 border-t border-navy-100 pt-5 dark:border-slate-700">
            <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
              3. Tự phát hiện tiền vào bằng API ngân hàng (không cần webhook, không cần xác nhận tay)
            </p>
            <p className="mt-1.5 max-w-3xl text-xs font-semibold text-navy-500 dark:text-slate-400">
              Ở chế độ này hệ thống <span className="font-extrabold">chủ động gọi API ngân hàng</span> theo chu kỳ để đọc giao dịch tiền vào,
              rồi tự khớp mã đơn và kích hoạt gói. Webhook ở mục 2 chỉ là đường dự phòng — bật cả hai càng chắc.
            </p>

            {setup?.sync?.lastSyncAt && (
              <p className="mt-2 text-[11px] font-bold text-navy-500 dark:text-slate-400">
                Đồng bộ lần cuối: {formatDateTime(setup.sync.lastSyncAt)} ·{' '}
                <span className={setup.sync.lastSyncStatus === 'ERROR' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                  {setup.sync.lastSyncStatus === 'ERROR' ? 'Lỗi' : 'Thành công'}
                </span>
                {setup.sync.lastSyncMessage ? ` · ${setup.sync.lastSyncMessage}` : ''}
                {setup.sync.syncEnabled && setup.sync.nextSyncAt ? ` · lần tới ${formatDateTime(setup.sync.nextSyncAt)}` : ''}
              </p>
            )}

            <div className="mt-3 grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Nhà cung cấp API</span>
                  <select
                    value={apiForm.bankApiProvider}
                    onChange={(e) => {
                      const provider = e.target.value
                      const info = (setup?.apiProviders || []).find((p) => p.id === provider)
                      setApiForm((f) => ({ ...f, bankApiProvider: provider, bankApiBaseUrl: info?.defaultBaseUrl || f.bankApiBaseUrl }))
                      setApiTest(null)
                    }}
                    className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-navy-800 ring-1 ring-navy-100 dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                  >
                    {(setup?.apiProviders || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const info = (setup?.apiProviders || []).find((p) => p.id === apiForm.bankApiProvider)
                    if (!info?.hint) return null
                    return (
                      <span className="mt-1 block text-[11px] font-semibold text-navy-400 dark:text-slate-500">
                        {info.hint}{' '}
                        {info.docs && (
                          <a href={info.docs} target="_blank" rel="noreferrer" className="font-bold text-blue-600 underline dark:text-blue-400">
                            Tài liệu
                          </a>
                        )}
                      </span>
                    )
                  })()}
                </label>

                {apiForm.bankApiProvider === 'SEPAY' ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-bold text-navy-600 dark:text-slate-300">
                        API Token của SePay {setup?.sync?.hasToken ? '(đã lưu — để trống nếu không đổi)' : ''}
                      </span>
                      <input
                        type="password"
                        value={apiForm.bankApiToken}
                        onChange={(e) => setApiForm((f) => ({ ...f, bankApiToken: e.target.value }))}
                        placeholder={setup?.sync?.hasToken ? '•••••••• (đang dùng bản đã lưu)' : 'Dán API Token ở đây'}
                        className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-sm font-semibold text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Base URL (mặc định của SePay)</span>
                      <input
                        value={apiForm.bankApiBaseUrl}
                        onChange={(e) => setApiForm((f) => ({ ...f, bankApiBaseUrl: e.target.value }))}
                        placeholder="https://my.sepay.vn/userapi"
                        className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-xs font-semibold text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Token URL (OAuth2 — ACB cấp)</span>
                      <input
                        value={apiForm.bankApiTokenUrl}
                        onChange={(e) => setApiForm((f) => ({ ...f, bankApiTokenUrl: e.target.value }))}
                        placeholder="https://…/oauth2/token"
                        className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-xs font-semibold text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Client ID</span>
                        <input
                          value={apiForm.bankApiClientId}
                          onChange={(e) => setApiForm((f) => ({ ...f, bankApiClientId: e.target.value }))}
                          className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-xs font-semibold text-navy-800 ring-1 ring-navy-100 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-navy-600 dark:text-slate-300">
                          Client secret {setup?.sync?.hasClientSecret ? '(đã lưu — để trống nếu không đổi)' : ''}
                        </span>
                        <input
                          type="password"
                          value={apiForm.bankApiClientSecret}
                          onChange={(e) => setApiForm((f) => ({ ...f, bankApiClientSecret: e.target.value }))}
                          className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-xs font-semibold text-navy-800 ring-1 ring-navy-100 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs font-bold text-navy-600 dark:text-slate-300">
                        Đường dẫn lịch sử giao dịch (ACB cấp; dùng được {'{account}'}, {'{from}'}, {'{to}'}, {'{limit}'})
                      </span>
                      <input
                        value={apiForm.bankApiHistoryPath}
                        onChange={(e) => setApiForm((f) => ({ ...f, bankApiHistoryPath: e.target.value }))}
                        placeholder="/accounts/{account}/transactions?fromDate={from}&toDate={to}"
                        className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-xs font-semibold text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-navy-600 dark:text-slate-300">
                        Đường dẫn tạo QR động (ACB cấp — để trống thì hệ thống tự sinh mã VietQR; dùng được{' '}
                        {'{account}'}, {'{amount}'}, {'{content}'}, {'{orderCode}'})
                      </span>
                      <input
                        value={apiForm.bankApiQrPath}
                        onChange={(e) => setApiForm((f) => ({ ...f, bankApiQrPath: e.target.value }))}
                        placeholder="/qr/dynamic"
                        className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-xs font-semibold text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Base URL của ACB (nếu đường dẫn ở trên là tương đối)</span>
                      <input
                        value={apiForm.bankApiBaseUrl}
                        onChange={(e) => setApiForm((f) => ({ ...f, bankApiBaseUrl: e.target.value }))}
                        placeholder="https://…"
                        className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-xs font-semibold text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
                      />
                    </label>
                  </>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Số tài khoản gửi lên API</span>
                    <input
                      value={apiForm.bankApiAccount}
                      onChange={(e) => setApiForm((f) => ({ ...f, bankApiAccount: e.target.value }))}
                      placeholder="Mặc định = số tài khoản nhận tiền"
                      inputMode="numeric"
                      className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 font-mono text-sm font-semibold text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-navy-600 dark:text-slate-300">Chu kỳ đồng bộ (phút)</span>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={apiForm.syncIntervalMinutes}
                      onChange={(e) => setApiForm((f) => ({ ...f, syncIntervalMinutes: e.target.value }))}
                      className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-navy-800 ring-1 ring-navy-100 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2.5 rounded-xl bg-navy-50/70 p-3 dark:bg-slate-900/60">
                  <input
                    type="checkbox"
                    checked={apiForm.syncEnabled}
                    onChange={(e) => setApiForm((f) => ({ ...f, syncEnabled: e.target.checked }))}
                    className="h-4 w-4 rounded border-navy-300"
                  />
                  <span className="text-xs font-bold text-navy-700 dark:text-slate-200">
                    Tự đồng bộ theo chu kỳ (tiền vào là gói tự bật, không cần ai xác nhận)
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button icon={CheckCircle} loading={savingApi} onClick={saveApi}>
                    Lưu cấu hình API
                  </Button>
                  <Button variant="secondary" icon={ArrowClockwise} loading={testingApi} onClick={testApi}>
                    Kiểm tra kết nối
                  </Button>
                  <Button variant="secondary" icon={ArrowClockwise} loading={syncing} onClick={syncNow}>
                    Đồng bộ ngay
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-navy-600 dark:text-slate-300">Kết quả kiểm tra kết nối</p>
                {!apiTest && (
                  <p className="rounded-xl bg-navy-50/70 p-3 text-[11px] font-semibold text-navy-500 dark:bg-slate-900/60 dark:text-slate-400">
                    Bấm “Kiểm tra kết nối” để gọi thử API ngân hàng — chỉ đọc, không kích hoạt gói nào.
                  </p>
                )}
                {apiTest && (
                  <div
                    className={`rounded-xl p-3 text-[11px] font-semibold ring-1 ${
                      apiTest.ok
                        ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-800/50'
                        : 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:ring-rose-800/50'
                    }`}
                  >
                    <p className="font-extrabold">{apiTest.ok ? '✓ Kết nối được' : '✗ Không kết nối được'}</p>
                    <p className="mt-0.5">{apiTest.message}</p>
                    {apiTest.ok && (
                      <ul className="mt-2 space-y-1">
                        {(apiTest.sample || []).map((t) => (
                          <li key={t.externalId} className="font-mono text-[10px]">
                            {t.when} · {t.amountText} · {t.direction} · {t.content?.slice(0, 60)}
                          </li>
                        ))}
                        {!apiTest.sample?.length && <li>Chưa có giao dịch nào gần đây.</li>}
                      </ul>
                    )}
                  </div>
                )}

                <p className="text-[11px] font-semibold text-navy-400 dark:text-slate-500">
                  Mã QR của khách:{' '}
                  <span className="font-extrabold text-navy-700 dark:text-slate-200">
                    {setup?.sync?.qrSource === 'BANK'
                      ? 'ngân hàng tạo cho từng đơn (qua API)'
                      : 'hệ thống tự sinh chuẩn VietQR (nhúng sẵn số tiền + nội dung = mã đơn)'}
                  </span>
                  .
                </p>

                {setup?.sync?.cursor && (
                  <p className="text-[11px] font-semibold text-navy-400 dark:text-slate-500">
                    Đang đọc tiếp từ giao dịch #{setup.sync.cursor} — không đọc lại giao dịch cũ.
                  </p>
                )}
                <p className="text-[11px] font-semibold text-navy-400 dark:text-slate-500">
                  Chưa có hợp đồng với ACB thì dùng SePay (đối tác chính thức của ACB, gói 0đ/tháng) — dữ liệu vẫn là tài khoản ACB của
                  bạn, chỉ khác bên đứng ra gọi API.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {data.items.some((o) => o.status === 'PENDING') && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/50">
          <Warning size={18} weight="fill" className="mt-0.5 shrink-0" />
          <span>
            Có {data.items.filter((o) => o.status === 'PENDING').length} đơn đang chờ. Kiểm tra sao kê ngân hàng rồi bấm
            <span className="font-extrabold"> Đã nhận tiền</span> — hoặc cấu hình webhook Casso/Sepay để hệ thống tự khớp lệnh.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id || 'all'}
              type="button"
              onClick={() => {
                setStatus(tab.id)
                setPage(1)
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 ring-inset transition ${
                status === tab.id
                  ? 'bg-navy-900 text-white ring-navy-900 dark:bg-white dark:text-navy-900 dark:ring-white'
                  : 'bg-white text-navy-500 ring-navy-100 hover:text-navy-800 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form
          className="relative w-full max-w-xs sm:ml-auto"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            load()
          }}
        >
          <MagnifyingGlass size={16} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300 dark:text-slate-500" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Mã đơn, email hoặc tên…"
            className="w-full rounded-xl bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-navy-800 ring-1 ring-navy-100 placeholder:text-navy-300 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
          />
        </form>
      </div>

      {unmatched.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-amber-200 dark:bg-slate-800 dark:ring-amber-800/60">
          <p className="inline-flex items-center gap-2 text-sm font-extrabold text-navy-900 dark:text-white">
            <Bank size={18} weight="fill" className="text-amber-500" />
            Tiền đã vào nhưng chưa khớp đơn ({unmatched.length})
          </p>
          <p className="mt-1 text-xs font-semibold text-navy-400 dark:text-slate-500">
            Khách ghi sai nội dung hoặc không ghi mã đơn nên hệ thống không tự kích hoạt được. Chọn đúng đơn rồi bấm
            “Gán vào đơn” — gói sẽ được kích hoạt ngay.
          </p>
          <div className="mt-3 space-y-2.5">
            {unmatched.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-end gap-3 rounded-xl bg-amber-50/60 p-3 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/10 dark:ring-amber-800/50"
              >
                <div className="min-w-[220px] flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
                    Nội dung &amp; số tiền
                  </p>
                  <p className="font-mono text-xs font-bold text-navy-800 dark:text-white">{t.content || '(trống)'}</p>
                  <p className="mt-0.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatVnd(t.amount)} · {formatDateTime(t.createdAt)}
                  </p>
                  {t.reason && (
                    <p className="mt-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{t.reason}</p>
                  )}
                </div>
                <select
                  value={attachCode[t.id] || ''}
                  onChange={(e) => setAttachCode((s) => ({ ...s, [t.id]: e.target.value }))}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-navy-800 ring-1 ring-navy-100 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                >
                  <option value="">— Chọn đơn đang chờ —</option>
                  {pendingOptions.map((o) => (
                    <option key={o.id} value={o.orderCode}>
                      {o.orderCode} · {o.planName} · {formatVnd(o.amount)} · {o.user?.email}
                    </option>
                  ))}
                </select>
                <Button size="sm" icon={CheckCircle} loading={busy === `EV${t.id}`} onClick={() => attach(t.id)}>
                  Gán vào đơn
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="Tổng đơn khớp bộ lọc" value={data.total ?? 0} icon={Receipt} />
        <Stat label="Doanh thu trên trang này" value={formatVnd(paidTotal)} icon={Bank} />
        <Stat
          label="Đang chờ thanh toán"
          value={data.items.filter((o) => o.status === 'PENDING').length}
          icon={Warning}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* ── Điện thoại: mỗi đơn một thẻ ──────────────────────────────
          Bảng 7 cột phải kéo ngang mới thấy số tiền/trạng thái, còn nút Xác nhận
          nằm ngoài màn hình — đúng lúc admin đang đứng ngoài đường cần duyệt đơn.
          Thẻ dưới đây đặt mã đơn, tiền, trạng thái và nút thao tác trong tầm ngón tay. */}
      <div className="space-y-3 lg:hidden">
        {loading && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-navy-400 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700 dark:text-slate-500">
            Đang tải…
          </div>
        )}
        {!loading && !data.items.length && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-navy-400 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700 dark:text-slate-500">
            Không có đơn nào khớp bộ lọc.
          </div>
        )}
        {!loading &&
          data.items.map((o) => (
            <article
              key={o.id}
              className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-extrabold text-navy-800 dark:text-white">{o.orderCode}</p>
                  <p className="text-[11px] font-semibold text-navy-400 dark:text-slate-500">{o.provider}</p>
                </div>
                <OrderStatusBadge status={o.status} paidAt={o.paidAt} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
                    Người dùng
                  </dt>
                  <dd className="truncate font-bold text-navy-800 dark:text-white">{o.user?.fullName || '—'}</dd>
                  <dd className="truncate font-semibold text-navy-400 dark:text-slate-500">{o.user?.email}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">Gói</dt>
                  <dd className="font-semibold text-navy-700 dark:text-slate-200">
                    {o.planName} · {o.cycle === 'YEARLY' ? 'năm' : 'tháng'}
                  </dd>
                  <dd className="font-extrabold text-navy-900 dark:text-white">{formatVnd(o.amount)}</dd>
                </div>
              </dl>

              <p className="mt-2 text-[11px] font-semibold text-navy-400 dark:text-slate-500">
                Tạo {formatDateTime(o.createdAt)}
              </p>

              <OrderActions
                o={o}
                busy={busy}
                onConfirm={setConfirming}
                onCancel={cancel}
                className="mt-3"
                fullWidth
                grid
              />
            </article>
          ))}
      </div>

      {/* ── Desktop: bảng đầy đủ ── */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700 lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-navy-50/60 text-[11px] font-bold uppercase tracking-wider text-navy-400 dark:bg-slate-900/40 dark:text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Người dùng</th>
                <th className="px-4 py-3">Gói</th>
                <th className="px-4 py-3">Số tiền</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 dark:divide-slate-700">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-navy-400 dark:text-slate-500">
                    Đang tải…
                  </td>
                </tr>
              )}
              {!loading && !data.items.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-navy-400 dark:text-slate-500">
                    Không có đơn nào khớp bộ lọc.
                  </td>
                </tr>
              )}
              {!loading &&
                data.items.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-extrabold text-navy-800 dark:text-white">{o.orderCode}</p>
                      <p className="text-[11px] font-semibold text-navy-400 dark:text-slate-500">{o.provider}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-navy-800 dark:text-white">{o.user?.fullName || '—'}</p>
                      <p className="text-xs font-semibold text-navy-400 dark:text-slate-500">{o.user?.email}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-navy-700 dark:text-slate-200">
                      {o.planName} · {o.cycle === 'YEARLY' ? 'năm' : 'tháng'}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-navy-800 dark:text-white">{formatVnd(o.amount)}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.status} paidAt={o.paidAt} />
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-navy-500 dark:text-slate-400">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderActions o={o} busy={busy} onConfirm={setConfirming} onCancel={cancel} className="justify-end" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-100 px-4 py-3 dark:border-slate-700">
            <p className="text-xs font-semibold text-navy-400 dark:text-slate-500">
              Trang {page}/{totalPages} · {data.total} đơn
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Trước
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {confirming && (
        <ConfirmModal
          order={confirming}
          value={confirming.providerRef || ''}
          onChange={(v) => setConfirming((c) => ({ ...c, providerRef: v }))}
          onCancel={() => setConfirming(null)}
          onConfirm={confirm}
          loading={busy === confirming.orderCode}
        />
      )}
    </div>
  )
}

/** Nhãn trạng thái đơn + thời điểm thanh toán (dùng cho bảng và thẻ). */
function OrderStatusBadge({ status, paidAt }) {
  return (
    <div className="shrink-0 text-right">
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ring-inset ${STATUS_BADGE[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
      {paidAt && (
        <p className="mt-1 text-[11px] font-semibold text-navy-400 dark:text-slate-500">{formatDateTime(paidAt)}</p>
      )}
    </div>
  )
}

/** Nút duyệt/huỷ + kết quả kích hoạt — dùng chung cho bảng (desktop) và thẻ (điện thoại). */
function OrderActions({ o, busy, onConfirm, onCancel, className = '', fullWidth = false, grid = false }) {
  const activation = activationOf(o)
  return (
    <div className={`${grid ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap items-center gap-2'} ${className}`}>
      {o.status === 'PENDING' && (
        <>
          <Button
            size="sm"
            icon={CheckCircle}
            fullWidth={fullWidth}
            loading={busy === o.orderCode}
            onClick={() => onConfirm(o)}
          >
            Xác nhận
          </Button>
          <Button
            size="sm"
            variant="ghost"
            fullWidth={fullWidth}
            className="text-rose-600 dark:text-rose-400"
            icon={XCircle}
            onClick={() => onCancel(o)}
          >
            Huỷ
          </Button>
        </>
      )}
      {activation && (
        <span className="text-right">
          <span className="block text-xs font-bold text-emerald-600 dark:text-emerald-400">{activation.label} ✓</span>
          {activation.detail && (
            <span className="mt-0.5 block font-mono text-[10px] font-semibold text-navy-400 dark:text-slate-500">
              {activation.detail}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

function Stat({ label, value, icon: Icon, className = '' }) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-card ring-1 ring-navy-100 dark:bg-slate-800 dark:ring-slate-700 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
        <Icon size={18} weight="fill" />
      </span>
      <p className="mt-2.5 text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">{label}</p>
      <p className="text-xl font-extrabold text-navy-900 dark:text-white">{value}</p>
    </div>
  )
}

function ConfirmModal({ order, value, onChange, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6 dark:bg-slate-800">
        <h3 className="text-lg font-extrabold text-navy-900 dark:text-white">Xác nhận đã nhận tiền</h3>
        <p className="mt-1 text-sm font-semibold text-navy-500 dark:text-slate-400">
          Đơn <span className="font-mono font-extrabold">{order.orderCode}</span> · {order.planName} ·{' '}
          {formatVnd(order.amount)} của {order.user?.email}
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-slate-500">
          Mã giao dịch ngân hàng (không bắt buộc)
        </p>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="VD: FT20260926123456"
          className="mt-1.5 w-full rounded-xl bg-navy-50 px-3 py-2.5 text-sm font-semibold text-navy-800 ring-1 ring-navy-100 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900/40 dark:text-white dark:ring-slate-700"
        />
        <p className="mt-3 rounded-xl bg-navy-50 p-3 text-xs font-semibold text-navy-500 dark:bg-slate-900/40 dark:text-slate-400">
          Gói sẽ được kích hoạt (hoặc cộng thêm kỳ mới nếu đang còn hạn) ngay khi bấm xác nhận. Bấm lại lần nữa không cộng
          thêm ngày.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Để sau
          </Button>
          <Button icon={CheckCircle} loading={loading} onClick={onConfirm}>
            Xác nhận & kích hoạt
          </Button>
        </div>
      </div>
    </div>
  )
}
