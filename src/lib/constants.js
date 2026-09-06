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

// ─── Gói dịch vụ (FREE / PLUS / PRO) ─────────────────────
export const PLAN_NAMES = {
  FREE: 'Miễn phí',
  PLUS: 'Plus',
  PRO: 'Pro',
}

// Giới hạn nhắc nhở mỗi công việc theo gói (backend ép buộc tương ứng)
export const PLAN_REMINDER_LIMIT = { FREE: 2, PLUS: 5, PRO: 5 }

// Thông tin gói dùng cho trang giá (Pricing) & trang nâng cấp (Billing)
export const PLANS = [
  {
    id: 'FREE',
    label: 'Miễn phí',
    tagline: 'Bắt đầu quản lý công việc cơ bản',
    price: '0đ',
    period: 'mãi mãi',
    gradient: 'from-slate-500 to-slate-600',
    features: [
      'Tối đa 10 công việc đang mở',
      '2 nhắc nhở mỗi công việc',
      '5 danh mục',
      '5 việc con mỗi công việc',
      '1 thiết bị đồng bộ',
      'Âm thanh báo thức cơ bản',
    ],
  },
  {
    id: 'PLUS',
    label: 'Plus',
    tagline: 'Cho người quản lý nhiều công việc',
    price: '49.000đ',
    period: '/tháng',
    gradient: 'from-blue-500 to-cyan-500',
    popular: true,
    features: [
      '100 công việc đang mở',
      '5 nhắc nhở mỗi công việc',
      '20 danh mục',
      'Công việc lặp lại',
      '50 việc con mỗi công việc',
      '3 thiết bị đồng bộ',
    ],
  },
  {
    id: 'PRO',
    label: 'Pro',
    tagline: 'Toàn bộ sức mạnh MN-Qronx',
    price: '99.000đ',
    period: '/tháng',
    gradient: 'from-violet-500 to-fuchsia-500',
    ai: true,
    features: [
      'Trợ lý AI: tạo việc bằng lời, tách bước, gợi ý thứ tự làm',
      'Không giới hạn công việc đang mở',
      '5 nhắc nhở mỗi công việc',
      'Không giới hạn danh mục & việc con',
      'Công việc lặp lại',
      'Không giới hạn thiết bị đồng bộ',
      'Toàn bộ âm thanh báo thức',
    ],
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
