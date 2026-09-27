import catchAsync from '../utils/catchAsync.js'
import { success } from '../dto/response/apiResponse.js'
import ApiError from '../utils/ApiError.js'
import config from '../config/index.js'
import * as billingService from '../services/billingService.js'
import * as bankApiService from '../services/bankApiService.js'

/** Địa chỉ công khai của API: cấu hình trước, không có thì suy ra từ request. */
function publicBaseUrl(req) {
  if (config.billing?.publicApiUrl) return config.billing.publicApiUrl
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol
  const host = req.get('x-forwarded-host') || req.get('host')
  return host ? `${proto}://${host}` : ''
}

// ─── Công khai ──────────────────────────────────────────────

/**
 * GET /api/v1/billing/products
 * Bảng giá + giới hạn từng gói (nguồn duy nhất cho web và app Android).
 * Không cần đăng nhập để trang giá của khách xem được.
 */
export const getProducts = catchAsync(async (req, res) => {
  success(res, 200, 'Thao tác thành công', await billingService.listProducts())
})

// ─── Người dùng ─────────────────────────────────────────────

/** GET /api/v1/billing/me – gói hiện tại, hạn mức AI, lịch sử đơn */
export const getMyBilling = catchAsync(async (req, res) => {
  const data = await billingService.getOverview(req.user.id)
  success(res, 200, 'Thao tác thành công', data)
})

/**
 * POST /api/v1/billing/orders – tạo đơn mua gói kèm mã QR thanh toán.
 *
 * Nếu quản trị đã khai đường dẫn “tạo QR động” của ngân hàng thì xin ngân hàng cấp
 * mã QR riêng cho đơn; không được thì đơn vẫn chạy với mã VietQR do hệ thống tự sinh.
 */
export const createOrder = catchAsync(async (req, res) => {
  let data = await billingService.createOrder(req.user.id, {
    plan: req.body.plan,
    cycle: req.body.cycle || 'MONTHLY',
  })

  const bankQr = await bankApiService.ensureBankQrForOrder(data.order)
  if (bankQr) {
    data = await billingService.getOrder(req.user.id, data.order.orderCode)
  }

  success(res, 201, 'Đã tạo đơn thanh toán', data)
})

/** GET /api/v1/billing/orders/:orderCode – trạng thái đơn (giao diện hỏi lại) */
export const getOrder = catchAsync(async (req, res) => {
  const data = await billingService.getOrder(req.user.id, req.params.orderCode)
  success(res, 200, 'Thao tác thành công', data)
})

/** POST /api/v1/billing/orders/:orderCode/cancel – người dùng tự huỷ đơn chưa trả */
export const cancelOrder = catchAsync(async (req, res) => {
  const order = await billingService.userCancelOrder(req.user.id, req.params.orderCode)
  success(res, 200, 'Đã huỷ đơn', order)
})

/** POST /api/v1/billing/trial – bắt đầu dùng thử Pro (mỗi tài khoản một lần) */
export const startTrial = catchAsync(async (req, res) => {
  const data = await billingService.startTrial(req.user.id)
  success(res, 200, `Đã bật dùng thử Pro ${data.trialDays} ngày`, data)
})

// ─── Webhook ngân hàng (không cần đăng nhập, xác thực bằng mã bí mật) ───

/**
 * POST /api/v1/billing/webhook/bank – Casso/Sepay báo có tiền vào.
 * Mọi lần gọi (kể cả bị từ chối) đều được ghi lại để trang quản trị hiển thị:
 * webhook có tới không, gửi kèm mã gì, vì sao hỏng.
 */
export const bankWebhook = catchAsync(async (req, res) => {
  await billingService.verifyWebhookRequest(req)
  try {
    const result = await billingService.handleBankWebhook(req.body)
    const applied = result.results.filter((r) => r.applied).length
    await billingService.recordWebhookAttempt({
      req,
      status: 'OK',
      auth: req.webhookAuth,
      message: result.received
        ? `Đã nhận ${result.received} giao dịch · kích hoạt ${applied} gói`
        : 'Webhook gọi thử (không có giao dịch) — cấu hình đã đúng',
    })
    success(res, 200, 'Đã xử lý webhook', result)
  } catch (err) {
    await billingService.recordWebhookAttempt({
      req,
      status: 'ERROR',
      auth: req.webhookAuth,
      message: `Lỗi khi xử lý giao dịch: ${err.message}`,
    })
    throw err
  }
})

