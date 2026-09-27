// Các hằng số nghiệp vụ theo BA (TaskAlarm → MN-Qronx)

export const TASK_STATUS = {
  TODO: { label: 'Chưa làm', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
  IN_PROGRESS: { label: 'Đang làm', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
  COMPLETED: { label: 'Hoàn thành', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CANCELLED: { label: 'Đã hủy', badge: 'bg-rose-50 text-rose-700 ring-rose-200' },
}

export const OVERDUE_STATUS = {
  key: 'OVERDUE',
  label: 'Quá hạn',
  badge: 'bg-amber-50 text-amber-700 ring-amber-200',
}

export const PRIORITY = {
  LOW: { label: 'Thấp', badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
  MEDIUM: { label: 'Trung bình', badge: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  HIGH: { label: 'Cao', badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  URGENT: { label: 'Khẩn cấp', badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
}

export const REPEAT_TYPE = {
  NONE: 'Không lặp',
  DAILY: 'Hằng ngày',
  WEEKLY: 'Hằng tuần',
  MONTHLY: 'Hằng tháng',
}

export const REPEAT_TYPE_LIST = [
  { value: 'NONE', label: 'Không lặp' },
  { value: 'DAILY', label: 'Hằng ngày' },
  { value: 'WEEKLY', label: 'Hằng tuần' },
  { value: 'MONTHLY', label: 'Hằng tháng' },
]

// Ngày trong tuần cho lặp Hằng tuần – value theo ISO 8601 (1 = Thứ 2 … 7 = Chủ nhật)
export const WEEKDAYS = [
  { value: 1, label: 'T2', long: 'Thứ Hai' },
  { value: 2, label: 'T3', long: 'Thứ Ba' },
  { value: 3, label: 'T4', long: 'Thứ Tư' },
  { value: 4, label: 'T5', long: 'Thứ Năm' },
  { value: 5, label: 'T6', long: 'Thứ Sáu' },
  { value: 6, label: 'T7', long: 'Thứ Bảy' },
  { value: 7, label: 'CN', long: 'Chủ nhật' },
]

const WEEKDAY_LABEL = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' }

/**
 * Tóm tắt lịch lặp để hiển thị, vd: "Hằng tuần (T2, T4, T6)".
 * @param {string} repeatType NONE | DAILY | WEEKLY | MONTHLY
 * @param {number[]} [repeatDays] Danh sách ngày ISO 1..7
 * @returns {string}
 */
export function repeatSummary(repeatType, repeatDays) {
  const days = Array.isArray(repeatDays)
    ? repeatDays.map((d) => WEEKDAY_LABEL[Number(d)]).filter(Boolean)
    : []
  if (repeatType === 'WEEKLY' && days.length) {
    return `Hằng tuần (${days.join(', ')})`
  }
  return REPEAT_TYPE[repeatType] || 'Không lặp'
}

export const REMINDER_STATUS = {
  SCHEDULED: 'SCHEDULED',
  TRIGGERED: 'TRIGGERED',
  SNOOZED: 'SNOOZED',
  DISMISSED: 'DISMISSED',
  CANCELLED: 'CANCELLED',
}

export const NOTIFICATION_ACTION = {
  SENT: { label: 'Đã gửi', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
  SNOOZED: { label: 'Đã hoãn', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  DISMISSED: { label: 'Đã tắt', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CANCELLED: { label: 'Đã hủy', badge: 'bg-slate-100 text-slate-500 ring-slate-200' },
}

export const PLATFORM = {
  WEB: 'Web',
  ANDROID: 'Android',
  IOS: 'iOS',
}

export const ALARM_SOUNDS = [
  { id: 'classic', label: 'Chuông cổ điển' },
  { id: 'digital', label: 'Kỹ thuật số' },
  { id: 'bell', label: 'Chuông điện thoại' },
  { id: 'morning', label: 'Buổi sáng' },
  { id: 'gentle', label: 'Nhẹ nhàng' },
]

export const DEFAULT_SNOOZE_OPTIONS = [5, 10, 15, 30]

export const MAX_REMINDERS_PER_TASK = 5
export const MAX_SNOOZE_COUNT = 3

// "Nhắc dai" (gói Pro): chu kỳ nhắc lại, tính bằng phút.
// Nguồn thật là backend/src/services/nagService.js (NAG_INTERVALS).
export const NAG_INTERVALS = [
  { value: 1, label: '1 phút' },
  { value: 2, label: '2 phút' },
  { value: 5, label: '5 phút' },
  { value: 10, label: '10 phút' },
  { value: 15, label: '15 phút' },
  { value: 30, label: '30 phút' },
]

// ─── Gói dịch vụ (FREE / PLUS / PRO) ─────────────────────
export const PLAN_NAMES = {
  FREE: 'Miễn phí',
  PLUS: 'Plus',
  PRO: 'Pro',
}

// Giới hạn nhắc nhở mỗi công việc theo gói (backend ép buộc tương ứng)
export const PLAN_REMINDER_LIMIT = { FREE: 3, PLUS: 5, PRO: 5 }

// Kỳ thanh toán – giá theo năm = 10 tháng (tặng 2 tháng)
export const BILLING_CYCLES = [
  { id: 'MONTHLY', label: 'Theo tháng', short: 'tháng' },
  { id: 'YEARLY', label: 'Theo năm', short: 'năm', note: 'Tặng 2 tháng' },
]

// Thông tin gói dùng cho trang giá (Pricing) & trang nâng cấp (Billing).
// Đây là bản DỰ PHÒNG khi không gọi được API /billing/products (mạng lỗi) —
// nguồn duy nhất vẫn là backend/src/utils/planLimits.js, nên khi đổi giá hay
// đổi giới hạn thì sửa ở đó trước rồi cập nhật lại đây.
export const PLANS = [
  {
    id: 'FREE',
    label: 'Miễn phí',
    tagline: 'Đủ để tạo thói quen nhắc việc mỗi ngày',
    priceMonthly: 0,
    priceYearly: 0,
    gradient: 'from-slate-500 to-slate-600',
    features: [
      '50 công việc đang mở',
      'Nhắc nhở & công việc lặp lại hằng ngày/tuần/tháng',
      '10 danh mục, 20 việc con mỗi công việc',
      '2 thiết bị đồng bộ',
      'Trợ lý AI: 5 lần mỗi ngày',
      'Nhắc đúng giờ kể cả khi đã đóng trình duyệt',
      'Xuất việc sang Google Calendar / Outlook',
    ],
    limits: { activeTasks: 50, aiDailyLimit: 5, devices: 2, repeatTasks: true },
  },
  {
    id: 'PLUS',
    label: 'Plus',
    tagline: 'Cho người quản lý nhiều công việc mỗi ngày',
    priceMonthly: 39000,
    priceYearly: 390000,
    gradient: 'from-blue-500 to-cyan-500',
    popular: true,
    features: [
      'Không giới hạn công việc đang mở',
      '5 nhắc nhở mỗi công việc, không giới hạn danh mục & việc con',
      '5 thiết bị đồng bộ',
      'Trợ lý AI: 50 lần mỗi ngày',
      'Toàn bộ âm thanh báo thức có sẵn',
    ],
    limits: { activeTasks: null, aiDailyLimit: 50, devices: 5, repeatTasks: true },
  },
  {
    id: 'PRO',
    label: 'Pro',
    tagline: 'Toàn bộ sức mạnh MN-Qronx, không giới hạn',
    priceMonthly: 79000,
    priceYearly: 790000,
    gradient: 'from-violet-500 to-fuchsia-500',
    ai: true,
    // Chỉ liệt kê thứ khách ĐANG dùng được. Chưa làm thì để ở `upcoming` và
    // trang giá hiện kèm nhãn “Sắp có” — đừng bán thứ chưa có.
    features: [
      'Nhắc dai tới khi bạn xác nhận: việc quan trọng chưa xong thì chuông kêu lại',
      'Báo cáo năng suất 7/30/90 ngày kèm xuất Excel/PDF',
      'Không giới hạn công việc, nhắc nhở, danh mục & việc con',
      'Không giới hạn thiết bị đồng bộ',
      'Trợ lý AI không giới hạn',
      'Toàn bộ âm thanh báo thức, kể cả âm thanh riêng bạn tải lên',
    ],
    upcoming: [
      'AI xếp cả tuần thành kế hoạch kèm các bước làm',
      'Đồng bộ hai chiều Google Calendar (hiện đã có chiều app → lịch)',
    ],
    limits: {
      activeTasks: null,
      aiDailyLimit: null,
      devices: null,
      repeatTasks: true,
      nagReminders: true,
      reports: true,
    },
  },
]

// Badge màu cho gói (dùng ở Header / Hồ sơ / Admin)
export const PLAN_BADGE = {
  FREE: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600',
  PLUS: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-700',
  PRO: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:ring-violet-700',
}

export const CATEGORY_COLORS = [
  '#2563EB',
  '#06B6D4',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#64748B',
]
