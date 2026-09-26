import prisma from '../config/prisma.js'
import config from '../config/index.js'
import { billingSettings, processBankTransaction, formatVnd } from './billingService.js'
import { verifyChecksum } from './vietQrService.js'
import { API_PROVIDERS, apiProviderInfo } from '../utils/bankProviders.js'

export { API_PROVIDERS, apiProviderInfo }

/**
 * Đọc giao dịch ngân hàng bằng API (hệ thống CHỦ ĐỘNG gọi sang), thay cho việc
 * chờ webhook đẩy về. Không cần ai xem sao kê rồi bấm xác nhận.
 *
 * Hai nhà cung cấp, cùng một kết quả:
 *  - SEPAY  : API Giao dịch của SePay (đã có tài liệu công khai, dùng ngay được).
 *             SePay là đối tác chính thức của ACB nên dữ liệu ACB đọc được ngay.
 *  - ACB    : Open API của ACB (developer.acb.com.vn — ACB ONE CONNECT), xác thực
 *             OAuth2 client_credentials. Đường dẫn/tên trường do ACB cấp theo hợp
 *             đồng nên được điền ở trang quản trị, không hard-code.
 *
 * Giao dịch đọc về đi qua ĐÚNG một hàm xử lý với webhook (processBankTransaction),
 * nên chống trùng, chống kích hoạt nhầm tiền ra, và mọi lưới an toàn đều dùng chung.
 */


function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

/**
 * Cấu hình đọc API: giá trị trong app trước, thiếu thì lấy biến môi trường.
 * Không trả secret ra ngoài — chỉ dùng trong service này.
 */
export async function syncConfig() {
  // Đọc thẳng từ DB: cấu hình bí mật và chu kỳ phải đúng ngay sau khi admin lưu,
  // không được dùng bản nhớ tạm 15 giây.
  const saved = (await billingSettings({ fresh: true })) || {}
  const env = config.billing?.bankApi || {}
  const provider = String(saved.bankApiProvider || env.provider || '').toUpperCase()
  const info = apiProviderInfo(provider)
  const cfg = {
    provider: info ? info.id : '',
    baseUrl: saved.bankApiBaseUrl || env.baseUrl || info?.defaultBaseUrl || '',
    token: saved.bankApiToken || env.token || '',
    clientId: saved.bankApiClientId || env.clientId || '',
    clientSecret: saved.bankApiClientSecret || env.clientSecret || '',
    tokenUrl: saved.bankApiTokenUrl || env.tokenUrl || '',
    historyPath: saved.bankApiHistoryPath || env.historyPath || '',
    qrPath: saved.bankApiQrPath || env.qrPath || '',
    account: saved.bankApiAccount || saved.bankAccount || env.account || config.billing?.bank?.account || '',
    syncEnabled: Boolean(saved.syncEnabled),
    intervalMinutes: Number(saved.syncIntervalMinutes || env.syncIntervalMinutes || 5),
    cursor: saved.lastSyncCursor || null,
  }
  cfg.credentialsReady =
    cfg.provider === 'SEPAY'
      ? Boolean(cfg.token)
      : cfg.provider === 'ACB'
        ? Boolean(cfg.tokenUrl && cfg.clientId && cfg.clientSecret && cfg.historyPath)
        : false
  return cfg
}

// ─── Chuẩn hoá giao dịch về dạng dùng chung ─────────────────

/** SePay: /transactions/list trả về amount_in / amount_out (dạng chuỗi "18067000.00"). */
export function normalizeSepayTransactions(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const amountIn = num(row.amount_in)
    const amountOut = num(row.amount_out)
    const content = [row.transaction_content, row.code].filter(Boolean).join(' ')
    return {
      externalId: `sepay:${row.id ?? row.reference_number}`,
      providerId: row.id != null ? String(row.id) : null,
      content: content || '',
      amount: amountIn || amountOut,
      transferType: amountIn > 0 ? 'in' : 'out',
      when: row.transaction_date || null,
      accountNumber: row.account_number || null,
      reference: row.reference_number || null,
    }
  })
}

