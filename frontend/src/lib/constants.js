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
