import prisma from '../config/prisma.js'
import ApiError from './ApiError.js'

// Gói trả phí — xuất khẩu để chỗ khác không phải chép lại danh sách (chép lại là
// chỗ này nhớ thêm BUSINESS, chỗ kia quên).
export const PAID_PLANS = ['PLUS', 'PRO', 'BUSINESS']

// Nhóm "quyền lợi Pro" (BUSINESS mua cho cả nhóm nhưng quyền lợi y hệt PRO — mọi
// chỗ kiểm tra "có được dùng tính năng Pro không" phải cho qua cả BUSINESS, nếu không
// người trả tiền cho cả nhóm lại là người không dùng được gì).
export const PRO_PLANS = ['PRO', 'BUSINESS']

/** Gói có toàn bộ quyền lợi Pro không? (PRO hoặc BUSINESS) */
export function planIsPro(plan) {
  return PRO_PLANS.includes(plan)
}

// ─── Cấu hình gói ───────────────────────────────────────────
// Nguyên tắc đóng gói (xem docs/billing.md):
//   • FREE đủ rộng cho thói quen cơ bản — kể cả công việc LẶP LẠI, vì app nhắc
//     việc mà không cho lặp thì người dùng bỏ app chứ không nâng cấp.
//   • Tiền thu ở chỗ cảm nhận được giá trị: nhắc dai tới khi xác nhận (chỉ Pro),
//     báo cáo năng suất + xuất Excel/PDF (chỉ Pro), kế hoạch tuần (chỉ Pro), hạn mức
//     AI, thiết bị, âm thanh riêng, hỗ trợ ưu tiên. KHÔNG bán thứ chưa làm — xem
//     `upcoming` trong từng gói.
//   • Nhắc qua Zalo OA đã bỏ khỏi danh sách bán: ai đã cài app trên điện thoại thì
//     thông báo đẩy hiện thẳng trên màn hình, Zalo chỉ còn là kênh dự phòng cho
//     người không cài app (và một số máy chặn thông báo nền) — để sau, khi có nhu cầu thật.
//   • Giá để ở đây là NGUỒN DUY NHẤT cho cả web (VietQR) và app Android (Play
//     Billing) — Play Console phải tạo sản phẩm trùng đúng giá và đúng mã.
// BUSINESS cao hơn PRO: mua Pro Doanh nghiệp khi đang có Pro là nâng cấp (cộng thêm kỳ
// từ hạn hiện tại), còn mua Pro khi đang BUSINESS thì không — người đó cần giữ quyền chủ nhóm.
export const PLAN_ORDER = { FREE: 0, PLUS: 1, PRO: 2, BUSINESS: 3 }

export const CYCLES = {
  MONTHLY: { days: 30, label: 'tháng' },
  YEARLY: { days: 365, label: 'năm', monthsFree: 2 },
}

/** Mã sản phẩm dùng cho Google Play Console (đặt trùng y hệt trong Play Console). */
export const PRODUCT_IDS = {
  'PLUS:MONTHLY': 'mnq_plus_monthly',
  'PLUS:YEARLY': 'mnq_plus_yearly',
  'PRO:MONTHLY': 'mnq_pro_monthly',
  'PRO:YEARLY': 'mnq_pro_yearly',
  'BUSINESS:MONTHLY': 'mnq_business_monthly',
  'BUSINESS:YEARLY': 'mnq_business_yearly',
}