function pickArray(body, depth = 0) {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== 'object' || depth > 2) return []
  const keys = ['transactions', 'transactionList', 'transactionHistory', 'records', 'items', 'data', 'result', 'results']
  for (const key of keys) {
    const value = body[key]
    if (Array.isArray(value)) return value
  }
  for (const key of keys) {
    const value = body[key]
    if (value && typeof value === 'object') {
      const inner = pickArray(value, depth + 1)
      if (inner.length) return inner
    }
  }
  return []
}

/**
 * ACB ONE CONNECT: tên trường do ACB cấp theo hợp đồng nên đọc "dung sai" —
 * nhận cả camelCase/snake_case và cả chỉ báo ghi nợ/ghi có (creditDebitIndicator).
 */
export function normalizeAcbTransactions(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const debit = pick(row, ['creditDebitIndicator', 'creditDebit', 'dcIndicator', 'dc', 'direction', 'drCr'])
    const typeText = String(pick(row, ['transactionType', 'type']) || '')
    // "DBIT" (ISO 20022) và "CRDT" là hai chỉ báo ghi nợ/ghi có. Cố tình KHÔNG xếp
    // "payment" vào tiền ra — giao dịch QR của khách cũng có thể bị gắn nhãn đó.
    const isOut =
      /debit|dbit|^d$|^dr$|^out$|outbound|withdraw|ghi\s*no/i.test(String(debit || '')) ||
      /debit|dbit|outbound|withdraw/i.test(typeText)

    const creditAmount = num(
      pick(row, ['creditAmount', 'amountIn', 'amount_in', 'amountCredit', 'credit', 'inAmount'])
    )
    const debitAmount = num(pick(row, ['debitAmount', 'amountOut', 'amount_out', 'amountDebit', 'debit', 'outAmount']))
    const amount =
      creditAmount || debitAmount || num(pick(row, ['amount', 'transactionAmount', 'transferAmount', 'value']))
    let transferType = 'in'
    if (isOut || (debitAmount && !creditAmount)) transferType = 'out'

    const id = pick(row, [
      'transactionId',
      'transaction_id',
      'id',
      'referenceCode',
      'referenceNumber',
      'reference_number',
      'refNo',
      'transactionNumber',
    ])
    const when = pick(row, ['transactionDate', 'transaction_date', 'bookingDate', 'valueDate', 'postingDate', 'date'])
    const content = [
      pick(row, [
        'description',
        'content',
        'transactionContent',
        'transaction_content',
        'narrative',
        'remark',
        'memo',
        'transactionDesc',
        'transferContent',
        'addInfo',
      ]),
      pick(row, ['code', 'transactionCode']),
    ]
      .filter(Boolean)
      .join(' ')

    return {
      externalId: `acb:${id ?? `${when}:${amount}:${index}`}`,
      providerId: id != null ? String(id) : null,
      content,
      amount: Math.abs(amount),
      transferType,
      when: when || null,
      reference: pick(row, ['referenceNumber', 'referenceCode', 'refNo']) || null,
    }
  })
}

export function normalizeApiTransactions(provider, body) {
  const rows = pickArray(body)
  return provider === 'SEPAY' ? normalizeSepayTransactions(rows) : normalizeAcbTransactions(rows)
}

// ─── Gọi API ────────────────────────────────────────────────

function trimSlash(url) {
  return String(url || '').replace(/\/+$/, '')
}

async function jsonOrThrow(res, label) {
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text?.slice(0, 300) }
  }
  if (!res.ok) {
    const detail = body?.error?.message || body?.message || body?.error || body?.raw || `HTTP ${res.status}`
    throw new Error(`${label} thất bại (HTTP ${res.status}): ${String(detail).slice(0, 200)}`)
  }
  return body
}

async function fetchSepayTransactions(cfg, { limit = 100, sinceId = null } = {}) {
  const base = trimSlash(cfg.baseUrl || apiProviderInfo('SEPAY').defaultBaseUrl)
  const params = new URLSearchParams({ limit: String(limit) })
  if (cfg.account) params.set('account_number', cfg.account)
  if (sinceId) params.set('since_id', String(sinceId))

  const res = await fetch(`${base}/transactions/list?${params.toString()}`, {
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/json' },
  })
  const body = await jsonOrThrow(res, 'Gọi API SePay')
  return { body, transactions: normalizeSepayTransactions(body?.transactions || body?.data || body) }
}

