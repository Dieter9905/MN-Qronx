import crypto from 'crypto'
import prisma from '../config/prisma.js'
import config from '../config/index.js'
import ApiError from '../utils/ApiError.js'
import {
  PLANS,
  PLAN_ORDER,
  CYCLES,
  PRODUCT_IDS,
  planCatalog,
  planPrice,
  cycleDays,
  isPlanExpired,
  planLimit,
  planIsPro,
} from '../utils/planLimits.js'
import { buildVietQr } from './vietQrService.js'
import { sendEmail } from './emailService.js'
import { defaultBaseUrlOf } from '../utils/bankProviders.js'

// ─── Tiện ích ───────────────────────────────────────────────

export function formatVnd(amount) {
  return `${Number(amount || 0).toLocaleString('vi-VN')}đ`
}

/** Ngày (YYYY-MM-DD) theo múi giờ Việt Nam — dùng cho hạn mức AI theo ngày. */
export function vnDateKey(now = new Date()) {
  const tz = config.mail?.quotaTimezone || 'Asia/Ho_Chi_Minh'
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
}

/**
 * Bảng ký tự của mã đơn: A-Z0-9 nhưng bỏ 0/O/1/I (dễ đọc nhầm khi chuyển khoản).
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/**
 * Mã đơn: MNQ + 8 ký tự trong bảng ký tự trên.
 * Chỉ dùng chữ và số vì ngân hàng hay chèn khoảng trắng vào nội dung chuyển khoản.
 */
function generateOrderCode() {
  const alphabet = CODE_ALPHABET
  const bytes = crypto.randomBytes(8)
  let code = 'MNQ'
  for (let i = 0; i < 8; i += 1) code += alphabet[bytes[i] % alphabet.length]
  return code
}