/**
 * POST /api/v1/admin/billing/test-webhook — máy chủ tự gọi URL webhook của chính
 * mình (đi qua Internet, đúng như SePay gọi) để biết cấu hình đã thông chưa.
 * Payload rỗng nên KHÔNG kích hoạt gói nào, không làm thay đổi dữ liệu.
 */
export const adminTestWebhook = catchAsync(async (req, res) => {
  const baseUrl = publicBaseUrl(req)
  const secret = await billingService.webhookSecret()
  if (!baseUrl) {
    return success(res, 200, 'Không xác định được địa chỉ công khai của API', { ok: false })
  }
  if (!secret) {
    return success(res, 200, 'Chưa có mã xác thực webhook — bấm “Sinh mã mới” trước rồi thử lại', { ok: false })
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/billing/webhook/bank?token=${encodeURIComponent(secret)}`
  const started = Date.now()
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Apikey ${secret}` },
      body: JSON.stringify({ data: [] }),
    })
    const text = await response.text()
    const ms = Date.now() - started
    const ok = response.status === 200
    const message = ok
      ? `Webhook thông: máy chủ trả 200 sau ${ms}ms. Sang SePay bấm “Gửi thử” để chắc chắn đầu bên kia cũng đúng.`
      : `Webhook trả ${response.status} sau ${ms}ms — xem chi tiết bên dưới.`
    success(res, 200, message, { ok, status: response.status, ms, url, response: text.slice(0, 400) })
  } catch (err) {
    success(res, 200, `Không gọi được webhook: ${err.message}`, { ok: false, url, error: err.message })
  }
})

// ─── Quản trị ───────────────────────────────────────────────

/**
 * GET /api/v1/admin/orders – danh sách đơn để đối soát.
 * Kèm danh sách giao dịch ngân hàng đã vào nhưng chưa khớp đơn (lưới an toàn).
 */
export const adminListOrders = catchAsync(async (req, res) => {
  const data = await billingService.listOrders({
    status: req.query.status || undefined,
    keyword: req.query.keyword || undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  })
  const unmatched = await billingService.listUnmatchedTransfers({ limit: 20 })
  success(res, 200, 'Thao tác thành công', { ...data, unmatched })
})

/** POST /api/v1/admin/billing/transfers/:eventId/attach – gán giao dịch vào đơn */
export const adminAttachTransfer = catchAsync(async (req, res) => {
  const data = await billingService.attachTransferToOrder({
    eventId: req.params.eventId,
    orderCode: req.body.orderCode,
    adminId: req.user.id,
    note: req.body.note || null,
  })
  success(
    res,
    200,
    `Đã gán giao dịch và kích hoạt gói ${data.user?.planName || ''} cho ${data.user?.email || 'người dùng'}`,
    data
  )
})

/** POST /api/v1/admin/orders/:orderCode/confirm – xác nhận đã nhận tiền */
export const adminConfirmOrder = catchAsync(async (req, res) => {
  const data = await billingService.confirmOrder(req.params.orderCode, {
    provider: req.body.provider || 'ADMIN',
    providerRef: req.body.providerRef || null,
    adminId: req.user.id,
    note: req.body.note || `Admin xác nhận`,
  })
  const message = data.applied
    ? `Đã kích hoạt gói ${data.user?.planName || ''} cho ${data.user?.email || 'người dùng'}`
    : 'Đơn này đã được xử lý trước đó'
  success(res, 200, message, data)
})

/** POST /api/v1/admin/orders/:orderCode/cancel – huỷ đơn chưa thanh toán */
export const adminCancelOrder = catchAsync(async (req, res) => {
  const data = await billingService.listOrders({ keyword: req.params.orderCode, pageSize: 1 })
  const found = data.items[0]
  if (!found) throw ApiError.notFound('Không tìm thấy đơn hàng')
  if (found.status === 'PAID') throw ApiError.badRequest('Đơn đã thanh toán, không thể huỷ')
  const order = await billingService.userCancelOrder(found.user.id, req.params.orderCode)
  success(res, 200, 'Đã huỷ đơn', order)
})

/**
 * GET /api/v1/admin/billing/settings — cấu hình nhận tiền + URL webhook để dán
 * vào SePay/Casso, kèm cảnh báo còn thiếu bước nào.
 */