/** Lấy access token OAuth2 client_credentials của ACB ONE CONNECT. */
export async function fetchAcbAccessToken(cfg) {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  })
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  })
  const json = await jsonOrThrow(res, 'Lấy token ACB')
  const token = json?.access_token || json?.accessToken || json?.data?.access_token
  if (!token) throw new Error('ACB không trả về access_token — kiểm tra lại Client ID / Secret')
  return token
}

async function fetchAcbTransactions(cfg, { limit = 100, sinceId = null } = {}) {
  const token = await fetchAcbAccessToken(cfg)
  const to = new Date()
  const from = new Date(to.getTime() - 3 * 86400000)
  const iso = (d) => d.toISOString().slice(0, 19)
  const path = String(cfg.historyPath || '')
    .replace(/\{account\}/g, encodeURIComponent(cfg.account || ''))
    .replace(/\{from(Date)?\}/g, iso(from))
    .replace(/\{to(Date)?\}/g, iso(to))
    .replace(/\{limit\}/g, String(limit))
    .replace(/\{sinceId\}/g, String(sinceId || ''))
  const url = /^https?:\/\//i.test(path) ? path : `${trimSlash(cfg.baseUrl)}${path.startsWith('/') ? '' : '/'}${path}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'x-client-id': cfg.clientId,
    },
  })
  const body = await jsonOrThrow(res, 'Gọi API ACB')
  return { body, transactions: normalizeAcbTransactions(pickArray(body)) }
}

/** Đọc giao dịch từ nhà cung cấp đang cấu hình. */
export async function fetchBankTransactions(cfg, options = {}) {
  if (!cfg.provider) throw new Error('Chưa chọn nhà cung cấp API ngân hàng')
  if (!cfg.credentialsReady) throw new Error(`Chưa đủ thông tin kết nối ${apiProviderInfo(cfg.provider)?.name || cfg.provider}`)
  if (cfg.provider === 'SEPAY') return fetchSepayTransactions(cfg, options)
  if (cfg.provider === 'ACB') return fetchAcbTransactions(cfg, options)
  throw new Error(`Nhà cung cấp ${cfg.provider} chưa được hỗ trợ`)
}

// ─── Trạng thái & lưu kết quả đồng bộ ───────────────────────

/** Mốc `since_id` cho lần sau: id lớn nhất đọc được trong lô này. */
export function nextCursor(transactions, current) {
  const ids = transactions.map((t) => Number(t.providerId)).filter((n) => Number.isFinite(n) && n > 0)
  if (!ids.length) return current || null
  const max = Math.max(...ids)
  const currentNum = Number(current)
  return Number.isFinite(currentNum) && currentNum >= max ? String(current) : String(max)
}

async function saveSyncResult({ status, message, cursor }) {
  try {
    await prisma.billingSetting.update({
      where: { settingId: 1 },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncMessage: String(message || '').slice(0, 255),
        ...(cursor ? { lastSyncCursor: cursor } : {}),
      },
    })
  } catch {
    // Chưa có dòng cấu hình thì không sao — lần đồng bộ sau sẽ bỏ qua
  }
}

// ─── Tạo mã QR động bằng API của ngân hàng ──────────────────

/** Đọc mã QR trong phản hồi của ngân hàng (tên trường tuỳ theo hợp đồng). */
export function extractBankQr(body) {
  if (!body || typeof body !== 'object') return { payload: null, imageUrl: null }
  const deep = [body, body.data, body.result, body.qr, body.data?.qr].filter(Boolean)
  const payloadKeys = ['qrCode', 'qrData', 'qrContent', 'qrString', 'qrPayload', 'qr_code', 'qr_data', 'content']
  const imageKeys = ['qrImageUrl', 'imageUrl', 'qrLink', 'qrImage', 'qr_image_url', 'qrCodeUrl']

  let payload = null
  let imageUrl = null
  for (const source of deep) {
    for (const key of payloadKeys) {
      const value = source[key]
      if (typeof value === 'string' && value.startsWith('0002') && !payload) payload = value
    }
    for (const key of imageKeys) {
      const value = source[key]
      if (typeof value === 'string' && /^(https?:\/\/|data:image\/)/.test(value) && !imageUrl) imageUrl = value
    }
  }
  // Có nơi trả QR thẳng dưới dạng chuỗi ở gốc phản hồi
  if (!payload && typeof body === 'string' && body.startsWith('0002')) payload = body
  return {
    payload,
    imageUrl,
    checksumOk: payload ? verifyChecksum(payload) : null,
  }
}