/** Bỏ mọi ký tự không phải chữ/số và viết hoa — để khớp nội dung chuyển khoản. */
function normalizeRef(text) {
  return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// ─── Cấu hình nhận tiền ─────────────────────────────────────

/**
 * Danh sách ngân hàng hay dùng (BIN theo chuẩn NAPAS/VietQR). ACB đứng đầu vì
 * đó là tài khoản nhận tiền của dự án; admin vẫn nhập tay được mã khác.
 */
export const BANK_OPTIONS = [
  { bin: '970416', code: 'ACB', name: 'Ngân hàng TMCP Á Châu (ACB)' },
  { bin: '970436', code: 'VCB', name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)' },
  { bin: '970407', code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)' },
  { bin: '970422', code: 'MB', name: 'Ngân hàng TMCP Quân đội (MB Bank)' },
  { bin: '970415', code: 'ICB', name: 'Ngân hàng TMCP Công thương Việt Nam (VietinBank)' },
  { bin: '970418', code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)' },
  { bin: '970405', code: 'VBA', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn (Agribank)' },
  { bin: '970403', code: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)' },
  { bin: '970423', code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong (TPBank)' },
  { bin: '970432', code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)' },
  { bin: '970441', code: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam (VIB)' },
  { bin: '970443', code: 'SHB', name: 'Ngân hàng TMCP Sài Gòn – Hà Nội (SHB)' },
  { bin: '970426', code: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam (MSB)' },
  { bin: '970437', code: 'HDB', name: 'Ngân hàng TMCP Phát triển TP.HCM (HDBank)' },
  { bin: '970431', code: 'EIB', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam (Eximbank)' },
  { bin: '970440', code: 'SEAB', name: 'Ngân hàng TMCP Đông Nam Á (SeABank)' },
  { bin: '970449', code: 'LPB', name: 'Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)' },
  { bin: '970428', code: 'NAB', name: 'Ngân hàng TMCP Nam Á (Nam A Bank)' },
  { bin: '970448', code: 'OCB', name: 'Ngân hàng TMCP Phương Đông (OCB)' },
  { bin: '970409', code: 'BAB', name: 'Ngân hàng TMCP Bắc Á (Bac A Bank)' },
]

// Bản ghi cấu hình đọc từ DB được nhớ tạm vài giây để webhook không phải truy vấn
// thêm mỗi giao dịch; lưu cấu hình xong thì xoá nhớ tạm ngay nên đổi là ăn liền.
let settingsCache = { at: 0, value: null }
const SETTINGS_TTL_MS = 15_000

/** Cấu hình nhận tiền lưu trong DB (dòng duy nhất, settingId = 1). */
export async function billingSettings({ fresh = false } = {}) {
  if (!fresh && settingsCache.value && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.value
  }
  const row = await prisma.billingSetting.findUnique({ where: { settingId: 1 } })
  settingsCache = { at: Date.now(), value: row || null }
  return settingsCache.value
}

export function clearBillingSettingsCache() {
  settingsCache = { at: 0, value: null }
}

/**
 * Tài khoản nhận tiền đang có hiệu lực: cấu hình trong app trước, thiếu thì lấy
 * từ biến môi trường (BANK_ID / BANK_ACCOUNT / BANK_ACCOUNT_NAME).
 */
export async function effectiveBank() {
  const env = config.billing?.bank || {}
  const saved = await billingSettings()
  const bank = {
    id: saved?.bankId || env.id || '',
    account: saved?.bankAccount || env.account || '',
    owner: saved?.bankAccountName || env.owner || '',
    template: saved?.qrTemplate || env.template || 'compact2',
  }
  return {
    ...bank,
    configured: Boolean(bank.id && bank.account),
    source: saved?.bankId || saved?.bankAccount ? 'APP' : bank.id || bank.account ? 'ENV' : 'NONE',
  }
}

/** Mã xác thực webhook đang có hiệu lực (DB trước, rồi tới biến môi trường). */
export async function webhookSecret() {
  const saved = await billingSettings()
  return saved?.webhookSecret || config.billing?.webhookSecret || ''
}

/** Tên ngân hàng theo BIN/mã viết tắt để hiển thị cho khách. */
export function bankNameOf(bankId) {
  const key = String(bankId || '').toUpperCase()
  const found = BANK_OPTIONS.find((b) => b.bin === key || b.code === key)
  return found ? found.name : ''
}

/**
 * BIN 6 số của ngân hàng. Mã QR bắt buộc dùng BIN, nên nếu admin điền mã viết tắt
 * (ACB, VCB…) thì đổi sang BIN tương ứng.
 */
export function bankBinOf(bankId) {
  const key = String(bankId || '').trim().toUpperCase()
  if (/^[0-9]{6}$/.test(key)) return key
  return BANK_OPTIONS.find((b) => b.code === key)?.bin || ''
}

/** Cấu hình tài khoản nhận tiền (dùng cho đơn hàng và cho màn hình quản trị). */
export async function bankConfig() {
  const bank = await effectiveBank()
  return {
    configured: bank.configured,
    bankId: bank.id,
    bankName: bankNameOf(bank.id),
    accountNumber: bank.account,
    accountName: bank.owner,
    qrTemplate: bank.template || 'compact2',
    source: bank.source,
  }
}

/**
 * Thông tin chuyển khoản của một đơn, gồm MÃ QR do chính hệ thống sinh (chuẩn
 * VietQR/EMVCo, đã nhúng số tiền + nội dung = mã đơn).
 *
 * Thứ tự ưu tiên mã QR: mã do ngân hàng tạo qua API (nếu đã cấu hình và tạo được)
 * → mã hệ thống tự sinh → ảnh từ dịch vụ vietqr.io (chỉ còn là phương án dự phòng
 * khi thiếu BIN ngân hàng).
 */
async function paymentInstruction(order) {
  const bank = await effectiveBank()
  let vietQrUrl = null
  if (bank.configured) {
    const params = new URLSearchParams({
      amount: String(order.amount),
      addInfo: order.transferContent,
    })
    if (bank.owner) params.set('accountName', bank.owner)
    vietQrUrl = `https://img.vietqr.io/image/${encodeURIComponent(bank.id)}-${encodeURIComponent(bank.account)}-${bank.template || 'compact2'}.png?${params.toString()}`
  }

  // Mã QR của đơn: ưu tiên bản đã lưu trên đơn (ngân hàng tạo), rồi mới tự sinh
  let qrPayload = order.qrPayload || null
  let qrImageDataUrl = order.qrImageUrl || null
  let qrSource = order.qrSource || null
  let qrError = null

  if (!qrPayload && bank.configured) {
    const bin = bankBinOf(bank.id)
    if (bin) {
      try {
        const qr = await buildVietQr({
          bankBin: bin,
          accountNumber: bank.account,
          amount: order.amount,
          content: order.transferContent,
          merchantName: bank.owner,
          oneTime: true,
        })
        qrPayload = qr.payload
        qrImageDataUrl = qr.imageDataUrl
        qrSource = 'SYSTEM'
      } catch (err) {
        qrError = err.message
      }
    } else {
      qrError = 'Chưa nhận diện được BIN của ngân hàng để sinh mã QR'
    }
  }

  return {
    configured: bank.configured,
    bankId: bank.id,
    bankName: bankNameOf(bank.id),
    accountNumber: bank.account,
    accountName: bank.owner,
    amount: order.amount,
    transferContent: order.transferContent,
    // Mã QR: payload chuẩn EMVCo + ảnh PNG dạng data URL (không cần dịch vụ ngoài)
    qrPayload,
    qrImageDataUrl,
    qrSource,
    qrError,
    // Giữ lại để không phá vỡ chỗ đang dùng ảnh của vietqr.io
    vietQrUrl,
  }
}

/** Lưu cấu hình nhận tiền (chỉ admin). `null` = giữ nguyên giá trị đang có. */
export async function saveBillingSettings(input, adminId = null) {
  const current = (await billingSettings({ fresh: true })) || {}
  const next = {
    bankId: input.bankId === undefined ? current.bankId : input.bankId,
    bankAccount: input.bankAccount === undefined ? current.bankAccount : input.bankAccount,
    bankAccountName: input.bankAccountName === undefined ? current.bankAccountName : input.bankAccountName,
    qrTemplate: input.qrTemplate === undefined ? current.qrTemplate : input.qrTemplate,
    bankApiProvider: input.bankApiProvider === undefined ? current.bankApiProvider : input.bankApiProvider,
    bankApiBaseUrl: input.bankApiBaseUrl === undefined ? current.bankApiBaseUrl : input.bankApiBaseUrl,
    bankApiClientId: input.bankApiClientId === undefined ? current.bankApiClientId : input.bankApiClientId,
    bankApiTokenUrl: input.bankApiTokenUrl === undefined ? current.bankApiTokenUrl : input.bankApiTokenUrl,
    bankApiHistoryPath: input.bankApiHistoryPath === undefined ? current.bankApiHistoryPath : input.bankApiHistoryPath,
    bankApiQrPath: input.bankApiQrPath === undefined ? current.bankApiQrPath : input.bankApiQrPath,
    bankApiAccount: input.bankApiAccount === undefined ? current.bankApiAccount : input.bankApiAccount,
    // Bí mật: không gửi lên thì GIỮ NGUYÊN giá trị đang lưu (tránh ghi đè bằng rỗng)
    bankApiToken: input.bankApiToken === undefined ? undefined : input.bankApiToken,
    bankApiClientSecret: input.bankApiClientSecret === undefined ? undefined : input.bankApiClientSecret,
    syncEnabled: input.syncEnabled,
    syncIntervalMinutes: input.syncIntervalMinutes,
  }

  const bankId = String(next.bankId || '').trim().toUpperCase()
  const account = String(next.bankAccount || '').replace(/\s+/g, '')
  const owner = String(next.bankAccountName || '').trim().toUpperCase()

  // ─── API ngân hàng (kéo giao dịch về, không cần webhook) ───
  const apiProvider = String(next.bankApiProvider || '').trim().toUpperCase()
  if (apiProvider && !['SEPAY', 'ACB'].includes(apiProvider)) {
    throw ApiError.badRequest('Nhà cung cấp API chỉ nhận SEPAY (SePay API Giao dịch) hoặc ACB (ACB ONE CONNECT).')
  }
  const urlFields = {
    bankApiBaseUrl: next.bankApiBaseUrl,
    bankApiTokenUrl: next.bankApiTokenUrl,
  }
  for (const [field, value] of Object.entries(urlFields)) {
    const text = String(value || '').trim()
    // Bắt buộc https, chỉ nới cho địa chỉ nội bộ khi tự chạy thử (http://localhost…)
    const isLoopback = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(text)
    if (text && !/^https:\/\/\S+$/i.test(text) && !isLoopback) {
      throw ApiError.badRequest(`${field === 'bankApiTokenUrl' ? 'Token URL' : 'Base URL'} phải là địa chỉ https:// hợp lệ.`)
    }
    if (text.length > 190) throw ApiError.badRequest('Địa chỉ API tối đa 190 ký tự.')
  }
  const historyPath = String(next.bankApiHistoryPath || '').trim()
  const qrPath = String(next.bankApiQrPath || '').trim()
  for (const [label, value] of [
    ['lấy lịch sử giao dịch', historyPath],
    ['tạo QR động', qrPath],
  ]) {
    if (value && !/^(https?:\/\/|\/)\S*$/i.test(value)) {
      throw ApiError.badRequest(`Đường dẫn ${label} phải bắt đầu bằng / hoặc https://`)
    }
    if (value.length > 190) throw ApiError.badRequest(`Đường dẫn ${label} tối đa 190 ký tự.`)
  }

  const apiAccount = String(next.bankApiAccount || '').replace(/\s+/g, '')
  if (apiAccount && !/^[0-9]{6,25}$/.test(apiAccount)) {
    throw ApiError.badRequest('Số tài khoản gửi lên API chỉ gồm 6–25 chữ số.')
  }
  const interval =
    next.syncIntervalMinutes === undefined || next.syncIntervalMinutes === '' || next.syncIntervalMinutes === null
      ? undefined
      : Number(next.syncIntervalMinutes)
  if (interval !== undefined && (!Number.isFinite(interval) || interval < 1 || interval > 1440)) {
    throw ApiError.badRequest('Chu kỳ đồng bộ phải từ 1 đến 1440 phút.')
  }
  // "••••" là giá trị che từ giao diện → giữ nguyên bí mật đang lưu
  const keepSecret = (value) => (value === undefined || String(value).trim() === '••••' ? undefined : String(value).trim())
  const apiToken = keepSecret(next.bankApiToken)
  const apiClientSecret = keepSecret(next.bankApiClientSecret)
  if (apiToken !== undefined && apiToken.length > 255) throw ApiError.badRequest('API token tối đa 255 ký tự.')
  if (apiClientSecret !== undefined && apiClientSecret.length > 255) {
    throw ApiError.badRequest('Client secret tối đa 255 ký tự.')
  }

  // Đổi nhà cung cấp mà không nhập Base URL thì tự dùng địa chỉ mặc định của nhà
  // cung cấp mới — tránh gọi SePay bằng địa chỉ của ACB (hoặc ngược lại).
  let baseUrlValue = next.bankApiBaseUrl
  const providerChanged = next.bankApiProvider !== undefined && apiProvider !== (current.bankApiProvider || '')
  const baseUrlSent = input.bankApiBaseUrl !== undefined && String(input.bankApiBaseUrl).trim() !== ''
  if (providerChanged && !baseUrlSent) {
    baseUrlValue = defaultBaseUrlOf(apiProvider)
  }

  const effectiveToken = apiToken !== undefined ? apiToken : current.bankApiToken || ''
  const effectiveClientSecret = apiClientSecret !== undefined ? apiClientSecret : current.bankApiClientSecret || ''
  const effectiveTokenUrl = urlFields.bankApiTokenUrl !== undefined ? String(next.bankApiTokenUrl || '').trim() : current.bankApiTokenUrl || ''
  const effectiveHistory = next.bankApiHistoryPath !== undefined ? historyPath : current.bankApiHistoryPath || ''
  const effectiveProvider = next.bankApiProvider !== undefined ? apiProvider : current.bankApiProvider || ''
  const credentialsReady =
    effectiveProvider === 'SEPAY'
      ? Boolean(effectiveToken)
      : effectiveProvider === 'ACB'
        ? Boolean(effectiveTokenUrl && effectiveClientSecret && effectiveHistory)
        : false

  const syncEnabled =
    next.syncEnabled === undefined ? undefined : next.syncEnabled === true || next.syncEnabled === 'true'
  if (syncEnabled === true && !credentialsReady) {
    throw ApiError.badRequest(
      'Chưa đủ thông tin để bật đồng bộ tự động: chọn nhà cung cấp rồi điền API token (SePay) hoặc Token URL + Client ID + Client secret + đường dẫn (ACB).'
    )
  }

  if (bankId && !/^[0-9]{6}$|^[A-Z]{2,8}$/.test(bankId)) {
    throw ApiError.badRequest('Mã ngân hàng phải là BIN 6 số (vd 970416 cho ACB) hoặc mã viết tắt (ACB).')
  }
  if (account && !/^[0-9]{6,25}$/.test(account)) {
    throw ApiError.badRequest('Số tài khoản chỉ gồm 6–25 chữ số, không khoảng trắng.')
  }
  if (owner && !/^[A-Z0-9 .'-]{3,80}$/.test(owner)) {
    throw ApiError.badRequest('Tên chủ tài khoản phải viết không dấu, viết hoa — đúng như tên ngân hàng đang hiển thị.')
  }
  if (next.qrTemplate && !['compact', 'compact2', 'qr_only', 'print'].includes(next.qrTemplate)) {
    throw ApiError.badRequest('Mẫu QR không hợp lệ')
  }

  const data = {
    bankId: bankId || null,
    bankAccount: account || null,
    bankAccountName: owner || null,
    qrTemplate: next.qrTemplate || null,
    ...(next.bankApiProvider !== undefined ? { bankApiProvider: apiProvider || null } : {}),
    ...(baseUrlValue !== undefined ? { bankApiBaseUrl: String(baseUrlValue || '').trim() || null } : {}),
    ...(apiToken !== undefined ? { bankApiToken: apiToken || null } : {}),
    ...(next.bankApiClientId !== undefined
      ? { bankApiClientId: String(next.bankApiClientId || '').trim().slice(0, 190) || null }
      : {}),
    ...(apiClientSecret !== undefined ? { bankApiClientSecret: apiClientSecret || null } : {}),
    ...(next.bankApiTokenUrl !== undefined ? { bankApiTokenUrl: String(next.bankApiTokenUrl || '').trim() || null } : {}),
    ...(next.bankApiHistoryPath !== undefined ? { bankApiHistoryPath: historyPath || null } : {}),
    ...(next.bankApiQrPath !== undefined ? { bankApiQrPath: qrPath || null } : {}),
    ...(next.bankApiAccount !== undefined ? { bankApiAccount: apiAccount || null } : {}),
    ...(syncEnabled !== undefined ? { syncEnabled } : {}),
    ...(interval !== undefined ? { syncIntervalMinutes: interval } : {}),
    updatedBy: adminId,
  }
  await prisma.billingSetting.upsert({ where: { settingId: 1 }, create: { settingId: 1, ...data }, update: data })
  clearBillingSettingsCache()
  return bankConfig()
}

/** Sinh mã xác thực webhook mới (64 ký tự hex) — dán vào SePay/Casso. */
export async function rotateWebhookSecret(adminId = null) {
  const secret = crypto.randomBytes(32).toString('hex')
  await prisma.billingSetting.upsert({
    where: { settingId: 1 },
    create: { settingId: 1, webhookSecret: secret, updatedBy: adminId },
    update: { webhookSecret: secret, updatedBy: adminId },
  })
  clearBillingSettingsCache()
  return secret
}

function serializeOrder(order) {
  return {
    id: order.orderId,
    orderCode: order.orderCode,
    plan: order.plan,
    planName: PLANS[order.plan]?.name || order.plan,
    cycle: order.cycle,
    amount: order.amount,
    status: order.status,
    provider: order.provider,
    // Ai/kênh nào đã mở gói cho đơn này: mã giao dịch ngân hàng (WEBHOOK) hay id
    // admin bấm xác nhận. Thiếu hai trường này thì trang quản trị chỉ hiện
    // "Đã kích hoạt ✓" và rất dễ tưởng một cú bấm xác nhận làm xong hai đơn.
    providerRef: order.providerRef ?? null,
    confirmedBy: order.confirmedBy ?? null,
    transferContent: order.transferContent,
    paidAt: order.paidAt,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    note: order.note,
  }
}

function serializeSubscription(sub) {
  if (!sub) return null
  return {
    id: sub.subscriptionId,
    plan: sub.plan,
    planName: PLANS[sub.plan]?.name || sub.plan,
    cycle: sub.cycle,
    provider: sub.provider,
    status: sub.status,
    startedAt: sub.startedAt,
    expiresAt: sub.expiresAt,
    autoRenew: sub.autoRenew,
  }
}

// ─── Sản phẩm & tổng quan gói ───────────────────────────────

export async function listProducts() {
  const bank = await effectiveBank()
  return {
    cycles: Object.entries(CYCLES).map(([id, c]) => ({
      id,
      label: c.label,
      days: c.days,
      monthsFree: c.monthsFree || 0,
    })),
    plans: planCatalog(),
    payments: {
      // Chuyển khoản ngân hàng có sẵn khi đã cấu hình tài khoản nhận tiền
      bankTransfer: bank.configured,
      bankName: bankNameOf(bank.id),
      // Play Billing chỉ bật trong app Android (xem docs/billing.md)
      playBilling: false,
      trialDays: config.billing?.trialDays || 0,
    },
    productIds: PRODUCT_IDS,
  }
}

export async function getOverview(userId) {
  await expireStaleOrders(userId)

  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      plan: true,
      planStartedAt: true,
      planExpiresAt: true,
      trialStartedAt: true,
    },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')

  const expired = isPlanExpired(user)
  const plan = expired ? 'FREE' : user.plan
  const planExpiresAt = expired ? null : user.planExpiresAt
  const daysLeft = planExpiresAt
    ? Math.ceil((new Date(planExpiresAt) - Date.now()) / 86400000)
    : null

  const [subscription, orders, aiUsage] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { subscriptionId: 'desc' },
    }),
    prisma.paymentOrder.findMany({
      where: { userId },
      orderBy: { orderId: 'desc' },
      take: 10,
    }),
    currentAiUsage(userId),
  ])

  const trialStarted = Boolean(user.trialStartedAt)
  const everPaid = await prisma.subscription.count({
    where: { userId, provider: { in: ['VIETQR', 'WEBHOOK', 'MOMO', 'PLAY', 'ADMIN'] } },
  })

  return {
    plan,
    planName: PLANS[plan]?.name || plan,
    planStartedAt: expired ? null : user.planStartedAt,
    planExpiresAt,
    daysLeft,
    limits: PLANS[plan],
    catalog: planCatalog(),
    subscription: serializeSubscription(subscription),
    orders: orders.map(serializeOrder),
    aiUsage,
    trial: {
      days: config.billing?.trialDays || 0,
      startedAt: user.trialStartedAt,
      eligible: !trialStarted && !everPaid && plan === 'FREE',
    },
    canUpgrade: !planIsPro(plan),
  }
}

async function currentAiUsage(userId) {
  const date = vnDateKey()
  const plan = await prisma.user.findUnique({ where: { userId }, select: { plan: true, planExpiresAt: true } })
  const effective = !plan || isPlanExpired(plan) ? 'FREE' : plan.plan
  const limit = planLimit(effective, 'aiDailyLimit')
  const row = await prisma.aiUsage.findUnique({
    where: { userId_usageDate: { userId, usageDate: date } },
  })
  const used = row?.count || 0
  return {
    date,
    used,
    limit: limit === Infinity ? null : limit,
    remaining: limit === Infinity ? null : Math.max(0, limit - used),
  }
}

// ─── Đơn hàng ───────────────────────────────────────────────

export async function createOrder(userId, { plan, cycle = 'MONTHLY' }) {
  if (!PLANS[plan] || plan === 'FREE') {
    throw ApiError.badRequest('Gói không hợp lệ. Chỉ có thể mua gói Plus, Pro hoặc Pro Gia đình.')
  }
  if (!CYCLES[cycle]) {
    throw ApiError.badRequest('Kỳ thanh toán không hợp lệ')
  }

  // Đang dùng một chỗ trong gói gia đình của người khác: không cho mua riêng ở đây,
  // vì applyPlanChange sẽ đóng luôn dòng ghế và để hai nguồn quyền lợi đánh nhau.
  const seat = await prisma.subscription.findFirst({
    where: { userId, provider: 'FAMILY', status: 'ACTIVE' },
    select: { subscriptionId: true },
  })
  if (seat) {
    throw ApiError.badRequest(
      'Bạn đang dùng gói Pro Gia đình của người thân nên không cần mua riêng. Nếu vẫn muốn tự trả tiền, hãy rời gói gia đình trước ở mục Gói.',
    )
  }

  const amount = planPrice(plan, cycle)
  if (!amount) throw ApiError.badRequest('Chưa có giá cho gói này')

  // Còn đơn chưa thanh toán cùng gói + kỳ → dùng lại, tránh tạo trùng
  const pending = await prisma.paymentOrder.findFirst({
    where: { userId, plan, cycle, status: 'PENDING', expiresAt: { gt: new Date() } },
    orderBy: { orderId: 'desc' },
  })
  if (pending) {
    return { order: serializeOrder(pending), payment: await paymentInstruction(pending), reused: true }
  }

  const ttlHours = config.billing?.orderTtlHours || 48
  // transferContent chính là orderCode để webhook khớp lệnh chuyển khoản
  const orderCode = generateOrderCode()
  const order = await prisma.paymentOrder.create({
    data: {
      orderCode,
      userId,
      plan,
      cycle,
      amount,
      status: 'PENDING',
      provider: 'VIETQR',
      transferContent: orderCode,
      expiresAt: new Date(Date.now() + ttlHours * 3600_000),
    },
  })

  return { order: serializeOrder(order), payment: await paymentInstruction(order), reused: false }
}

export async function getOrder(userId, orderCode) {
  const order = await prisma.paymentOrder.findUnique({ where: { orderCode: normalizeOrderCode(orderCode) } })
  if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng')
  if (order.userId !== userId) throw ApiError.forbidden('Đơn hàng không thuộc về bạn')
  await expireOrderIfStale(order)
  return { order: serializeOrder(order), payment: await paymentInstruction(order) }
}

export async function listOrders({ status, keyword, page = 1, pageSize = 20 } = {}) {
  const where = {}
  if (status) where.status = status
  if (keyword) {
    where.OR = [
      { orderCode: { contains: keyword.toUpperCase() } },
      { user: { email: { contains: keyword, mode: 'insensitive' } } },
      { user: { fullName: { contains: keyword, mode: 'insensitive' } } },
    ]
  }

  const [total, items] = await Promise.all([
    prisma.paymentOrder.count({ where }),
    prisma.paymentOrder.findMany({
      where,
      orderBy: { orderId: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { userId: true, email: true, fullName: true, plan: true } } },
    }),
  ])

  return {
    items: items.map((o) => ({
      ...serializeOrder(o),
      user: { id: o.user.userId, email: o.user.email, fullName: o.user.fullName, plan: o.user.plan },
    })),
    total,
    page,
    pageSize,
    // Cho màn hình quản trị biết đã cấu hình tài khoản nhận tiền hay chưa
    bank: await bankConfig(),
  }
}

export async function userCancelOrder(userId, orderCode) {
  const order = await prisma.paymentOrder.findUnique({ where: { orderCode: normalizeOrderCode(orderCode) } })
  if (!order || order.userId !== userId) throw ApiError.notFound('Không tìm thấy đơn hàng')
  if (order.status === 'PAID') throw ApiError.badRequest('Đơn đã thanh toán, không thể huỷ')
  const updated = await prisma.paymentOrder.update({
    where: { orderId: order.orderId },
    data: { status: 'CANCELLED' },
  })
  return serializeOrder(updated)
}

function normalizeOrderCode(code) {
  return String(code || '').trim().toUpperCase()
}

async function expireOrderIfStale(order) {
  if (order.status !== 'PENDING') return order
  if (new Date(order.expiresAt) > new Date()) return order
  return prisma.paymentOrder.update({ where: { orderId: order.orderId }, data: { status: 'EXPIRED' } })
}

/** Đánh dấu các đơn PENDING đã quá hạn (chạy khi user xem trang thanh toán). */
export async function expireStaleOrders(userId) {
  return prisma.paymentOrder.updateMany({
    where: { userId, status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })
}

// ─── Nhắc trước khi hết hạn ─────────────────────────────────
// Chuyển khoản không tự gia hạn được, nên phần giữ khách nằm ở đây: email nhắc
// khi còn ≤ 3 ngày kèm nút "Gia hạn ngay", và danh sách cho admin chủ động liên hệ.

const DAY_MS = 86400000

/**
 * Số ngày còn lại tới hạn, làm tròn LÊN cho khớp với `daysLeft` mà trang Gói và
 * Dashboard đang dùng (còn 2 ngày rưỡi vẫn là “còn 3 ngày” thay vì lệch một ngày).
 */
export function daysUntil(expiresAt) {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS)
}

/** Ngày giờ dạng dd/mm/yyyy theo múi giờ Việt Nam. */
function vnDate(date) {
  return new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

/**
 * Danh sách gói sắp hết hạn trong N ngày tới — admin xem ở /admin/orders để
 * chủ động nhắc khách. Kèm trạng thái "đã nhắc chưa" cho từng kỳ.
 */
export async function listExpiringSoon({ daysAhead = 7 } = {}) {
  const now = new Date()
  const horizon = new Date(now.getTime() + daysAhead * DAY_MS)
  const rows = await prisma.subscription.findMany({
    // Ghế trong gói gia đình (provider FAMILY) bị loại khỏi bảng này: người trong
    // nhà không tự gia hạn được — nhắc họ "mua kỳ mới" là nhắc sai người.
    where: {
      status: 'ACTIVE',
      plan: { not: 'FREE' },
      provider: { not: 'FAMILY' },
      expiresAt: { gte: now, lte: horizon },
    },
    include: { user: { select: { email: true, fullName: true } } },
    orderBy: { expiresAt: 'asc' },
    take: 100,
  })

  return rows.map((s) => ({
    subscriptionId: s.subscriptionId,
    plan: s.plan,
    planName: PLANS[s.plan]?.name || s.plan,
    cycle: s.cycle,
    expiresAt: s.expiresAt,
    daysLeft: daysUntil(s.expiresAt),
    reminderSentAt: s.reminderSentAt,
    reminded: Boolean(s.reminderSentAt),
    user: { email: s.user.email, fullName: s.user.fullName },
  }))
}

/**
 * Gửi email nhắc trước khi hết hạn — mỗi kỳ đúng một lần (chốt bằng cột
 * reminder_sent_at). Gửi thất bại thì KHÔNG đánh dấu đã nhắc để lần chạy sau
 * tự gửi lại; gửi thành công thì ghi lại ngay nên chạy song song không trùng.
 *
 * @param {object} [opts]
 * @param {number} [opts.daysBefore] nhắc khi còn ≤ bao nhiêu ngày (mặc định 3)
 * @param {function} [opts.mailer] hàm gửi thư — đổi được trong test
 * @param {function} [opts.now] đồng hồ ảo cho test
 */
export async function sendRenewalReminders({
  daysBefore = 3,
  mailer = sendEmail,
  now = () => new Date(),
} = {}) {
  const from = now()
  const horizon = new Date(from.getTime() + daysBefore * DAY_MS)

  const due = await prisma.subscription.findMany({
    // Cùng lý do với bảng "sắp hết hạn" bên trên: ghế gia đình không tự gia hạn được,
    // người duy nhất cần nhắc là chủ gói — mà chủ gói đã có dòng riêng rồi.
    where: {
      status: 'ACTIVE',
      plan: { not: 'FREE' },
      provider: { not: 'FAMILY' },
      expiresAt: { gte: from, lte: horizon },
      reminderSentAt: null,
    },
    include: { user: { select: { email: true, fullName: true } } },
    orderBy: { expiresAt: 'asc' },
    take: 200,
  })
  if (due.length === 0) return { due: 0, sent: 0, failed: 0 }

  const link = `${config.frontendUrl.replace(/\/$/, '')}/app/billing`
  let sent = 0
  let failed = 0

  for (const sub of due) {
    const planName = PLANS[sub.plan]?.name || sub.plan
    const days = daysUntil(sub.expiresAt)
    const expires = vnDate(sub.expiresAt)
    const subject = `Gói ${planName} của bạn còn ${days} ngày nữa là hết hạn`
    const text = [
      `Chào ${sub.user.fullName || 'bạn'},`,
      '',
      `Gói ${planName} của bạn hết hạn vào ngày ${expires} — còn ${days} ngày nữa.`,
      'Vì chuyển khoản không tự gia hạn nên bạn cần mua kỳ mới để giữ nguyên quyền lợi.',
      `Gia hạn ngay: ${link}`,
      '',
      'MN-Qronx',
    ].join('\n')
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2430;line-height:1.6">
        <h2 style="margin:0 0 12px;font-size:20px">Gói ${planName} sắp hết hạn</h2>
        <p>Xin chào ${sub.user.fullName || 'bạn'},</p>
        <p>Gói <b>${planName}</b> của bạn hết hạn vào <b>${expires}</b> — còn <b>${days} ngày</b> nữa.</p>
        <p>Vì chuyển khoản không tự gia hạn được, bạn cần mua kỳ mới để giữ nguyên quyền lợi, dữ liệu và hạn mức.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">Gia hạn ngay</a>
        </p>
        <p style="color:#6b7280;font-size:13px">Liên kết: ${link}</p>
      </div>`

    try {
      await mailer({ to: sub.user.email, subject, text, html })
      await prisma.subscription.update({
        where: { subscriptionId: sub.subscriptionId },
        data: { reminderSentAt: from },
      })
      sent += 1
    } catch (err) {
      failed += 1
      console.error(`[Billing] Không gửi được nhắc hạn cho ${sub.user.email}: ${err.message}`)
    }
  }

  return { due: due.length, sent, failed }
}

// ─── Kích hoạt gói ──────────────────────────────────────────

/**
 * Ghi lịch sử giao dịch chống trùng.
 *
 * Dùng chung cho webhook (có thể gửi lại nhiều lần) và bộ đồng bộ ngân hàng.
 *
 * Dùng createMany + skipDuplicates thay vì để `create` ném lỗi P2002 rồi bắt:
 * bộ đồng bộ ngân hàng đọc lại giao dịch cũ MỖI PHÚT, nên cách cũ làm Prisma in
 * ra một dòng `prisma:error Unique constraint failed (external_id)` đều đặn —
 * nhìn như hệ thống đang lỗi trong khi thực ra đó là "giao dịch đã xử lý rồi".
 * Sai một chỗ đáng lẽ bình thường thành báo động giả thì lúc có lỗi thật sẽ
 * không ai còn tin nhật ký nữa.
 *
 * @returns {Promise<boolean>} true nếu sự kiện này là mới
 */
export async function registerBillingEvent({ provider, eventType, externalId, orderId, amount, payload }) {
  const res = await prisma.billingEvent.createMany({
    data: [
      {
        provider,
        eventType,
        externalId: String(externalId).slice(0, 190),
        orderId: orderId ?? null,
        amount: amount ?? null,
        payload: payload ? JSON.parse(JSON.stringify(payload)) : undefined,
      },
    ],
    // Trùng external_id → bỏ qua, không ném lỗi (đã xử lý ở lần trước)
    skipDuplicates: true,
  })
  return res.count > 0
}

/**
 * Áp dụng quyền lợi gói cho user: cập nhật user.plan + mốc thời gian và ghi
 * một dòng Subscription để có lịch sử.
 *
 * Quy tắc cộng dồn: nếu đang còn hạn trả phí thì kỳ mới được cộng tiếp từ ngày
 * hết hạn hiện tại (người dùng không mất những ngày đã trả tiền).
 */
export async function applyPlanChange(params) {
  // Khi đã nằm trong transaction của người gọi (xác nhận đơn, dùng thử) thì
  // dùng chung client đó để quyền lợi và trạng thái đơn cùng sống/chết với nhau.
  if (params.client) return applyPlanChangeInner(params)
  return prisma.$transaction((tx) => applyPlanChangeInner({ ...params, client: tx }))
}

async function applyPlanChangeInner({
  userId,
  plan,
  cycle = 'MONTHLY',
  provider = 'ADMIN',
  providerRef = null,
  note = null,
  days = null,
  autoRenew = false,
  client = prisma,
}) {
  if (!PLANS[plan] || plan === 'FREE') {
    throw ApiError.badRequest('Gói áp dụng không hợp lệ')
  }

  const now = new Date()
  const user = await client.user.findUnique({
    where: { userId },
    select: { plan: true, planStartedAt: true, planExpiresAt: true },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')

  const activePaid = user.plan !== 'FREE' && user.planExpiresAt && new Date(user.planExpiresAt) > now
  const periodDays = days || cycleDays(cycle)
  const base = activePaid ? new Date(user.planExpiresAt) : now
  const expiresAt = new Date(base.getTime() + periodDays * 86400000)
  const planStartedAt = activePaid && user.plan === plan && user.planStartedAt ? user.planStartedAt : now

  // Đóng các dòng ACTIVE cũ TRƯỚC, rồi mới ghi dòng mới → không cần vá lại trạng thái
  await client.subscription.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: { status: 'EXPIRED' },
  })

  const updatedUser = await client.user.update({
    where: { userId },
    data: { plan, planStartedAt, planExpiresAt: expiresAt },
    select: {
      userId: true,
      fullName: true,
      email: true,
      plan: true,
      planStartedAt: true,
      planExpiresAt: true,
    },
  })

  const subscription = await client.subscription.create({
    data: {
      userId,
      plan,
      cycle,
      provider,
      status: 'ACTIVE',
      providerRef: providerRef ? String(providerRef).slice(0, 190) : null,
      startedAt: now,
      expiresAt,
      autoRenew,
      note,
    },
  })

  return {
    user: {
      ...updatedUser,
      planName: PLANS[plan]?.name || plan,
      daysAdded: periodDays,
    },
    subscription: serializeSubscription({ ...subscription, status: 'ACTIVE' }),
  }
}

/**
 * Xác nhận một đơn đã thanh toán → kích hoạt gói. Idempotent: gọi lại nhiều lần
 * (admin bấm hai lần, webhook gửi lại) chỉ kích hoạt một lần.
 */
export async function confirmOrder(orderCode, { provider = 'VIETQR', providerRef = null, adminId = null, note = null } = {}) {
  const code = normalizeOrderCode(orderCode)
  const order = await prisma.paymentOrder.findUnique({ where: { orderCode: code } })
  if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng')
  if (order.status === 'CANCELLED') throw ApiError.badRequest('Đơn đã bị huỷ')

  // Đánh dấu đã trả tiền VÀ kích hoạt gói trong CÙNG một transaction: hoặc cả
  // hai cùng thành công, hoặc không gì thay đổi (không có cảnh đơn đã thu tiền
  // mà gói không được kích hoạt, cũng không có cảnh kích hoạt hai lần).
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.paymentOrder.findUnique({ where: { orderId: order.orderId } })
    if (fresh.status === 'PAID') {
      return { order: serializeOrder(fresh), applied: false, user: null }
    }

    const applied = await applyPlanChange({
      userId: fresh.userId,
      plan: fresh.plan,
      cycle: fresh.cycle,
      provider,
      providerRef: providerRef || fresh.orderCode,
      note: `Đơn ${fresh.orderCode} – ${formatVnd(fresh.amount)}`,
      days: cycleDays(fresh.cycle),
      client: tx,
    })

    const paidOrder = await tx.paymentOrder.update({
      where: { orderId: fresh.orderId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        provider,
        providerRef: providerRef ? String(providerRef).slice(0, 190) : null,
        confirmedBy: adminId,
        note,
      },
    })

    return { order: serializeOrder(paidOrder), applied: true, user: applied.user }
  })
}

// ─── Dùng thử ───────────────────────────────────────────────

export async function startTrial(userId) {
  const trialDays = config.billing?.trialDays || 0
  if (trialDays <= 0) throw ApiError.badRequest('Chương trình dùng thử hiện đang tắt')

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { trialStartedAt: true, plan: true, planExpiresAt: true },
  })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  if (user.trialStartedAt) throw ApiError.badRequest('Bạn đã dùng thử một lần rồi')
  if (user.plan !== 'FREE' && !isPlanExpired(user)) {
    throw ApiError.badRequest('Bạn đang dùng gói trả phí, không cần dùng thử')
  }

  // Đánh dấu đã dùng thử + kích hoạt gói trong cùng transaction để không thể
  // dùng thử hai lần kể cả khi hai request tới cùng lúc.
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { userId }, data: { trialStartedAt: new Date() } })
    const result = await applyPlanChange({
      userId,
      plan: 'PRO',
      cycle: 'MONTHLY',
      provider: 'TRIAL',
      note: `Dùng thử Pro ${trialDays} ngày`,
      days: trialDays,
      client: tx,
    })
    return { ...result, trialDays }
  })
}

// ─── Webhook chuyển khoản (Casso / Sepay) ───────────────────

/** So sánh bí mật theo thời gian hằng định (không rò rỉ mã qua thời gian phản hồi). */
function secretEquals(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8')
  const right = Buffer.from(String(b ?? ''), 'utf8')
  if (!left.length || left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

/**
 * Tìm “thứ mà SePay/Casso gửi kèm” trong request.
 *
 * SePay cho chọn 4 kiểu xác thực khi tạo webhook (Không xác thực / API Key /
 * HMAC-SHA256 / OAuth2) và mỗi kiểu đặt bí mật ở một chỗ khác nhau. Đoán sai một
 * chỗ là tiền vào không tự mở gói, nên ở đây chấp nhận hết:
 *   - ?token=<mã>  (dùng được với chế độ “Không xác thực”)
 *   - Apikey/Bearer/x-api-key/secure-token trong header
 *   - Basic auth: tài khoản hoặc mật khẩu chính là mã
 * Trả về cả “nhãn” để ghi nhật ký — admin nhìn thấy SePay thực sự gửi gì.
 */
export function readWebhookCredential(req) {
  const authorization = req.get('authorization') || ''
  const bearer = authorization.match(/^(?:Bearer|Apikey)\s+(.+)$/i)
  const basic = authorization.match(/^Basic\s+(.+)$/i)
  const candidates = [
    { kind: 'query ?token', value: req.query?.token },
    { kind: 'header secure-token', value: req.get('secure-token') },
    { kind: 'header x-webhook-secret', value: req.get('x-webhook-secret') },
    { kind: 'header x-api-key', value: req.get('x-api-key') },
    { kind: 'header apikey', value: req.get('apikey') },
    { kind: 'header Authorization: Apikey/Bearer', value: bearer?.[1] },
  ]
  for (const candidate of candidates) {
    if (candidate.value) return { kind: candidate.kind, value: String(candidate.value).trim() }
  }
  if (basic) {
    const decoded = Buffer.from(basic[1], 'base64').toString('utf8')
    const [user, pass] = decoded.split(':')
    // Basic auth không có quy ước: có người để mã ở user, có người để ở mật khẩu
    return { kind: 'header Authorization: Basic', value: String(pass || user || '').trim() }
  }
  return { kind: 'không gửi kèm', value: '' }
}

/**
 * Kiểm tra chữ ký HMAC-SHA256 của SePay: sha256=HMAC(timestamp + '.' + rawBody).
 * Bắt buộc dùng body THÔ — parse rồi serialize lại là chữ ký lệch (thứ tự khoá,
 * khoảng trắng, cách escape Unicode đều khác).
 */
export function verifySepaySignature(req, secret) {
  const signature = req.get('x-sepay-signature') || ''
  const timestamp = req.get('x-sepay-timestamp') || ''
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : ''
  if (!signature || !timestamp || !rawBody) return false
  // Chống gửi lại request cũ: SePay ký kèm thời điểm, lệch quá 10 phút là bỏ
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 600) return false
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`
  return secretEquals(expected, signature)
}

/**
 * Ghi lại lần gọi webhook gần nhất (thành công hay bị từ chối, kèm lý do) để
 * trang quản trị hiển thị đúng sự thật thay vì để admin đoán.
 * Không bao giờ được làm hỏng việc nhận webhook nếu ghi log gặp lỗi.
 */
export async function recordWebhookAttempt({ status, auth = null, message = '', req = null } = {}) {
  try {
    const ip =
      String(req?.get?.('x-forwarded-for') || '').split(',')[0].trim() || String(req?.ip || '').trim()
    const data = {
      lastWebhookAt: new Date(),
      lastWebhookStatus: String(status || '').slice(0, 20) || null,
      lastWebhookAuth: String(auth || '').slice(0, 80) || null,
      lastWebhookMessage: `${message}${ip ? ` · IP ${ip}` : ''}`.slice(0, 255) || null,
    }
    await prisma.billingSetting.upsert({
      where: { settingId: 1 },
      create: { settingId: 1, ...data },
      update: data,
    })
    clearBillingSettingsCache()
  } catch (err) {
    console.warn('[billing] không ghi được nhật ký webhook:', err?.message)
  }
}

/** Xác thực webhook: token trong query/header, Basic auth, hoặc chữ ký HMAC. */
export async function verifyWebhookRequest(req) {
  const expected = await webhookSecret()
  if (!expected) {
    // Chưa cấu hình bí mật → từ chối để không ai tự kích hoạt gói miễn phí.
    // Dùng 401 chứ không phải 500: đây là lỗi cấu hình phía mình, và 500 sẽ khiến
    // SePay/Casso tưởng lỗi tạm thời nên gửi lại liên tục.
    const reason =
      'Chưa có mã xác thực webhook — vào Quản trị → Đơn hàng → Cài đặt nhận tiền để sinh mã.'
    await recordWebhookAttempt({ status: 'REJECTED', auth: '—', message: reason, req })
    throw ApiError.unauthorized(reason)
  }

  const credential = readWebhookCredential(req)
  if (credential.value && secretEquals(credential.value, expected)) {
    req.webhookAuth = credential.kind
    return true
  }
  if (verifySepaySignature(req, expected)) {
    req.webhookAuth = 'chữ ký HMAC-SHA256'
    return true
  }

  // Nói rõ vì sao bị từ chối — câu này hiện thẳng trong thông báo lỗi của SePay
  // và trong nhật ký ở trang quản trị, để lần sau không phải đoán nữa.
  const reason =
    credential.kind === 'không gửi kèm'
      ? 'Webhook gọi tới nhưng không gửi kèm mã xác thực. Thêm ?token=<mã> vào URL, hoặc chọn phương thức xác thực API Key rồi dán mã trong trang quản trị.'
      : `Mã xác thực không khớp (nhận từ ${credential.kind}) — dán lại mã mới nhất trong Quản trị → Đơn hàng → Cài đặt nhận tiền.`
  await recordWebhookAttempt({ status: 'REJECTED', auth: credential.kind, message: reason, req })
  throw ApiError.unauthorized(reason)
}

/** Rút danh sách giao dịch từ payload của Casso hoặc Sepay. */
export function extractTransactions(payload) {
  const list = []
  const push = (t) => list.push(t)

  // SePay gửi một giao dịch phẳng; Casso gửi { data: [...] }; Bank Hub có thể gói
  // trong { data: { transactions: [...] } }. Chấp nhận hết để không mất giao dịch.
  const data = payload?.data
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data?.transactions)
      ? data.transactions
      : data && typeof data === 'object' && data.id !== undefined
        ? [data]
        : Array.isArray(payload)
          ? payload
          : [payload]
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    push({
      externalId:
        item.id ?? item.transactionId ?? item.referenceCode ?? item.transaction_id ?? item.reference_code ?? null,
      content:
        item.description ?? item.content ?? item.transferContent ?? item.transfer_content ?? item.remark ?? '',
      amount: Number(
        item.amount ?? item.transferAmount ?? item.transfer_amount ?? item.creditAmount ?? item.credit_amount ?? 0
      ),
      // Sepay: transferType = "in" (tiền vào) / "out" (tiền ra). Casso: amount âm là tiền ra.
      transferType:
        item.transferType ?? item.transfer_type ?? item.transactionType ?? item.transaction_type ?? null,
      when: item.when ?? item.transactionDate ?? item.transaction_date ?? null,
    })
  }
  return list
}

/**
 * MỘT giao dịch ngân hàng phải có ĐÚNG MỘT khoá, dù nó tới từ đường nào.
 *
 * Lỗi đã xảy ra thật trên production: webhook của SePay gửi `id` trần ("85009768")
 * còn bộ đồng bộ API lại thêm tiền tố ("sepay:85009768"). Cùng một giao dịch vào
 * hai lần dưới hai khoá khác nhau nên chốt chống trùng theo `external_id` không
 * bắt được: lần đầu khớp đúng đơn và kích hoạt gói, lần sau bị đánh dấu
 * "Đơn ... đã thanh toán trước đó" rồi nằm lại trong danh sách "Tiền đã vào nhưng
 * chưa khớp đơn". Admin nhìn thấy tiền lơ lửng — và nếu bấm "Gán vào đơn" thì cộng
 * thêm 30 ngày cho một lần trả tiền.
 *
 * Chỉ gắn tiền tố khi CHẮC là SePay (id toàn chữ số): Casso dùng mã tham chiếu dạng
 * chữ-số nên giữ nguyên khoá cũ, tránh đổi khoá của đường đang chạy đúng.
 */
export function canonicalBankExternalId(tx = {}) {
  const raw = tx.providerId ?? tx.externalId
  if (!raw) return `NOID:${tx.content}:${tx.amount}`
  const value = String(raw)
  const bare = value.replace(/^sepay:/i, '')
  return /^\d+$/.test(bare) ? `sepay:${bare}` : value
}

/**
 * Xử lý MỘT giao dịch ngân hàng: dò mã đơn trong nội dung, kiểm tra số tiền rồi
 * kích hoạt gói. Idempotent theo `externalId` nên webhook gửi lại hay bộ đồng bộ
 * API đọc lại giao dịch cũ đều không cộng thêm ngày.
 *
 * Dùng chung cho cả hai đường vào tiền:
 *  - WEBHOOK: SePay/Casso đẩy về khi có biến động số dư
 *  - API: hệ thống tự kéo lịch sử giao dịch từ API ngân hàng (bankApiService)
 */
export async function processBankTransaction(tx, { source = 'WEBHOOK' } = {}) {
  const externalId = canonicalBankExternalId(tx)
  const isNew = await registerBillingEvent({
    provider: 'WEBHOOK',
    eventType: 'BANK_TRANSFER',
    externalId,
    amount: tx.amount,
    payload: { ...tx, _source: source },
  })
  if (!isNew) {
    return { externalId, matched: false, duplicated: true }
  }

  return processNewTransaction(tx, { externalId, source })
}

async function processNewTransaction(tx, { externalId, source }) {
  // Mọi giao dịch không tự khớp được đều được ĐÁNH DẤU LẠI để admin gán tay —
  // tiền của khách đã vào tài khoản rồi thì không được để mất dấu.
  const markUnmatched = async (reason) => {
    await prisma.billingEvent.update({
      where: { externalId },
      data: {
        eventType: 'BANK_TRANSFER_UNMATCHED',
        payload: { ...tx, _source: source, _reason: reason },
      },
    })
    return { externalId, matched: false, reason }
  }

  // Tiền RA (chuyển đi, gồm cả hoàn tiền) không bao giờ được kích hoạt gói,
  // kể cả khi nội dung có ghi mã đơn.
  const outbound = String(tx.transferType || '').toLowerCase() === 'out' || tx.amount < 0
  if (outbound) {
    await prisma.billingEvent.update({
      where: { externalId },
      data: { eventType: 'BANK_TRANSFER_OUT', payload: { ...tx, _source: source } },
    })
    return { externalId, matched: false, reason: 'Giao dịch tiền ra — bỏ qua' }
  }

  const candidates = findOrderCodes(tx.content)
  if (!candidates.length) return markUnmatched('Nội dung chuyển khoản không có mã đơn')

  // Đối chiếu với đơn có thật trong DB (ưu tiên đơn đang chờ), nhờ vậy nội dung
  // có thêm chữ nào cũng không khớp nhầm sang một "mã" không tồn tại.
  const matches = await prisma.paymentOrder.findMany({ where: { orderCode: { in: candidates } } })
  const order = matches.find((o) => o.status === 'PENDING') || matches[0]
  if (!order) return markUnmatched(`Không có đơn ${candidates.join(', ')}`)
  if (order.status === 'PAID') return markUnmatched(`Đơn ${order.orderCode} đã thanh toán trước đó`)
  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
    return markUnmatched(
      `Đơn ${order.orderCode} đã ${order.status === 'CANCELLED' ? 'bị huỷ' : 'hết hạn'} — tiền đã vào, cần xử lý tay`
    )
  }
  if (tx.amount > 0 && tx.amount < order.amount) {
    return markUnmatched(
      `Đơn ${order.orderCode}: chuyển thiếu — nhận ${formatVnd(tx.amount)} / cần ${formatVnd(order.amount)}`
    )
  }

  const confirmed = await confirmOrder(order.orderCode, {
    provider: 'WEBHOOK',
    providerRef: externalId,
    note:
      source === 'API'
        ? `Tự động khớp từ API ngân hàng (${externalId})`
        : `Tự động khớp lệnh ${externalId}`,
  })
  await prisma.billingEvent.updateMany({
    where: { externalId },
    data: { orderId: order.orderId },
  })
  return {
    externalId,
    matched: true,
    orderCode: order.orderCode,
    applied: confirmed.applied,
    source,
  }
}