export const PLANS = {
  FREE: {
    name: 'Miễn phí',
    tagline: 'Đủ để tạo thói quen nhắc việc mỗi ngày',
    activeTasks: 50,
    remindersPerTask: 3,
    categories: 10,
    subtasksPerTask: 20,
    devices: 2,
    repeatTasks: true,
    nagReminders: false,
    reports: false,
    planner: false,
    // Giao việc cho người khác: quyền lợi chỉ Pro có — xem services/taskShareService.js
    taskSharing: false,
    aiDailyLimit: 5,
    alarmSounds: ['classic', 'digital', 'DEFAULT', 'URGENT'],
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      '50 công việc đang mở',
      'Nhắc nhở & công việc lặp lại hằng ngày/tuần/tháng',
      '10 danh mục, 20 việc con mỗi công việc',
      '2 thiết bị đồng bộ',
      'Trợ lý AI: 5 lần mỗi ngày',
      'Nhắc đúng giờ kể cả khi đã đóng trình duyệt',
      'Xuất việc sang Google Calendar / Outlook',
    ],
  },
  PLUS: {
    name: 'Plus',
    tagline: 'Cho người quản lý nhiều công việc mỗi ngày',
    activeTasks: Infinity,
    remindersPerTask: 5,
    categories: Infinity,
    subtasksPerTask: Infinity,
    devices: 5,
    repeatTasks: true,
    nagReminders: false,
    reports: false,
    planner: false,
    taskSharing: false,
    aiDailyLimit: 50,
    alarmSounds: ['classic', 'digital', 'bell', 'morning', 'DEFAULT', 'URGENT'],
    priceMonthly: 39000,
    priceYearly: 390000,
    features: [
      'Không giới hạn công việc đang mở',
      '5 nhắc nhở mỗi công việc, không giới hạn danh mục & việc con',
      '5 thiết bị đồng bộ',
      'Trợ lý AI: 50 lần mỗi ngày',
      'Toàn bộ âm thanh báo thức có sẵn',
      'Hỗ trợ qua chat ưu tiên',
    ],
  },
  PRO: {
    name: 'Pro',
    tagline: 'Toàn bộ sức mạnh MN-Qronx, không giới hạn',
    activeTasks: Infinity,
    remindersPerTask: 5,
    categories: Infinity,
    subtasksPerTask: Infinity,
    devices: Infinity,
    repeatTasks: true,
    // "Nhắc dai": lý do trả tiền rõ nhất của Pro — xem backend/src/services/nagService.js
    nagReminders: true,
    // Báo cáo năng suất + xuất Excel/PDF — xem backend/src/services/reportService.js
    reports: true,
    // Kế hoạch tuần — xem backend/src/services/plannerService.js
    planner: true,
    // Giao việc cho người khác — xem backend/src/services/taskShareService.js.
    // Đây là quyền lợi bán được nhất của Pro vì Free/Plus KHÔNG có cách nào khác
    // để có: mọi thứ khác đều là "một mình bạn làm tốt hơn", còn cái này mở ra
    // việc trước đây không làm được.
    taskSharing: true,
    aiDailyLimit: Infinity,
    alarmSounds: ['classic', 'digital', 'bell', 'morning', 'gentle', 'DEFAULT', 'URGENT'],
    priceMonthly: 79000,
    priceYearly: 790000,
    // Chỉ ghi những gì khách ĐANG dùng được. Thứ chưa làm thì để ở `upcoming`
    // (trang giá hiện kèm nhãn “Sắp có”) — bán thứ chưa có là mất khách oan.
    features: [
      'Nhắc dai tới khi bạn xác nhận: việc Khẩn cấp/Cao chưa xong thì chuông kêu lại (bạn chọn 1–30 phút một lần)',
      'Báo cáo năng suất 7/30/90 ngày: việc xong đúng hạn, giờ nào bạn làm tốt nhất, việc đang bị bỏ quên lâu nhất — xuất Excel/PDF',
      'Kế hoạch tuần: app tự xếp việc nào làm ngày nào và cảnh báo trước khi tuần bị quá tải',
      'Báo cáo tuần gửi email sáng thứ 2: tuần rồi làm được gì, tuần này có gì chờ (không cần mở app)',
      'Nhờ người khác làm: giao một công việc cho người thân/đồng nghiệp (tối đa 5 người mỗi việc), họ vẫn nhận chuông nhắc, bạn nhận thông báo khi họ xong',
      'Không giới hạn công việc, nhắc nhở, danh mục & việc con',
      'Không giới hạn thiết bị đồng bộ',
      'Trợ lý AI không giới hạn',
      'Toàn bộ âm thanh báo thức, kể cả âm thanh riêng bạn tải lên',
    ],
    // Không còn "AI xếp cả tuần": dịch vụ AI của MN-Qronx là model phân tích câu
    // thành công việc (thư mục ai/), không phải LLM biết lập kế hoạch — hứa thứ đó
    // là hứa suông. Kế hoạch tuần nay xếp bằng luật (plannerService.js): chạy ngay,
    // không tốn lượt, và không bao giờ bịa ra việc không có thật.
    upcoming: ['Đồng bộ hai chiều Google Calendar (hiện đã có chiều app → lịch)'],
  },
}