/**
 * Xin ngân hàng tạo **mã QR động riêng cho đơn hàng** (sản phẩm “QR động” của ACB:
 * QR theo từng đơn + báo thanh toán thành công về phần mềm). Đường dẫn do ACB cấp,
 * cấu hình ở trang quản trị; chưa cấu hình thì hệ thống tự sinh mã VietQR.
 *
 * @returns {Promise<{payload: string|null, imageUrl: string|null}|null>}
 */
export async function createDynamicBankQr(order) {
  const cfg = await syncConfig()
  if (!cfg.qrPath) return null
  if (cfg.provider !== 'ACB' || !cfg.credentialsReady) return null

  const token = await fetchAcbAccessToken(cfg)
  const url = buildQrUrl(cfg, order)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'x-client-id': cfg.clientId,
    },
    body: JSON.stringify({
      accountNumber: cfg.account,
      amount: order.amount,
      content: order.transferContent,
      orderCode: order.orderCode,
      currency: 'VND',
      serviceCode: 'QRIBFTTA',
    }),
  })
  const body = await jsonOrThrow(res, 'Tạo QR động qua ngân hàng')
  const qr = extractBankQr(body)
  if (!qr.payload && !qr.imageUrl) throw new Error('Ngân hàng không trả về mã QR')
  return qr
}

