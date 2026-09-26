import crypto from 'crypto'
import prisma from '../config/prisma.js'

// ─── Xuất lịch .ics (một chiều) ─────────────────────────────
// Bước đầu của "đồng bộ Google Calendar": app gửi việc sang lịch của người dùng
// bằng URL họ đăng ký được trong Google Calendar/Outlook. Hai chiều (đọc ngược
// lại) sẽ nối sau khi bước một chạy ổn.
//
// App lịch KHÔNG mang được mật khẩu nên phải dùng khoá riêng (`user.icsKey`):
// có khoá thì ai có URL cũng xem được lịch của người đó — nên phải xoay được
// (rotate) để thu hồi khi nghi lộ.

// repeatDays của app: "1,3,5" (1 = Thứ 2) → BYDAY của RFC
const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

/** Sửa văn bản theo RFC 5545 §3.3.11. */
function icsEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Gập dòng dài quá 75 octet (RFC 5545 §3.1) — không gập thì một số app lịch
 * từ chối tệp. Không cắt giữa ký tự UTF-8 (tiếng Việt!)
 */
function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line

  let out = ''
  let offset = 0
  let first = true
  while (offset < bytes.length) {
    const limit = first ? 75 : 74 // dòng nối đầu có 1 khoảng trắng đầu
    let end = Math.min(offset + limit, bytes.length)
    while (end > offset && (bytes[end] & 0xc0) === 0x80) end -= 1 // không cắt byte nối
    out += first ? '' : '\r\n '
    out += bytes.subarray(offset, end).toString('utf8')
    offset = end
    first = false
  }
  return out
}

/** 20260926T120000Z */
function utcStamp(date) {
  return `${date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`
}

function rruleOf(task) {
  if (task.repeatType === 'DAILY') return 'RRULE:FREQ=DAILY'
  if (task.repeatType === 'MONTHLY') return 'RRULE:FREQ=MONTHLY'
  if (task.repeatType === 'WEEKLY') {
    const days = String(task.repeatDays || '')
      .split(',')
      .map((n) => BYDAY[Number(n.trim()) - 1])
      .filter(Boolean)
    return days.length > 0 ? `RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')}` : 'RRULE:FREQ=WEEKLY'
  }
  return null
}

const PRIORITY = { URGENT: 1, HIGH: 5, MEDIUM: 7, LOW: 9 }

/** Lấy (tự sinh nếu chưa có) khoá lịch của người dùng. */
export async function ensureIcsKey(userId) {
  const user = await prisma.user.findFirst({ where: { userId }, select: { icsKey: true } })
  if (user?.icsKey) return user.icsKey
  const key = crypto.randomBytes(18).toString('base64url')
  await prisma.user.update({ where: { userId }, data: { icsKey: key } })
  return key
}

/** Tạo khoá mới — khoá cũ hết hiệu lực ngay (người dùng nghi lộ thì bấm ở đây). */
export async function rotateIcsKey(userId) {
  const key = crypto.randomBytes(18).toString('base64url')
  await prisma.user.update({ where: { userId }, data: { icsKey: key } })
  return key
}

/** Tra người dùng theo khoá lịch; sai khoá trả null. */
export async function userIdByKey(key) {
  if (!key || typeof key !== 'string') return null
  const user = await prisma.user.findFirst({ where: { icsKey: key }, select: { userId: true } })
  return user?.userId ?? null
}

/** Dựng tệp .ics cho một người: mọi việc chưa bị xoá, kèm lặp và danh mục. */
export async function buildCalendar(userId, { calendarName = 'MN-Qronx — Công việc' } = {}) {
  const tasks = await prisma.task.findMany({
    where: { userId, deletedAt: null },
    orderBy: { dueAt: 'asc' },
    include: { category: { select: { categoryName: true } } },
    take: 2000,
  })

  const now = new Date()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MN-Qronx//Cong viec//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${icsEscape(calendarName)}`),
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
  ]

  for (const task of tasks) {
    const start = new Date(task.dueAt)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // mặc định 1 giờ

    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:task-${task.taskId}@mn-qronx`))
    lines.push(`DTSTAMP:${utcStamp(now)}`)
    lines.push(`DTSTART:${utcStamp(start)}`)
    lines.push(`DTEND:${utcStamp(end)}`)
    lines.push(foldLine(`SUMMARY:${icsEscape(task.title)}`))
    if (task.description) lines.push(foldLine(`DESCRIPTION:${icsEscape(task.description)}`))
    if (task.category?.categoryName) lines.push(foldLine(`CATEGORIES:${icsEscape(task.category.categoryName)}`))
    lines.push(
      `STATUS:${task.status === 'COMPLETED' ? 'COMPLETED' : task.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'}`
    )
    lines.push(`PRIORITY:${PRIORITY[task.priority] ?? 7}`)
    const rrule = rruleOf(task)
    if (rrule) lines.push(rrule)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
