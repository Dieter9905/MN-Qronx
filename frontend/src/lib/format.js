// Tiện ích thời gian – format theo tiếng Việt, dùng xuyên suốt Web/Mobile (NFR-14)

export const VI_DAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
export const VI_DAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const VI_MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

export const pad = (n) => String(n).padStart(2, '0')

export function setTime(date, hour, minute = 0, second = 0) {
  const d = new Date(date)
  d.setHours(hour, minute, second, 0)
  return d
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000)
}

export function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function toDate(value) {
  return value ? new Date(value) : null
}

export function formatTime(value) {
  if (!value) return ''
  const d = toDate(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(value, { includeYear = true, weekday = false } = {}) {
  if (!value) return ''
  const d = toDate(value)
  const parts = [`${d.getDate()} ${VI_MONTHS[d.getMonth()]}`]
  if (includeYear) parts.push(String(d.getFullYear()))
  const base = parts.join(', ')
  return weekday ? `${VI_DAYS[d.getDay()]}, ${base}` : base
}

export function formatDateTime(value) {
  if (!value) return ''
  return `${formatDate(value, { weekday: true })}, ${formatTime(value)}`
}

export function formatDayKey(date) {
  const d = toDate(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatRelativeDay(date) {
  const d = toDate(date)
  const today = startOfDay(new Date())
  const target = startOfDay(d)
  const diff = Math.round((target - today) / 86400000)
  if (diff === 0) return 'Hôm nay'
  if (diff === 1) return 'Ngày mai'
  if (diff === -1) return 'Hôm qua'
  if (diff > 1 && diff < 7) return `${VI_DAYS[d.getDay()]} tuần này`
  if (diff > 0) return `Sau ${diff} ngày`
  if (diff < -1 && diff > -7) return `${VI_DAYS[d.getDay()]} tuần trước`
  return `${Math.abs(diff)} ngày trước`
}

export function formatReminderText(remindAt, dueAt) {
  const r = toDate(remindAt)
  const d = toDate(dueAt)
  const diffMin = Math.round((d - r) / 60000)
  if (diffMin === 0) return 'Đúng giờ'
  if (diffMin > 0 && diffMin < 60) return `Trước ${diffMin} phút`
  if (diffMin >= 60 && diffMin % 60 === 0) return `Trước ${diffMin / 60} giờ`
  if (diffMin > 0) return `Trước ${Math.floor(diffMin / 60)} giờ ${diffMin % 60} phút`
  return formatTime(remindAt)
}

export function timeUntil(date) {
  const diff = toDate(date) - new Date()
  if (diff <= 0) return null
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} phút nữa`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ ${mins % 60} phút nữa`
  const days = Math.floor(hours / 24)
  return `${days} ngày nữa`
}

export function isOverdue(task) {
  return (
    task &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED' &&
    toDate(task.dueAt) < new Date()
  )
}

export function effectiveStatus(task) {
  return isOverdue(task) ? 'OVERDUE' : task.status
}

export function formatDurationShort(mins) {
  if (mins < 60) return `${mins} phút`
  if (mins % 60 === 0) return `${mins / 60} giờ`
  return `${Math.floor(mins / 60)}g${mins % 60}p`
}

export function relativeTime(value) {
  const d = toDate(value)
  const diff = new Date() - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return formatDate(value)
}

// Lưới lịch tháng
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay() // 0 = CN
  const gridStart = addDays(first, -startWeekday)
  const cells = []
  for (let i = 0; i < 42; i += 1) {
    cells.push(addDays(gridStart, i))
  }
  return cells
}

export function weekDays(date) {
  const d = startOfDay(date)
  const start = addDays(d, -d.getDay())
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}