function buildQrUrl(cfg, order) {
  const path = String(cfg.qrPath || '')
    .replace(/\{account\}/g, encodeURIComponent(cfg.account || ''))
    .replace(/\{amount\}/g, String(order.amount || ''))
    .replace(/\{content\}/g, encodeURIComponent(order.transferContent || ''))
    .replace(/\{orderCode\}/g, encodeURIComponent(order.orderCode || ''))
  return /^https?:\/\//i.test(path) ? path : `${trimSlash(cfg.baseUrl)}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * Bảo đảm đơn hàng có mã QR: xin ngân hàng tạo trước, lỗi thì bỏ qua để đơn vẫn
 * dùng mã do hệ thống sinh. Không bao giờ chặn việc tạo đơn.
 */
export async function ensureBankQrForOrder(order) {
  try {
    const qr = await createDynamicBankQr(order)
    if (!qr || !order?.orderCode) return null
    // Dùng orderCode (duy nhất) làm khoá: hàm này nhận cả đơn đã tuần tự hoá
    // (chỉ có `id`, không có `orderId`).
    await prisma.paymentOrder.update({
      where: { orderCode: order.orderCode },
      data: {
        qrPayload: qr.payload || null,
        qrImageUrl: qr.imageUrl || null,
        qrSource: 'BANK',
        qrCreatedAt: new Date(),
      },
    })
    return qr
  } catch (err) {
    console.error(`[BankQr] Không tạo được QR động cho đơn ${order.orderCode}: ${err.message}`)
    return null
  }
}

/**
 * Kiểm tra kết nối: gọi API thật, đọc thử vài giao dịch gần nhất, KHÔNG kích hoạt
 * gói nào (chỉ đọc). Đây là nút "Kiểm tra kết nối" ở trang quản trị.
 */
export async function testBankConnection() {
  const cfg = await syncConfig()
  try {
    const { transactions } = await fetchBankTransactions(cfg, { limit: 5 })
    return {
      ok: true,
      provider: cfg.provider,
      providerName: apiProviderInfo(cfg.provider)?.name || cfg.provider,
      account: cfg.account,
      count: transactions.length,
      sample: transactions.slice(0, 5).map((t) => ({
        when: t.when,
        amount: t.amount,
        amountText: formatVnd(t.amount),
        direction: t.transferType === 'in' ? 'Tiền vào' : 'Tiền ra',
        content: t.content,
        externalId: t.externalId,
      })),
      message: `Kết nối thành công — đọc được ${transactions.length} giao dịch gần nhất`,
    }
  } catch (err) {
    return { ok: false, provider: cfg.provider, message: err.message }
  }
}

let running = false

/**
 * Đồng bộ giao dịch từ API ngân hàng vào lõi kích hoạt gói.
 * Chạy được theo lịch (scheduler) hoặc do admin bấm "Đồng bộ ngay".
 */
export async function syncBankTransactions({ force = false, trigger = 'MANUAL', limit = 100 } = {}) {
  const cfg = await syncConfig()
  if (!cfg.provider) return { ok: false, skipped: true, message: 'Chưa chọn nhà cung cấp API ngân hàng' }
  if (!cfg.credentialsReady) return { ok: false, skipped: true, message: 'Chưa đủ thông tin kết nối API ngân hàng' }
  if (!force && !cfg.syncEnabled) return { ok: false, skipped: true, message: 'Đồng bộ tự động đang tắt' }
  if (running) return { ok: false, skipped: true, message: 'Đang đồng bộ, bỏ qua lần này' }

  running = true
  try {
    const { transactions } = await fetchBankTransactions(cfg, { limit, sinceId: cfg.cursor })
    const results = []
    for (const tx of transactions) {
      results.push(await processBankTransaction(tx, { source: 'API' }))
    }

    const activated = results.filter((r) => r.matched && r.applied)
    const duplicated = results.filter((r) => r.duplicated)
    const unmatched = results.filter((r) => !r.matched && !r.duplicated)
    const cursor = nextCursor(transactions, cfg.cursor)

    const message =
      `[${trigger}] đọc ${transactions.length} giao dịch · kích hoạt ${activated.length} gói` +
      (unmatched.length ? ` · ${unmatched.length} giao dịch chưa khớp` : '')
    await saveSyncResult({ status: 'OK', message, cursor })

    return {
      ok: true,
      provider: cfg.provider,
      fetched: transactions.length,
      activated: activated.length,
      activatedOrders: activated.map((r) => r.orderCode),
      duplicated: duplicated.length,
      unmatched: unmatched.map((r) => ({ externalId: r.externalId, reason: r.reason })),
      cursor,
      message,
    }
  } catch (err) {
    await saveSyncResult({ status: 'ERROR', message: err.message })
    return { ok: false, provider: cfg.provider, message: err.message }
  } finally {
    running = false
  }
}

/** Trạng thái đồng bộ để hiển thị ở trang quản trị. */
export async function syncStatus() {
  const cfg = await syncConfig()
  const info = apiProviderInfo(cfg.provider)
  const saved = (await billingSettings({ fresh: true })) || {}
  const dueAt =
    saved.lastSyncAt && cfg.syncEnabled
      ? new Date(new Date(saved.lastSyncAt).getTime() + Math.max(1, cfg.intervalMinutes) * 60000)
      : null

  return {
    provider: cfg.provider,
    providerName: info?.name || '',
    providerHint: info?.hint || '',
    providerDocs: info?.docs || '',
    credentialsReady: cfg.credentialsReady,
    account: cfg.account,
    baseUrl: cfg.baseUrl,
    hasToken: Boolean(cfg.token),
    hasClientSecret: Boolean(cfg.clientSecret),
    clientId: cfg.clientId,
    tokenUrl: cfg.tokenUrl,
    historyPath: cfg.historyPath,
    qrPath: cfg.qrPath,
    qrSource: cfg.qrPath && cfg.credentialsReady ? 'BANK' : 'SYSTEM',
    syncEnabled: cfg.syncEnabled,
    intervalMinutes: cfg.intervalMinutes,
    lastSyncAt: saved.lastSyncAt || null,
    lastSyncStatus: saved.lastSyncStatus || null,
    lastSyncMessage: saved.lastSyncMessage || null,
    nextSyncAt: dueAt,
    cursor: cfg.cursor,
  }
}

export default {
  API_PROVIDERS,
  apiProviderInfo,
  syncConfig,
  extractBankQr,
  createDynamicBankQr,
  ensureBankQrForOrder,
  fetchBankTransactions,
  fetchAcbAccessToken,
  normalizeApiTransactions,
  normalizeSepayTransactions,
  normalizeAcbTransactions,
  nextCursor,
  testBankConnection,
  syncBankTransactions,
  syncStatus,
}