export const adminGetBillingSetup = catchAsync(async (req, res) => {
  const [setup, sync, expiringSoon] = await Promise.all([
    billingService.adminBillingSetup({ baseUrl: publicBaseUrl(req) }),
    bankApiService.syncStatus(),
    // Gói sắp hết hạn trong 7 ngày: chuyển khoản không tự gia hạn nên đây là
    // danh sách khách admin nên chủ động liên hệ trước khi mất quyền lợi.
    billingService.listExpiringSoon({ daysAhead: 7 }),
  ])
  success(res, 200, 'Thao tác thành công', {
    ...setup,
    sync,
    expiringSoon,
    apiProviders: bankApiService.API_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      defaultBaseUrl: p.defaultBaseUrl,
      fields: p.fields,
      hint: p.hint,
      docs: p.docs,
    })),
  })
})

/** PUT /api/v1/admin/billing/settings — lưu tài khoản nhận tiền (ACB…) */
export const adminSaveBillingSettings = catchAsync(async (req, res) => {
  const bank = await billingService.saveBillingSettings(
    {
      bankId: req.body.bankId,
      bankAccount: req.body.bankAccount,
      bankAccountName: req.body.bankAccountName,
      qrTemplate: req.body.qrTemplate,
      bankApiProvider: req.body.bankApiProvider,
      bankApiBaseUrl: req.body.bankApiBaseUrl,
      bankApiToken: req.body.bankApiToken,
      bankApiClientId: req.body.bankApiClientId,
      bankApiClientSecret: req.body.bankApiClientSecret,
      bankApiTokenUrl: req.body.bankApiTokenUrl,
      bankApiHistoryPath: req.body.bankApiHistoryPath,
      bankApiQrPath: req.body.bankApiQrPath,
      bankApiAccount: req.body.bankApiAccount,
      syncEnabled: req.body.syncEnabled,
      syncIntervalMinutes: req.body.syncIntervalMinutes,
    },
    req.user.id
  )
  success(res, 200, 'Đã lưu cài đặt nhận tiền — khách thấy mã QR mới ngay, API dùng thông số mới ngay', bank)
})

/**
 * POST /api/v1/admin/billing/test-connection — gọi API ngân hàng thật, đọc thử
 * vài giao dịch gần nhất. Chỉ đọc, KHÔNG kích hoạt gói nào.
 */
export const adminTestBankConnection = catchAsync(async (req, res) => {
  const result = await bankApiService.testBankConnection()
  // Luôn trả 200 kèm data.ok để giao diện hiển thị đúng: kết nối được hay không,
  // và cả giao dịch đọc thử — không cần đoán qua mã HTTP.
  success(res, 200, result.ok ? result.message : `Không kết nối được: ${result.message}`, result)
})

/**
 * POST /api/v1/admin/billing/sync — đồng bộ ngay: kéo giao dịch từ API ngân hàng
 * rồi kích hoạt gói cho mọi đơn đã thanh toán (không cần ai xác nhận tay).
 */
export const adminSyncBankNow = catchAsync(async (req, res) => {
  const result = await bankApiService.syncBankTransactions({ force: true, trigger: 'ADMIN' })
  if (!result.ok) {
    return success(res, 200, result.message, result)
  }
  const message = result.activated
    ? `Đã đồng bộ: kích hoạt ${result.activated} gói (${result.activatedOrders.join(', ')})`
    : `Đã đồng bộ: ${result.fetched} giao dịch, không có đơn nào cần kích hoạt`
  success(res, 200, message, result)
})

/** POST /api/v1/admin/billing/settings/rotate-secret — sinh mã xác thực webhook mới */
export const adminRotateWebhookSecret = catchAsync(async (req, res) => {
  const secret = await billingService.rotateWebhookSecret(req.user.id)
  success(res, 200, 'Đã sinh mã xác thực mới — nhớ dán lại vào SePay/Casso', { webhookSecret: secret })
})

export default {
  getProducts,
  getMyBilling,
  createOrder,
  getOrder,
  cancelOrder,
  startTrial,
  bankWebhook,
  adminListOrders,
  adminConfirmOrder,
  adminCancelOrder,
  adminAttachTransfer,
  adminGetBillingSetup,
  adminSaveBillingSettings,
  adminRotateWebhookSecret,
  adminTestWebhook,
  adminTestBankConnection,
  adminSyncBankNow,
}