/** Trần số tài khoản dùng chung một gói Business: chủ gói + 9 người. */
export const MAX_BUSINESS_SEATS = 10

// Gói Pro Doanh nghiệp được DỰNG TỪ gói Pro thay vì chép tay: quyền lợi, hạn mức,
// danh sách "sắp có" đều lấy đúng bản Pro nên hai gói không bao giờ lệch nhau.
// Chỉ phần bán hàng (tên, giá, quyền lợi riêng của doanh nghiệp) là đặt lại ở đây.
PLANS.BUSINESS = {
  ...PLANS.PRO,
  name: 'Pro Doanh nghiệp',
  tagline: 'Cả nhóm cùng trả một khoản, mỗi người đều có quyền lợi Pro',
  // Giá = 10 tháng (tặng 2 tháng), cùng công thức với Plus/Pro.
  // 349.000đ cho 10 người ≈ 35.000/người: rẻ hơn mua 10 gói Pro lẻ (790.000đ),
  // nhưng một khách trả nhiều hơn 4,4 lần gói Pro thường.
  priceMonthly: 349000,
  priceYearly: 3490000,
  seats: MAX_BUSINESS_SEATS,
  features: [
    `Dùng chung cho tối đa ${MAX_BUSINESS_SEATS} tài khoản trong nhóm: mỗi người vẫn là một tài khoản riêng với việc, nhắc nhở và báo cáo của chính mình`,
    ...PLANS.PRO.features,
  ],
}

/** Bảng giá công khai (dùng cho trang giá, trang thanh toán và app Android). */
export function planCatalog() {
  return Object.entries(PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    tagline: plan.tagline,
    features: plan.features,
    upcoming: plan.upcoming || [],
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    productIds: {
      MONTHLY: PRODUCT_IDS[`${id}:MONTHLY`] || null,
      YEARLY: PRODUCT_IDS[`${id}:YEARLY`] || null,
    },
    limits: {
      activeTasks: finiteOrNull(plan.activeTasks),
      remindersPerTask: plan.remindersPerTask,
      categories: finiteOrNull(plan.categories),
      subtasksPerTask: finiteOrNull(plan.subtasksPerTask),
      devices: finiteOrNull(plan.devices),
      aiDailyLimit: finiteOrNull(plan.aiDailyLimit),
      repeatTasks: plan.repeatTasks,
      nagReminders: plan.nagReminders,
      reports: plan.reports,
      planner: plan.planner,
      taskSharing: plan.taskSharing,
      // Số tài khoản dùng chung gói (1 với gói thường, 4 với Pro Doanh nghiệp)
      seats: plan.seats || 1,
    },
  }))
}

function finiteOrNull(value) {
  return value === Infinity ? null : value
}

/** Số tiền phải trả (VND) cho một gói + kỳ. Gói FREE luôn 0. */
export function planPrice(plan, cycle = 'MONTHLY') {
  const cfg = PLANS[plan]
  if (!cfg) return null
  if (plan === 'FREE') return 0
  return cycle === 'YEARLY' ? cfg.priceYearly : cfg.priceMonthly
}

/** Số ngày của một kỳ đăng ký. */
export function cycleDays(cycle = 'MONTHLY') {
  return CYCLES[cycle]?.days || CYCLES.MONTHLY.days
}

/**
 * Kiểm tra gói trả phí của user đã quá hạn hay chưa.
 * @param {{ plan?: string, planExpiresAt?: Date|string|null }} user
 * @returns {boolean}
 */