/**
 * Xử lý webhook ngân hàng (SePay/Casso đẩy về khi có biến động số dư):
 * tìm đơn theo nội dung chuyển khoản rồi kích hoạt gói.
 */
export async function handleBankWebhook(payload) {
  const transactions = extractTransactions(payload)
  const results = []
  for (const tx of transactions) {
    results.push(await processBankTransaction(tx, { source: 'WEBHOOK' }))
  }
  return { received: transactions.length, results }
}

/**
 * Tìm MỌI mã đơn có thể có trong nội dung chuyển khoản.
 *
 * Phải trả về danh sách chứ không phải kết quả đầu tiên: nội dung chuyển khoản
 * thật hay có tên chủ tài khoản đứng trước, ví dụ
 * "CT DEN: MN QRONX MNQ3FEN6MKN chuyen tien" — nếu chỉ lấy lần khớp đầu sẽ ra
 * "MNQRONXMNQ3" (sai). Vì vậy khớp bằng bảng ký tự thật của mã đơn (không có
 * 0/O/1/I) rồi để tầng dưới đối chiếu với đơn có thật trong DB.
 */
export function findOrderCodes(content) {
  const normalized = normalizeRef(content)
  const strictRx = new RegExp(`MNQ[${CODE_ALPHABET}]{8}`, 'g')
  const found = normalized.match(strictRx)
  if (found?.length) return [...new Set(found)]
  // Dự phòng cho mã cũ / trường hợp lạ: bảng ký tự rộng hơn
  const loose = normalized.match(/MNQ[A-Z0-9]{8}/g)
  return loose ? [...new Set(loose)] : []
}

/** Mã đơn đầu tiên tìm thấy (tiện cho chỗ chỉ cần biết "có mã hay không"). */
export function findOrderCode(content) {
  return findOrderCodes(content)[0] || null
}

/**
 * Danh sách giao dịch ngân hàng đã vào tài khoản nhưng CHƯA khớp được đơn nào.
 * Đây là lưới an toàn: khách chuyển thiếu, sai nội dung hay quên mã đơn thì tiền
 * vẫn được ghi lại để admin gán tay thay vì biến mất.
 */
export async function listUnmatchedTransfers({ days = 14, limit = 20 } = {}) {
  const since = new Date(Date.now() - days * 86400000)
  const rows = await prisma.billingEvent.findMany({
    where: { eventType: 'BANK_TRANSFER_UNMATCHED', orderId: null, createdAt: { gte: since } },
    orderBy: { billingEventId: 'desc' },
    take: limit,
  })
  return rows.map((row) => {
    const payload = row.payload || {}
    return {
      id: row.billingEventId,
      externalId: row.externalId,
      amount: row.amount,
      content: payload.content || '',
      when: payload.when || null,
      reason: payload._reason || null,
      createdAt: row.createdAt,
    }
  })
}

/**
 * Gán tay một giao dịch ngân hàng vào đơn rồi kích hoạt gói.
 * Dùng khi khách chuyển thiếu tiền, ghi sai nội dung, hoặc chuyển 2 lần.
 */