export function isPlanExpired(user) {
  return (
    !!user &&
    PAID_PLANS.includes(user.plan) &&
    !!user.planExpiresAt &&
    new Date(user.planExpiresAt) <= new Date()
  )
}

/**
 * Hạ gói của một user xuống FREE khi đã quá hạn (kèm xoá mốc thời gian
 * và đưa âm thanh báo thức tùy chỉnh về chuông mặc định).
 * @param {number} userId
 * @returns {Promise<boolean>} true nếu đã hạ gói
 */
export async function downgradeUser(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { plan: true, planExpiresAt: true },
  })
  if (!user || !isPlanExpired(user)) return false

  await prisma.user.update({
    where: { userId },
    data: { plan: 'FREE', planStartedAt: null, planExpiresAt: null },
  })
  await prisma.subscription.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: { status: 'EXPIRED' },
  })
  // Âm thanh import chỉ dành cho gói trả phí → về chuông mặc định
  await prisma.notificationSetting.updateMany({
    where: { userId, alarmSound: { startsWith: 'custom:' } },
    data: { alarmSound: 'classic' },
  })
  return true
}

/**
 * Quét toàn bộ user có gói trả phí đã quá hạn → hạ xuống FREE.
 * Dùng cho scheduler (mỗi 1 phút) để đảm bảo hạn áp dụng kể cả khi user không truy cập.
 * @returns {Promise<number>} số user đã hạ gói
 */
export async function downgradeExpiredPlans() {
  const now = new Date()
  const expired = await prisma.user.findMany({
    where: { plan: { in: PAID_PLANS }, planExpiresAt: { lt: now } },
    select: { userId: true },
  })

  const res = await prisma.user.updateMany({
    where: { userId: { in: expired.map((u) => u.userId) } },
    data: { plan: 'FREE', planStartedAt: null, planExpiresAt: null },
  })

  if (res.count > 0) {
    await prisma.subscription.updateMany({
      where: { userId: { in: expired.map((u) => u.userId) }, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    })
    // Đưa âm thanh tùy chỉnh của các user vừa hạ gói về chuông mặc định
    await prisma.notificationSetting.updateMany({
      where: { alarmSound: { startsWith: 'custom:' }, user: { plan: 'FREE' } },
      data: { alarmSound: 'classic' },
    })
  }
  return res.count
}

/**
 * Lấy gói hiệu lực của user (FREE/PLUS/PRO).
 * Gói trả phí đã quá hạn được tính như FREE ngay lập tức
 * (scheduler / endpoint /me sẽ hạ gói vĩnh viễn sau đó).
 */
export async function getUserPlan(userId) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { plan: true, planExpiresAt: true },
  })
  if (!user) return 'FREE'
  return isPlanExpired(user) ? 'FREE' : user.plan
}

/** Lấy giới hạn của một tính năng theo gói. */
export function planLimit(plan, key) {
  return PLANS[plan]?.[key] ?? Infinity
}

/** Gói nào có quyền dùng một tính năng bật/tắt (vd calendarSync, zaloReminders). */
export function planAllows(plan, key) {
  return !!PLANS[plan]?.[key]
}

/**
 * Tạo lỗi giới hạn gói với thông điệp dễ hiểu, kèm chỉ dẫn nâng cấp.
 */
export function planLimitError({ feature, limit, plan = 'FREE', upgrade = 'Plus hoặc Pro' }) {
  const limitText = limit === Infinity ? 'không giới hạn' : limit
  const planName = PLANS[plan]?.name || plan
  return ApiError.badRequest(
    `Bạn đã dùng hết ${limitText} ${feature} của gói ${planName}. Nâng cấp lên gói ${upgrade} để mở rộng giới hạn.`
  )
}

export default {
  PLANS,
  PLAN_ORDER,
  PAID_PLANS,
  PRO_PLANS,
  MAX_BUSINESS_SEATS,
  CYCLES,
  PRODUCT_IDS,
  getUserPlan,
  planLimit,
  planAllows,
  planIsPro,
  planLimitError,
  planCatalog,
  planPrice,
  cycleDays,
}