export async function attachTransferToOrder({ eventId, orderCode, adminId, note }) {
  const event = await prisma.billingEvent.findUnique({ where: { billingEventId: Number(eventId) } })
  if (!event) throw ApiError.notFound('Không tìm thấy giao dịch')
  if (event.orderId) throw ApiError.badRequest('Giao dịch này đã được gán cho một đơn rồi')

  const result = await confirmOrder(orderCode, {
    provider: 'WEBHOOK',
    providerRef: event.externalId,
    adminId,
    note: note || `Gán tay giao dịch ${event.externalId}`,
  })

  await prisma.billingEvent.update({
    where: { billingEventId: event.billingEventId },
    data: {
      eventType: 'BANK_TRANSFER',
      orderId: result.order.id,
      payload: { ...(event.payload || {}), _attachedBy: adminId || null },
    },
  })

  return result
}

// ─── Cài đặt nhận tiền cho quản trị ────────────────────────

/**
 * Toàn bộ dữ liệu cho khung "Cài đặt nhận tiền" ở trang quản trị: tài khoản đang
 * nhận tiền, mã xác thực webhook, URL để dán vào SePay/Casso và các cảnh báo
 * còn thiếu bước nào.
 */
export async function adminBillingSetup({ baseUrl = '' } = {}) {
  const [bank, secret, unmatched, row] = await Promise.all([
    bankConfig(),
    webhookSecret(),
    listUnmatchedTransfers({ limit: 50 }),
    // Đọc thẳng từ DB (không dùng nhớ tạm) để nhật ký webhook hiện ra ngay
    prisma.billingSetting.findUnique({ where: { settingId: 1 } }),
  ])

  const warnings = []
  if (!bank.configured) {
    warnings.push(
      'Chưa có tài khoản nhận tiền: khách sẽ thấy cảnh báo thay vì mã QR. Chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản ở dưới.'
    )
  }
  if (!secret) {
    warnings.push(
      'Chưa có mã xác thực webhook: webhook đang bị từ chối, tiền vào sẽ KHÔNG tự kích hoạt gói. Bấm "Sinh mã mới" rồi dán vào SePay/Casso.'
    )
  }

  const webhookUrl = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/api/v1/billing/webhook/bank` : ''

  return {
    bank,
    bankOptions: BANK_OPTIONS,
    webhookSecret: secret,
    webhookUrl,
    // URL kèm sẵn mã: dán được vào SePay ở chế độ “Không xác thực” (đỡ phải cấu
    // hình header) — vẫn bảo mật vì đi qua HTTPS và có nút sinh mã mới.
    webhookUrlWithToken: webhookUrl && secret ? `${webhookUrl}?token=${secret}` : '',
    lastWebhook: row?.lastWebhookAt
      ? {
          at: row.lastWebhookAt,
          status: row.lastWebhookStatus || '',
          auth: row.lastWebhookAuth || 'không rõ',
          message: row.lastWebhookMessage || '',
        }
      : null,
    templates: [
      { id: 'compact2', name: 'Gọn (kèm số tiền + nội dung)' },
      { id: 'compact', name: 'Gọn hơn' },
      { id: 'qr_only', name: 'Chỉ mã QR' },
      { id: 'print', name: 'Bản in' },
    ],
    unmatchedCount: unmatched.length,
    warnings,
    note:
      'Tên chủ tài khoản phải đúng như tên đã đăng ký với ngân hàng — khách quét mã sẽ thấy đúng tên đó. Từ 1/4/2026 ngân hàng không cho đặt biệt danh riêng.',
  }
}

// ─── Tiện ích cho phần khác ─────────────────────────────────

/** Gói nào đó có cao hơn gói hiện tại không (dùng cho UI). */
export function isUpgrade(fromPlan, toPlan) {
  return (PLAN_ORDER[toPlan] ?? 0) > (PLAN_ORDER[fromPlan] ?? 0)
}

export default {
  listProducts,
  getOverview,
  createOrder,
  getOrder,
  listOrders,
  userCancelOrder,
  confirmOrder,
  applyPlanChange,
  startTrial,
  handleBankWebhook,
  processBankTransaction,
  verifyWebhookRequest,
  readWebhookCredential,
  verifySepaySignature,
  recordWebhookAttempt,
  bankConfig,
  effectiveBank,
  billingSettings,
  saveBillingSettings,
  rotateWebhookSecret,
  clearBillingSettingsCache,
  adminBillingSetup,
  bankOptions: () => BANK_OPTIONS,
  listUnmatchedTransfers,
  attachTransferToOrder,
  registerBillingEvent,
  extractTransactions,
  findOrderCode,
  findOrderCodes,
  expireStaleOrders,
  formatVnd,
  vnDateKey,
  isUpgrade,
}
